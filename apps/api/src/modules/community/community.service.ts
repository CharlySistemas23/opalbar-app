import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { NotificationType, PostStatus, ReportTargetType, StoryScope, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { CommunityGateway } from './community.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreatePostDto, UpdatePostDto, CreateCommentDto,
  ReactDto, CreateReportDto, PostFilterDto, CommunityFeedScope, PostSurface,
  CreateStoryDto, StoryFeedScope,
} from './dto/community.dto';

// Venue brand identity — rendered client-side as the bar's "author".
// Centralised here so API responses expose the same fallback label if needed.
export const VENUE_STORY_AUTHOR = {
  id: '__venue__',
  name: 'OPAL BAR PV',
} as const;

const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR];

// Feed is volatile (likes + new posts change often). Short TTL.
const CACHE_TTL_FEED = 20;
const CACHE_TTL_POST = 30;
const WALL_MARKER = '__WALL__';

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly communityGateway: CommunityGateway,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  private static hashFilter(obj: unknown): string {
    return createHash('md5').update(JSON.stringify(obj ?? {})).digest('hex').slice(0, 12);
  }

  private async invalidateFeed(): Promise<void> {
    await this.redis.cacheDelPattern('cache:community:*');
  }

  /** Public alias used by AdminService after moderation so the feed cache
   * (20 s TTL) doesn't return stale data right after a post is approved. */
  async invalidateFeedCache(): Promise<void> {
    return this.invalidateFeed();
  }

  // ── POSTS ──────────────────────────────────

  async getPosts(filter: PostFilterDto, currentUserId?: string) {
    const key = RedisService.cacheKey(
      'community',
      'feed',
      CommunityService.hashFilter({ ...filter, viewer: currentUserId ?? null }),
    );
    return this.redis.cacheWrap(key, CACHE_TTL_FEED, async () => {
      const { page = 1, limit = 20, userId, scope, surface = PostSurface.COMMUNITY } = filter;
      const skip = getPaginationOffset(page, limit);
      const includePendingOwnPosts = !!userId && !!currentUserId && userId === currentUserId;

      let where: any = {
        deletedAt: null,
        ...(userId ? { userId } : {}),
        ...(includePendingOwnPosts
          ? { status: { in: [PostStatus.PUBLISHED, PostStatus.PENDING_REVIEW] } }
          : { status: PostStatus.PUBLISHED }),
      };

      if (surface === PostSurface.WALL) {
        where = { ...where, mediaUrls: { has: WALL_MARKER } };
      } else if (surface === PostSurface.COMMUNITY) {
        where = { ...where, NOT: { mediaUrls: { has: WALL_MARKER } } };
      }

      // Real "following" feed: only posts from users I follow + my own posts.
      if (scope === CommunityFeedScope.FOLLOWING) {
        if (!currentUserId) return paginate([], 0, page, limit);
        const following = await this.prisma.follow.findMany({
          where: { followerId: currentUserId },
          select: { followingId: true },
        });
        const visibleUserIds = [currentUserId, ...following.map((f) => f.followingId)];
        where = { ...where, userId: { in: visibleUserIds } };
      }

      const [data, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            _count: { select: { reactions: true, comments: true } },
            // Only hydrate the viewer's reaction to compute hasReacted cheaply
            reactions: currentUserId
              ? { where: { userId: currentUserId }, select: { id: true }, take: 1 }
              : false,
          },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.post.count({ where }),
      ]);

      // Decorate hasReacted + strip the raw reactions array (front doesn't need it)
      const decorated = data.map((p: any) => ({
        ...p,
        hasReacted: Array.isArray(p.reactions) && p.reactions.length > 0,
        reactions: undefined,
      }));

      return paginate(decorated, total, page, limit);
    });
  }

  async getPost(id: string, currentUserId?: string) {
    // Viewer-specific cache so hasReacted reflects the logged-in user
    const key = RedisService.cacheKey('community', 'post', id, currentUserId ?? 'anon');
    return this.redis.cacheWrap(key, CACHE_TTL_POST, async () => {
      const post = await this.prisma.post.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          _count: { select: { reactions: true, comments: true } },
          reactions: currentUserId
            ? { where: { userId: currentUserId }, select: { id: true }, take: 1 }
            : false,
        },
      });
      if (!post || post.deletedAt) throw new NotFoundException('Post not found');
      const hasReacted =
        Array.isArray((post as any).reactions) && (post as any).reactions.length > 0;
      return { ...post, reactions: undefined, hasReacted };
    });
  }

  async createPost(userId: string, dto: CreatePostDto) {
    // Manual moderation mode: every post enters the admin queue before publishing.
    // This matches the owner's workflow ("todo lo reviso manual antes de publicar").
    // When an ML filter is wired later, change this back to score-based.
    const moderationScore = this.basicModerationCheck(dto.content);
    const status = PostStatus.PENDING_REVIEW;

    const isWallPost = dto.surface === PostSurface.WALL;

    const post = await this.prisma.post.create({
      data: {
        userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
        mediaUrls: isWallPost ? [WALL_MARKER] : [],
        status,
        moderationScore,
      },
    });

    // Award points for posting (only when auto-published — pending posts don't earn).
    if (status === PostStatus.PUBLISHED) {
      // Read-then-write inside a transaction so `balance` in WalletTransaction
      // is accurate (was 0 before). +5 pts per post.
      const POINTS = 5;
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { points: { increment: POINTS } },
        select: { points: true },
      });
      await this.prisma.walletTransaction.create({
        data: {
          userId,
          type: 'EARN',
          points: POINTS,
          balance: updated.points,
          description: 'Puntos por publicar en comunidad',
          referenceId: post.id,
          referenceType: 'POST_ENGAGEMENT',
        },
      });
    }

    await this.invalidateFeed();
    this.communityGateway.emitChanged({ type: 'post_created', postId: post.id });
    this.realtime.broadcast('post', 'created', { id: post.id, data: { userId } });
    return post;
  }

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    if (post.userId !== userId) throw new ForbiddenException('Not authorized');
    const updated = await this.prisma.post.update({ where: { id: postId }, data: dto });
    await this.invalidateFeed();
    this.communityGateway.emitChanged({ type: 'post_updated', postId });
    this.realtime.broadcast('post', 'updated', { id: postId });
    return updated;
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    if (post.userId !== userId) throw new ForbiddenException('Not authorized');
    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
    await this.invalidateFeed();
    this.communityGateway.emitChanged({ type: 'post_deleted', postId });
    this.realtime.broadcast('post', 'deleted', { id: postId });
  }

  // ── COMMENTS ──────────────────────────────

  async getComments(postId: string, currentUserId?: string) {
    const flatComments = await this.prisma.comment.findMany({
      where: { postId, deletedAt: null, status: PostStatus.PUBLISHED },
      include: {
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        _count: { select: { likes: true, replies: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const ids = flatComments.map((c) => c.id);
    let likedSet = new Set<string>();
    if (currentUserId && ids.length > 0) {
      const mine = await this.prisma.commentLike.findMany({
        where: { userId: currentUserId, commentId: { in: ids } },
        select: { commentId: true },
      });
      likedSet = new Set(mine.map((m) => m.commentId));
    }

    const nodes = flatComments.map((c: any) => ({
      ...c,
      hasLiked: likedSet.has(c.id),
      replies: [],
    }));

    const byId = new Map(nodes.map((n: any) => [n.id, n]));
    const roots: any[] = [];

    for (const node of nodes) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId).replies.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async toggleCommentLike(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');

    const existing = await this.prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.commentLike.delete({ where: { userId_commentId: { userId, commentId } } }),
        this.prisma.comment.update({ where: { id: commentId }, data: { likesCount: { decrement: 1 } } }),
      ]);
      this.communityGateway.emitChanged({
        type: 'comment_liked',
        postId: comment.postId,
        commentId,
      });
      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.commentLike.create({ data: { userId, commentId } }),
      this.prisma.comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } }),
    ]);
    this.communityGateway.emitChanged({
      type: 'comment_liked',
      postId: comment.postId,
      commentId,
    });
    return { liked: true };
  }

  async createComment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');

    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: dto.parentId,
          postId,
          deletedAt: null,
          status: PostStatus.PUBLISHED,
        },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent comment not found');
    }

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { postId, userId, content: dto.content, parentId: dto.parentId },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      }),
    ]);

    this.communityGateway.emitChanged({
      type: 'comment_created',
      postId,
      commentId: comment.id,
    });
    this.realtime.broadcast('comment', 'created', { id: comment.id, data: { postId, userId } });

    // Notify post author on top-level comments.
    // For replies, notify the parent comment's author instead.
    const actor = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    const actorName =
      `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';
    const actorAvatarUrl = actor?.avatarUrl ?? null;

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { userId: true },
      });
      if (parent && parent.userId !== userId) {
        this.notifications
          .createNotification({
            userId: parent.userId,
            type: NotificationType.COMMUNITY_REPLY,
            title: 'Nueva respuesta',
            titleEn: 'New reply',
            body: `${actorName} respondió a tu comentario.`,
            bodyEn: `${actorName} replied to your comment.`,
            data: { postId, commentId: comment.id, actorId: userId, actorName, actorAvatarUrl },
          })
          .catch(() => {});
      }
    } else if (post.userId !== userId) {
      this.notifications
        .createNotification({
          userId: post.userId,
          type: NotificationType.COMMUNITY_REPLY,
          title: 'Nuevo comentario',
          titleEn: 'New comment',
          body: `${actorName} comentó tu publicación.`,
          bodyEn: `${actorName} commented on your post.`,
          data: { postId, commentId: comment.id, actorId: userId, actorName, actorAvatarUrl },
        })
        .catch(() => {});
    }

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
    this.communityGateway.emitChanged({
      type: 'comment_deleted',
      postId: comment.postId,
      commentId,
    });
    this.realtime.broadcast('comment', 'deleted', { id: commentId, data: { postId: comment.postId } });
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
        await this.invalidatePostCache(postId);
        this.communityGateway.emitChanged({ type: 'post_reacted', postId });
    this.realtime.broadcast('post', 'reacted', { id: postId });
        return { reacted: false };
      }
      // Change type
      await this.prisma.reaction.update({
        where: { userId_postId: { userId, postId } },
        data: { type: dto.type },
      });
      await this.invalidatePostCache(postId);
      this.communityGateway.emitChanged({ type: 'post_reacted', postId });
    this.realtime.broadcast('post', 'reacted', { id: postId });
      return { reacted: true, type: dto.type };
    }

    await this.prisma.$transaction([
      this.prisma.reaction.create({ data: { userId, postId, type: dto.type } }),
      this.prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } }),
    ]);
    await this.invalidatePostCache(postId);
    this.communityGateway.emitChanged({ type: 'post_reacted', postId });
    this.realtime.broadcast('post', 'reacted', { id: postId });

    if (post.userId !== userId) {
      const actor = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      const actorName =
        `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';
      const actorAvatarUrl = actor?.avatarUrl ?? null;
      this.notifications
        .createNotification({
          userId: post.userId,
          type: NotificationType.COMMUNITY_REACTION,
          title: 'Nueva reacción',
          titleEn: 'New reaction',
          body: `${actorName} le dio like a tu publicación.`,
          bodyEn: `${actorName} liked your post.`,
          data: { postId, actorId: userId, actorName, actorAvatarUrl },
        })
        .catch(() => {});
    }

    return { reacted: true, type: dto.type };
  }

  private async invalidatePostCache(_postId: string): Promise<void> {
    // Reuse the broad invalidator — covers both feed and post caches keyed
    // under cache:community:*
    await this.invalidateFeed();
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

  // ── STORIES ──────────────────────────────
  // Ephemeral 24h posts. Two scopes:
  //   - VENUE   → posted by admin, rendered as "OPAL BAR PV" (always visible)
  //   - PERSONAL → posted by any user (Instagram-style)

  /**
   * Build the two feeds the community screen needs.
   *   - venue: all active VENUE stories, merged under one virtual author
   *   - personal: PERSONAL stories, grouped by author
   *       · scope=following → only from users the viewer follows
   *       · otherwise       → discovery (everyone)
   */
  async getStories(currentUserId?: string, personalScope?: StoryFeedScope) {
    const now = new Date();

    // "For you" (default) → venue only. Personal stories are private to the
    // author's followers and only surface in the "Following" feed.
    const isFollowing = personalScope === StoryFeedScope.FOLLOWING;

    // Following feed needs the viewer's follow list to filter.
    let followingUserIds: string[] = [];
    if (isFollowing && currentUserId) {
      const follows = await this.prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      followingUserIds = [currentUserId, ...follows.map((f) => f.followingId)];
    }

    const [venueRows, personalRows] = await Promise.all([
      this.prisma.story.findMany({
        where: { scope: StoryScope.VENUE, expiresAt: { gt: now } },
        orderBy: { createdAt: 'asc' },
        include: {
          views: currentUserId
            ? { where: { userId: currentUserId }, select: { id: true } }
            : false,
        },
      }),
      isFollowing && followingUserIds.length > 0
        ? this.prisma.story.findMany({
            where: {
              scope: StoryScope.PERSONAL,
              expiresAt: { gt: now },
              userId: { in: followingUserIds },
            },
            orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
            include: {
              user: {
                select: {
                  id: true,
                  profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
                },
              },
              views: currentUserId
                ? { where: { userId: currentUserId }, select: { id: true } }
                : false,
            },
          })
        : Promise.resolve([]),
    ]);

    // Venue: single virtual author bundle
    let venue: null | {
      user: { id: string; name: string; avatarUrl: null };
      stories: any[];
      hasUnseen: boolean;
    } = null;
    if (venueRows.length > 0) {
      const stories = venueRows.map((s) => {
        const seen = Array.isArray(s.views) && s.views.length > 0;
        return {
          id: s.id,
          mediaUrl: s.mediaUrl,
          caption: s.caption,
          viewsCount: s.viewsCount,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          scope: s.scope,
          seen,
        };
      });
      venue = {
        user: { id: VENUE_STORY_AUTHOR.id, name: VENUE_STORY_AUTHOR.name, avatarUrl: null },
        stories,
        hasUnseen: stories.some((st) => !st.seen),
      };
    }

    // Personal: group by author
    const byAuthor = new Map<string, { user: any; stories: any[]; hasUnseen: boolean }>();
    for (const s of personalRows) {
      const entry = byAuthor.get(s.userId) ?? { user: s.user, stories: [], hasUnseen: false };
      const seen = Array.isArray(s.views) && s.views.length > 0;
      entry.stories.push({
        id: s.id,
        mediaUrl: s.mediaUrl,
        caption: s.caption,
        viewsCount: s.viewsCount,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        scope: s.scope,
        seen,
      });
      if (!seen) entry.hasUnseen = true;
      byAuthor.set(s.userId, entry);
    }
    const personal = Array.from(byAuthor.values()).sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return 0;
    });

    return { venue, personal };
  }

  /** Active stories for a single user (used when tapping a profile avatar). */
  async getUserStories(userId: string, currentUserId?: string) {
    const now = new Date();
    const rows = await this.prisma.story.findMany({
      where: { userId, scope: StoryScope.PERSONAL, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        views: currentUserId
          ? { where: { userId: currentUserId }, select: { id: true } }
          : false,
      },
    });
    if (rows.length === 0) return { user: null, stories: [], hasUnseen: false };
    const stories = rows.map((s) => {
      const seen = Array.isArray(s.views) && s.views.length > 0;
      return {
        id: s.id,
        mediaUrl: s.mediaUrl,
        caption: s.caption,
        viewsCount: s.viewsCount,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        scope: s.scope,
        seen,
      };
    });
    return { user: rows[0].user, stories, hasUnseen: stories.some((s) => !s.seen) };
  }

  async createStory(
    userId: string,
    dto: CreateStoryDto,
    scope: StoryScope = StoryScope.PERSONAL,
  ) {
    if (!dto.mediaUrl) throw new BadRequestException('mediaUrl is required');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaUrl: dto.mediaUrl,
        caption: dto.caption,
        expiresAt,
        scope,
      },
    });
    this.realtime.broadcast('story', 'created', {
      id: story.id,
      data: { userId, scope },
    });

    // Venue stories are house announcements — push to every active user.
    // Personal stories don't push (would be spammy at scale; only realtime).
    if (scope === StoryScope.VENUE) {
      this.notifications
        .broadcastToAllActiveUsers({
          type: NotificationType.VENUE_STORY_NEW,
          title: 'Nueva historia de OPAL BAR',
          titleEn: 'New OPAL BAR story',
          body: dto.caption ?? 'Mira lo que está pasando en el bar.',
          bodyEn: dto.caption ?? 'See what\'s happening at the bar.',
          data: { storyId: story.id },
          imageUrl: dto.mediaUrl,
        })
        .catch(() => {});
    }
    return story;
  }

  /**
   * Delete a story. Owner can delete their own; admins/mods can delete any
   * (used to moderate community content and remove stale venue stories).
   */
  async deleteStory(storyId: string, requester: { id: string; role: UserRole }) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    const isOwner = story.userId === requester.id;
    const isAdmin = ADMIN_ROLES.includes(requester.role);
    if (!isOwner && !isAdmin) throw new ForbiddenException('Not your story');
    await this.prisma.story.delete({ where: { id: storyId } });
    this.realtime.broadcast('story', 'deleted', {
      id: storyId,
      data: { userId: story.userId, scope: story.scope },
    });
    return { success: true };
  }

  /** All active venue stories — used by admin management screen. */
  async listVenueStories() {
    const now = new Date();
    const rows = await this.prisma.story.findMany({
      where: { scope: StoryScope.VENUE, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mediaUrl: true,
        caption: true,
        viewsCount: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return { data: rows };
  }

  async markStoryViewed(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    // Idempotent — unique constraint on (storyId, userId)
    try {
      await this.prisma.storyView.create({ data: { storyId, userId } });
      await this.prisma.story.update({
        where: { id: storyId },
        data: { viewsCount: { increment: 1 } },
      });
    } catch {
      // Already viewed — ignore
    }
    return { success: true };
  }

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
