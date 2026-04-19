import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { PostStatus, ReportTargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import {
  CreatePostDto, UpdatePostDto, CreateCommentDto,
  ReactDto, CreateReportDto, PostFilterDto,
} from './dto/community.dto';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // ── POSTS ──────────────────────────────────

  async getPosts(filter: PostFilterDto) {
    const { page = 1, limit = 20 } = filter;
    const skip = getPaginationOffset(page, limit);
    const where = { status: PostStatus.PUBLISHED, deletedAt: null };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          _count: { select: { reactions: true, comments: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.post.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getPost(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        _count: { select: { reactions: true, comments: true } },
      },
    });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    return post;
  }

  async createPost(userId: string, dto: CreatePostDto) {
    // Basic content moderation score (placeholder — integrate ML service later)
    const moderationScore = this.basicModerationCheck(dto.content);
    const status = moderationScore < 0.5 ? PostStatus.PUBLISHED : PostStatus.PENDING_REVIEW;

    const post = await this.prisma.post.create({
      data: {
        userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
        status,
        moderationScore,
      },
    });

    // Award points for posting
    if (status === PostStatus.PUBLISHED) {
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: userId }, data: { points: { increment: 5 } } }),
        this.prisma.walletTransaction.create({
          data: {
            userId, type: 'EARN', points: 5, balance: 0,
            description: 'Puntos por publicar en comunidad',
            referenceId: post.id, referenceType: 'POST_ENGAGEMENT',
          },
        }),
      ]);
    }

    return post;
  }

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    if (post.userId !== userId) throw new ForbiddenException('Not authorized');
    return this.prisma.post.update({ where: { id: postId }, data: dto });
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    if (post.userId !== userId) throw new ForbiddenException('Not authorized');
    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  }

  // ── COMMENTS ──────────────────────────────

  async getComments(postId: string) {
    return this.prisma.comment.findMany({
      where: { postId, parentId: null, deletedAt: null, status: PostStatus.PUBLISHED },
      include: {
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        replies: {
          where: { deletedAt: null },
          include: {
            user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createComment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { postId, userId, content: dto.content, parentId: dto.parentId },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      }),
    ]);

    return comment;
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not authorized');
    await this.prisma.$transaction([
      this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      this.prisma.post.update({ where: { id: comment.postId }, data: { commentsCount: { decrement: 1 } } }),
    ]);
  }

  // ── REACTIONS ─────────────────────────────

  async reactToPost(postId: string, userId: string, dto: ReactDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      if (existing.type === dto.type) {
        // Toggle off
        await this.prisma.$transaction([
          this.prisma.reaction.delete({ where: { userId_postId: { userId, postId } } }),
          this.prisma.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } }),
        ]);
        return { reacted: false };
      }
      // Change type
      await this.prisma.reaction.update({
        where: { userId_postId: { userId, postId } },
        data: { type: dto.type },
      });
      return { reacted: true, type: dto.type };
    }

    await this.prisma.$transaction([
      this.prisma.reaction.create({ data: { userId, postId, type: dto.type } }),
      this.prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } }),
    ]);
    return { reacted: true, type: dto.type };
  }

  // ── REPORTS ───────────────────────────────

  async reportContent(
    targetType: ReportTargetType,
    targetId: string,
    reporterId: string,
    dto: CreateReportDto,
  ) {
    return this.prisma.report.create({
      data: { reporterId, targetType, targetId, reason: dto.reason, description: dto.description },
    });
  }

  // ── RANKING ───────────────────────────────

  async getCommunityRanking() {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { points: 'desc' },
      take: 50,
      select: {
        id: true,
        points: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true, loyaltyLevel: true } },
      },
    });
  }

  // ── HELPERS ───────────────────────────────

  private basicModerationCheck(content: string): number {
    // Placeholder — returns 0 (safe) by default
    // In production: integrate OpenAI Moderation API or similar
    const blockedWords = ['spam', 'offensive'];
    const lower = content.toLowerCase();
    const hasBlocked = blockedWords.some((w) => lower.includes(w));
    return hasBlocked ? 0.8 : 0.1;
  }
}
