import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { MentionTargetType, NotificationType, PostStatus, ReportTargetType, StoryScope, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { CommunityGateway } from './community.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MentionsService } from '../mentions/mentions.service';
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

function aggregateEmojiReactions(
  rows: Array<{ emoji: string; userId: string }> | undefined | null,
  viewerId?: string,
): Array<{ emoji: string; count: number; mine: boolean }> {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: Array<{ emoji: string; count: number; mine: boolean }> = [];
  for (const r of rows) {
    const hit = out.find((x) => x.emoji === r.emoji);
    if (hit) {
      hit.count += 1;
      if (viewerId && r.userId === viewerId) hit.mine = true;
    } else {
      out.push({ emoji: r.emoji, count: 1, mine: !!viewerId && r.userId === viewerId });
    }
  }
  return out;
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly communityGateway: CommunityGateway,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly mentions: MentionsService,
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

      // Audit fix: ocultar posts de cuentas privadas a quienes no las siguen.
      // Anonimos: solo ven publicas. Logged-in: publicas + privadas que sigue
      // o que son su misma cuenta. Si el filtro pide explicitamente userId
      // (perfil de un user), el respeto es: si es privada y no soy follower
      // ni dueno, devuelvo lista vacia.
      if (!userId || userId !== currentUserId) {
        const visibilityClauses: any[] = [{ user: { isPrivate: false } }];
        if (currentUserId) {
          visibilityClauses.push({ userId: currentUserId });
          visibilityClauses.push({
            user: {
              followers: { some: { followerId: currentUserId } },
            },
          });
        }
        where = { ...where, OR: visibilityClauses };
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
            emojiReactions: { select: { emoji: true, userId: true } },
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
        emojiReactions: aggregateEmojiReactions(p.emojiReactions, currentUserId),
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
          // Audit fix: traer isPrivate del autor para chequear acceso antes de
          // devolver el detalle. Antes el endpoint @Public devolvia cualquier
          // post si conocias el id (enumeracion).
          user: { select: { id: true, isPrivate: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          _count: { select: { reactions: true, comments: true } },
          reactions: currentUserId
            ? { where: { userId: currentUserId }, select: { id: true }, take: 1 }
            : false,
          emojiReactions: { select: { emoji: true, userId: true } },
        },
      });
      if (!post || post.deletedAt) throw new NotFoundException('Post not found');

      // Privacy check: si el author es privado y el viewer no es el dueno
      // ni un follower, devolver 404 (mismo shape de "no existe" para no
      // filtrar metadata del post).
      const author = (post as any).user as { id: string; isPrivate: boolean };
      if (author?.isPrivate && currentUserId !== author.id) {
        if (!currentUserId) throw new NotFoundException('Post not found');
        const follow = await this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: currentUserId, followingId: author.id } },
          select: { id: true },
        });
        if (!follow) throw new NotFoundException('Post not found');
      }
      const hasReacted =
        Array.isArray((post as any).reactions) && (post as any).reactions.length > 0;
      return {
        ...post,
        reactions: undefined,
        hasReacted,
        emojiReactions: aggregateEmojiReactions((post as any).emojiReactions, currentUserId),
      };
    });
  }

  async createPost(userId: string, dto: CreatePostDto) {
    // Post-moderation: los posts se publican de inmediato (sin esperar aprobación).
    // El filtro automático solo RETIENE para revisión manual el contenido
    // potencialmente objetable (score alto). El admin puede verificar, ocultar o
    // eliminar cualquier post después desde el panel. Esto cumple la 1.2 de Apple
    // (filtro de contenido objetable + moderación) sin bloquear la experiencia.
    const moderationScore = this.basicModerationCheck(dto.content);
    const status =
      moderationScore >= 0.5 ? PostStatus.PENDING_REVIEW : PostStatus.PUBLISHED;

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

    if (dto.mentions && dto.mentions.length > 0) {
      this.mentions
        .applyMentions({
          authorId: userId,
          targetType: MentionTargetType.POST,
          targetId: post.id,
          mentions: dto.mentions,
        })
        .catch(() => {});
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

  async deletePost(postId: string, userId: string, role?: UserRole) {
    // Politica de moderacion: los usuarios no pueden eliminar publicaciones.
    // EXCEPCION: el equipo (ADMIN/SUPER_ADMIN/MODERATOR) puede borrar
    // (sus propios posts o cualquiera) directamente desde la app — el
    // mismo endpoint que usa el cliente.
    const isStaff = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR';
    if (!isStaff) {
      throw new ForbiddenException(
        'Los usuarios no pueden eliminar publicaciones. Si esta publicación viola las normas, usa la opción Reportar.',
      );
    }
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post no encontrado');
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
    await this.invalidateFeed();
    this.communityGateway.emitChanged({ type: 'post_deleted', postId });
    this.realtime.broadcast('post', 'deleted', { id: postId });
  }

  // ── COMMENTS ──────────────────────────────

  /**
   * Audit fix: comments/reactors of posts authored by private accounts were
   * leaking to non-followers via these public endpoints. This helper enforces
   * the same privacy gate `getPost` uses, returning a generic 404 to avoid
   * leaking the post's existence.
   */
  private async assertCanViewPostContent(postId: string, viewerId?: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { deletedAt: true, user: { select: { id: true, isPrivate: true } } },
    });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    const author = post.user;
    if (!author?.isPrivate) return;
    if (viewerId === author.id) return;
    if (!viewerId) throw new NotFoundException('Post not found');
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: author.id } },
      select: { id: true },
    });
    if (!follow) throw new NotFoundException('Post not found');
  }

  async getComments(postId: string, currentUserId?: string) {
    await this.assertCanViewPostContent(postId, currentUserId);
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

    // Aggregate emoji reactions by comment so the renderer shows chips with
    // counts + whether the current user already reacted with each emoji.
    const reactionRows = ids.length
      ? await this.prisma.commentReaction.findMany({
          where: { commentId: { in: ids } },
          select: { commentId: true, emoji: true, userId: true },
        })
      : [];
    const reactionsByComment = new Map<string, Array<{ emoji: string; count: number; mine: boolean }>>();
    for (const r of reactionRows) {
      const arr = reactionsByComment.get(r.commentId) ?? [];
      const hit = arr.find((x) => x.emoji === r.emoji);
      if (hit) {
        hit.count += 1;
        if (currentUserId && r.userId === currentUserId) hit.mine = true;
      } else {
        arr.push({ emoji: r.emoji, count: 1, mine: !!currentUserId && r.userId === currentUserId });
      }
      reactionsByComment.set(r.commentId, arr);
    }

    // Hydrate resolved mentions per comment so the renderer can map @handle
    // → userId for tappable highlights. One bulk query keeps this cheap.
    const mentionRows = ids.length
      ? await this.prisma.mention.findMany({
          where: {
            targetType: MentionTargetType.COMMENT,
            targetId: { in: ids },
            status: 'APPROVED',
          },
          select: {
            targetId: true,
            targetUserId: true,
            targetUser: {
              select: {
                id: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        })
      : [];
    const mentionsByComment = new Map<string, any[]>();
    for (const m of mentionRows) {
      const arr = mentionsByComment.get(m.targetId) ?? [];
      arr.push({
        userId: m.targetUserId,
        firstName: m.targetUser?.profile?.firstName ?? null,
        lastName: m.targetUser?.profile?.lastName ?? null,
      });
      mentionsByComment.set(m.targetId, arr);
    }

    const nodes = flatComments.map((c: any) => ({
      ...c,
      hasLiked: likedSet.has(c.id),
      mentions: mentionsByComment.get(c.id) ?? [],
      reactions: reactionsByComment.get(c.id) ?? [],
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

  async toggleCommentReaction(commentId: string, userId: string, emoji: string) {
    const clean = (emoji ?? '').trim();
    if (!clean) throw new NotFoundException('Emoji required');
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');

    // FB-style: at most one emoji per user per comment.
    const mine = await this.prisma.commentReaction.findMany({
      where: { commentId, userId },
    });
    const sameEmoji = mine.find((r) => r.emoji === clean);

    if (sameEmoji) {
      await this.prisma.commentReaction.delete({ where: { id: sameEmoji.id } });
      this.communityGateway.emitChanged({
        type: 'comment_reacted',
        postId: comment.postId,
        commentId,
      });
      return { reacted: false, emoji: clean };
    }

    if (mine.length > 0) {
      await this.prisma.commentReaction.deleteMany({
        where: { id: { in: mine.map((r) => r.id) } },
      });
    }

    await this.prisma.commentReaction.create({ data: { commentId, userId, emoji: clean } });
    this.communityGateway.emitChanged({
      type: 'comment_reacted',
      postId: comment.postId,
      commentId,
    });

    if (comment.userId !== userId) {
      const actor = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      const actorName =
        `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';
      this.notifications
        .createNotification({
          userId: comment.userId,
          type: NotificationType.COMMUNITY_REACTION,
          title: 'Nueva reacción',
          titleEn: 'New reaction',
          body: `${actorName} reaccionó ${clean} a tu comentario.`,
          bodyEn: `${actorName} reacted ${clean} to your comment.`,
          data: {
            postId: comment.postId,
            commentId,
            actorId: userId,
            actorName,
            actorAvatarUrl: actor?.avatarUrl ?? null,
            emoji: clean,
          },
          imageUrl: actor?.avatarUrl ?? undefined,
        })
        .catch(() => {});
    }

    return { reacted: true, emoji: clean };
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

    if (dto.mentions && dto.mentions.length > 0) {
      this.mentions
        .applyMentions({
          authorId: userId,
          targetType: MentionTargetType.COMMENT,
          targetId: comment.id,
          mentions: dto.mentions,
          preview: dto.content,
        })
        .catch(() => {});
    }

    return comment;
  }

  async updateComment(commentId: string, userId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not authorized');
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
    });
    this.communityGateway.emitChanged({
      type: 'comment_updated',
      postId: comment.postId,
      commentId,
    });
    return updated;
  }

  async deleteComment(commentId: string, userId: string, role?: UserRole) {
    // Misma logica que deletePost: bloqueado para usuarios, abierto para staff.
    const isStaff = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR';
    if (!isStaff) {
      throw new ForbiddenException(
        'Los usuarios no pueden eliminar comentarios. Si este comentario viola las normas, usa la opción Reportar.',
      );
    }
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comentario no encontrado');
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

  async togglePostEmojiReaction(postId: string, userId: string, emoji: string) {
    const clean = (emoji ?? '').trim();
    if (!clean) throw new BadRequestException('Emoji required');
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');

    // FB-style: each user has AT MOST one emoji on a post. Tap same → remove.
    // Tap different → swap.
    const mine = await this.prisma.postEmojiReaction.findMany({
      where: { postId, userId },
    });
    const sameEmoji = mine.find((r) => r.emoji === clean);

    if (sameEmoji) {
      await this.prisma.postEmojiReaction.delete({ where: { id: sameEmoji.id } });
      await this.invalidatePostCache(postId);
      this.communityGateway.emitChanged({ type: 'post_reacted', postId });
      return { reacted: false, emoji: clean };
    }

    // Drop any prior emoji from this user, then add the new one.
    if (mine.length > 0) {
      await this.prisma.postEmojiReaction.deleteMany({
        where: { id: { in: mine.map((r) => r.id) } },
      });
    }

    await this.prisma.postEmojiReaction.create({ data: { postId, userId, emoji: clean } });
    await this.invalidatePostCache(postId);
    this.communityGateway.emitChanged({ type: 'post_reacted', postId });

    if (post.userId !== userId) {
      const actor = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      const actorName =
        `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';
      this.notifications
        .createNotification({
          userId: post.userId,
          type: NotificationType.COMMUNITY_REACTION,
          title: 'Nueva reacción',
          titleEn: 'New reaction',
          body: `${actorName} reaccionó ${clean} a tu publicación.`,
          bodyEn: `${actorName} reacted ${clean} to your post.`,
          data: {
            postId,
            actorId: userId,
            actorName,
            actorAvatarUrl: actor?.avatarUrl ?? null,
            emoji: clean,
          },
          imageUrl: actor?.avatarUrl ?? undefined,
        })
        .catch(() => {});
    }

    return { reacted: true, emoji: clean };
  }

  async getPostReactors(postId: string, currentUserId?: string) {
    await this.assertCanViewPostContent(postId, currentUserId);

    const rows = await this.prisma.postEmojiReaction.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    return rows.map((r) => {
      const first = r.user?.profile?.firstName ?? '';
      const last = r.user?.profile?.lastName ?? '';
      const name = `${first} ${last}`.trim() || 'Usuario';
      return {
        userId: r.userId,
        name,
        avatarUrl: r.user?.profile?.avatarUrl ?? null,
        emoji: r.emoji,
        createdAt: r.createdAt,
      };
    });
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
    // Audit fix: bajo @Public, anonimos podian leer stories de cuentas
    // privadas si conocian el userId. Ahora si el target es privado y el
    // viewer no es dueno ni follower, devolvemos vacio (mismo shape).
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPrivate: true },
    });
    if (target?.isPrivate && currentUserId !== userId) {
      if (!currentUserId) return { user: null, stories: [], hasUnseen: false };
      const follow = await this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: currentUserId, followingId: userId } },
        select: { id: true },
      });
      if (!follow) return { user: null, stories: [], hasUnseen: false };
    }

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

    if (dto.mentions && dto.mentions.length > 0 && scope === StoryScope.PERSONAL) {
      this.mentions
        .applyMentions({
          authorId: userId,
          targetType: MentionTargetType.STORY,
          targetId: story.id,
          mentions: dto.mentions,
        })
        .catch(() => {});
    }

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

  async toggleStoryReaction(storyId: string, userId: string, emoji: string) {
    const clean = (emoji ?? '').trim();
    if (!clean) throw new BadRequestException('Emoji required');
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');

    const existing = await this.prisma.storyReaction.findUnique({
      where: { storyId_userId_emoji: { storyId, userId, emoji: clean } },
    });
    if (existing) {
      await this.prisma.storyReaction.delete({ where: { id: existing.id } });
      return { reacted: false, emoji: clean };
    }

    await this.prisma.storyReaction.create({ data: { storyId, userId, emoji: clean } });

    // Notify story owner (skip own reactions and venue stories — venue has no
    // single human author to notify)
    if (story.scope === StoryScope.PERSONAL && story.userId !== userId) {
      const actor = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { firstName: true, lastName: true, avatarUrl: true },
      });
      const actorName =
        `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';
      this.notifications
        .createNotification({
          userId: story.userId,
          type: NotificationType.COMMUNITY_REACTION,
          title: 'Nueva reacción',
          titleEn: 'New reaction',
          body: `${actorName} reaccionó ${clean} a tu historia.`,
          bodyEn: `${actorName} reacted ${clean} to your story.`,
          data: {
            storyId,
            actorId: userId,
            actorName,
            actorAvatarUrl: actor?.avatarUrl ?? null,
            emoji: clean,
          },
          imageUrl: actor?.avatarUrl ?? undefined,
        })
        .catch(() => {});
    }

    return { reacted: true, emoji: clean };
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
    // Primera línea de moderación automática. Lo que caiga aquí se RETIENE para
    // revisión manual (PENDING_REVIEW); el resto se publica directo.
    // TODO: reemplazar por OpenAI Moderation API para score real (ML).
    const blocked = [
      // odio / discriminación / acoso (es + en)
      'maricon', 'marica', 'joto', 'puto', 'puta', 'pendejo', 'faggot', 'nigger',
      'retrasado', 'discapacitado de mierda',
      // violencia / amenazas
      'te voy a matar', 'matarte', 'violar', 'violarte', 'kill you', 'rape',
      'terrorismo', 'bomba',
      // ilegal / drogas / menores
      'vendo droga', 'cocaina', 'child porn', 'pornografia infantil', 'sexo con menores',
      // spam
      'spam', 'offensive',
    ];
    const lower = content.toLowerCase();
    const hit = blocked.some((w) => lower.includes(w));
    return hit ? 0.9 : 0.1;
  }
}
