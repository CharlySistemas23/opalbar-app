import {
  BadRequestException, ForbiddenException,
  Injectable, Logger, NotFoundException,
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
// Canonical "like" — the legacy Reaction(LIKE) table is no longer the source
// of truth; likes are the ❤️ emoji reaction so the feed has ONE counter.
export const LIKE_EMOJI = '❤️';

/** Strip the internal wall marker from a stored mediaUrls array. */
function publicMediaUrls(mediaUrls: string[] | null | undefined): string[] {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls.filter((u) => u && u !== WALL_MARKER);
}

/** Build the stored mediaUrls array (marker first for wall posts). */
function storedMediaUrls(urls: string[], isWall: boolean): string[] {
  const clean = urls.filter((u) => typeof u === 'string' && u.trim().length > 0 && u !== WALL_MARKER);
  return isWall ? [WALL_MARKER, ...clean] : clean;
}

const POST_SELECT_BASE = {
  id: true,
  userId: true,
  content: true,
  imageUrl: true,
  mediaUrls: true,
  commentsCount: true,
  status: true,
  rejectionReason: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      isPrivate: true,
      profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  _count: { select: { comments: { where: { deletedAt: null, status: PostStatus.PUBLISHED } } } },
  emojiReactions: { select: { emoji: true, userId: true } },
} as const;

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
  private readonly logger = new Logger(CommunityService.name);

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

  /**
   * Shape every post the same way for the feed + detail endpoints:
   *  · ONE like counter (`likesCount` = total emoji reactions, `hasLiked` = viewer ❤️)
   *  · `emojiReactions[{emoji,count,mine}]`
   *  · `commentsCount` (published, non-deleted comments)
   *  · `isSaved` for the viewer, `status`, `mediaUrls` (marker stripped),
   *    `author.isPrivate`, hydrated `mentions` (APPROVED) like comments.
   */
  private async decoratePosts(rows: any[], viewerId?: string): Promise<any[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);

    const [savedRows, mentionRows] = await Promise.all([
      viewerId
        ? this.prisma.savedItem.findMany({
            where: { userId: viewerId, type: 'POST', targetId: { in: ids } },
            select: { targetId: true },
          })
        : Promise.resolve([] as { targetId: string }[]),
      this.prisma.mention.findMany({
        where: { targetType: MentionTargetType.POST, targetId: { in: ids }, status: 'APPROVED' },
        select: {
          targetId: true,
          targetUserId: true,
          x: true,
          y: true,
          targetUser: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
      }),
    ]);
    const savedSet = new Set(savedRows.map((s) => s.targetId));
    const mentionsByPost = new Map<string, any[]>();
    for (const m of mentionRows) {
      const arr = mentionsByPost.get(m.targetId) ?? [];
      arr.push({
        userId: m.targetUserId,
        firstName: m.targetUser?.profile?.firstName ?? null,
        lastName: m.targetUser?.profile?.lastName ?? null,
        avatarUrl: m.targetUser?.profile?.avatarUrl ?? null,
        x: m.x,
        y: m.y,
      });
      mentionsByPost.set(m.targetId, arr);
    }

    return rows.map((p) => {
      const emojiRows: Array<{ emoji: string; userId: string }> = Array.isArray(p.emojiReactions)
        ? p.emojiReactions
        : [];
      const emojiReactions = aggregateEmojiReactions(emojiRows, viewerId);
      const likesCount = emojiRows.length;
      const hasLiked = !!viewerId && emojiRows.some((r) => r.userId === viewerId && r.emoji === LIKE_EMOJI);
      const myEmoji = viewerId ? emojiRows.find((r) => r.userId === viewerId)?.emoji ?? null : null;
      const mediaUrls = publicMediaUrls(p.mediaUrls);
      // `moderationScore` / `deletedAt` are selected so the caller can run its
      // own visibility check — they must never reach a public response.
      const { _count, reactions: _r, moderationScore: _ms, deletedAt: _da, ...rest } = p;
      return {
        ...rest,
        imageUrl: p.imageUrl ?? mediaUrls[0] ?? null,
        mediaUrls,
        surface: Array.isArray(p.mediaUrls) && p.mediaUrls.includes(WALL_MARKER) ? PostSurface.WALL : PostSurface.COMMUNITY,
        likesCount,
        hasLiked,
        hasReacted: hasLiked,
        myEmoji,
        emojiReactions,
        commentsCount: typeof _count?.comments === 'number' ? _count.comments : p.commentsCount ?? 0,
        isSaved: savedSet.has(p.id),
        author: {
          id: p.user?.id ?? p.userId,
          isPrivate: !!p.user?.isPrivate,
          firstName: p.user?.profile?.firstName ?? null,
          lastName: p.user?.profile?.lastName ?? null,
          avatarUrl: p.user?.profile?.avatarUrl ?? null,
        },
        mentions: mentionsByPost.get(p.id) ?? [],
      };
    });
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
          select: POST_SELECT_BASE,
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.post.count({ where }),
      ]);

      const decorated = await this.decoratePosts(data as any[], currentUserId);
      return paginate(decorated, total, page, limit);
    });
  }

  async getPost(id: string, currentUserId?: string) {
    // Viewer-specific cache so hasReacted reflects the logged-in user
    const key = RedisService.cacheKey('community', 'post', id, currentUserId ?? 'anon');
    return this.redis.cacheWrap(key, CACHE_TTL_POST, async () => {
      const post = await this.prisma.post.findUnique({
        where: { id },
        // Audit fix: traer isPrivate del autor para chequear acceso antes de
        // devolver el detalle. Antes el endpoint @Public devolvia cualquier
        // post si conocias el id (enumeracion).
        select: { ...POST_SELECT_BASE, deletedAt: true, moderationScore: true },
      });
      if (!post || post.deletedAt) throw new NotFoundException('Post not found');
      // Non-published posts are only visible to their owner (and staff via admin).
      if (post.status !== PostStatus.PUBLISHED && post.userId !== currentUserId) {
        throw new NotFoundException('Post not found');
      }

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
      const [decorated] = await this.decoratePosts([post], currentUserId);
      return decorated;
    });
  }

  async createPost(userId: string, dto: CreatePostDto) {
    // Post-moderation: los posts se publican de inmediato (sin esperar aprobación).
    // El filtro automático solo RETIENE para revisión manual el contenido
    // potencialmente objetable (score alto). El admin puede verificar, ocultar o
    // eliminar cualquier post después desde el panel. Esto cumple la 1.2 de Apple
    // (filtro de contenido objetable + moderación) sin bloquear la experiencia.
    const content = typeof dto.content === 'string' ? dto.content.trim() : '';
    // Media: prefer the explicit array; fall back to the legacy single imageUrl.
    const media = Array.isArray(dto.mediaUrls) && dto.mediaUrls.length > 0
      ? dto.mediaUrls
      : dto.imageUrl
        ? [dto.imageUrl]
        : [];
    const cleanMedia = media.filter((u) => typeof u === 'string' && u.trim().length > 0 && u !== WALL_MARKER);
    if (!content && cleanMedia.length === 0) {
      throw new BadRequestException('Post needs text or at least one image');
    }

    const moderationScore = this.basicModerationCheck(content);
    const status =
      moderationScore >= 0.5 ? PostStatus.PENDING_REVIEW : PostStatus.PUBLISHED;

    const isWallPost = dto.surface === PostSurface.WALL;

    const created = await this.prisma.post.create({
      data: {
        userId,
        content,
        // Backward compat: imageUrl mirrors the first media item.
        imageUrl: cleanMedia[0] ?? null,
        mediaUrls: storedMediaUrls(cleanMedia, isWallPost),
        status,
        moderationScore,
      },
    });
    const post = { ...created, mediaUrls: publicMediaUrls(created.mediaUrls) };

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
        .catch((err) => this.logger.warn(`applyMentions failed for post ${post.id}: ${err?.message ?? err}`));
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

    const isWallPost = post.mediaUrls.includes(WALL_MARKER);
    const nextContent = dto.content !== undefined ? dto.content.trim() : post.content;
    let nextMedia = publicMediaUrls(post.mediaUrls);
    if (dto.mediaUrls !== undefined) {
      nextMedia = dto.mediaUrls.filter((u) => typeof u === 'string' && u.trim().length > 0 && u !== WALL_MARKER);
    } else if (dto.imageUrl !== undefined) {
      nextMedia = dto.imageUrl ? [dto.imageUrl, ...nextMedia.slice(1)] : nextMedia.slice(1);
    }
    if (!nextContent && nextMedia.length === 0) {
      throw new BadRequestException('Post needs text or at least one image');
    }

    // Re-run moderation on the edited text. A previously rejected/hidden post
    // stays that way (only staff can lift it); otherwise the new score decides.
    const moderationScore = this.basicModerationCheck(nextContent);
    const locked = post.status === PostStatus.REJECTED || post.status === PostStatus.HIDDEN || post.status === PostStatus.DELETED;
    const status = locked
      ? post.status
      : moderationScore >= 0.5
        ? PostStatus.PENDING_REVIEW
        : PostStatus.PUBLISHED;

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: nextContent,
        imageUrl: nextMedia[0] ?? null,
        mediaUrls: storedMediaUrls(nextMedia, isWallPost),
        moderationScore,
        status,
      },
    });

    if (dto.mentions !== undefined) {
      // Replace the mention set: drop the ones no longer present, add new ones
      // (applyMentions skips duplicates, so existing approvals are preserved).
      const keep = new Set(dto.mentions.map((m) => m.userId));
      await this.prisma.mention.deleteMany({
        where: {
          targetType: MentionTargetType.POST,
          targetId: postId,
          ...(keep.size > 0 ? { targetUserId: { notIn: Array.from(keep) } } : {}),
        },
      });
      if (dto.mentions.length > 0) {
        this.mentions
          .applyMentions({
            authorId: userId,
            targetType: MentionTargetType.POST,
            targetId: postId,
            mentions: dto.mentions,
          })
          .catch((err) => this.logger.warn(`applyMentions failed for post ${postId}: ${err?.message ?? err}`));
      }
    }

    await this.invalidateFeed();
    this.communityGateway.emitChanged({ type: 'post_updated', postId });
    this.realtime.broadcast('post', 'updated', { id: postId });
    return { ...updated, mediaUrls: publicMediaUrls(updated.mediaUrls) };
  }

  async deletePost(postId: string, userId: string, role?: UserRole) {
    // Owners can delete their own posts; staff (ADMIN/SUPER_ADMIN/MODERATOR)
    // can delete any post from the same endpoint the client uses.
    const isStaff = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR';
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post no encontrado');
    if (!isStaff && post.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }
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

    // Same auto-moderation as posts: flagged comments are held for review
    // (hidden from the thread) instead of being published.
    const moderationScore = this.basicModerationCheck(dto.content);
    const flagged = moderationScore >= 0.5;
    const commentStatus = flagged ? PostStatus.PENDING_REVIEW : PostStatus.PUBLISHED;

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: { postId, userId, content: dto.content, parentId: dto.parentId, status: commentStatus },
      }),
      ...(flagged
        ? []
        : [
            this.prisma.post.update({
              where: { id: postId },
              data: { commentsCount: { increment: 1 } },
            }),
          ]),
    ]);

    await this.invalidatePostCache(postId);

    if (flagged) {
      // Don't fan out notifications / realtime for held comments; the author
      // gets the status back so the client can explain "en revisión".
      return comment;
    }

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
        .catch((err) => this.logger.warn(`applyMentions failed for comment ${comment.id}: ${err?.message ?? err}`));
    }

    return comment;
  }

  async updateComment(commentId: string, userId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not authorized');
    const moderationScore = this.basicModerationCheck(content);
    const locked = comment.status === PostStatus.REJECTED || comment.status === PostStatus.HIDDEN;
    const status = locked
      ? comment.status
      : moderationScore >= 0.5
        ? PostStatus.PENDING_REVIEW
        : PostStatus.PUBLISHED;
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content, status },
    });
    await this.invalidatePostCache(comment.postId);
    this.communityGateway.emitChanged({
      type: 'comment_updated',
      postId: comment.postId,
      commentId,
    });
    this.realtime.broadcast('comment', 'updated', { id: commentId, data: { postId: comment.postId } });
    return updated;
  }

  async deleteComment(commentId: string, userId: string, role?: UserRole) {
    // Same policy as deletePost: owner or staff.
    const isStaff = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MODERATOR';
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comentario no encontrado');
    if (!isStaff && comment.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    await this.prisma.$transaction([
      this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      ...(comment.status === PostStatus.PUBLISHED
        ? [this.prisma.post.update({ where: { id: comment.postId }, data: { commentsCount: { decrement: 1 } } })]
        : []),
    ]);
    await this.invalidatePostCache(comment.postId);
    this.communityGateway.emitChanged({
      type: 'comment_deleted',
      postId: comment.postId,
      commentId,
    });
    this.realtime.broadcast('comment', 'deleted', { id: commentId, data: { postId: comment.postId } });
  }

  // ── REACTIONS ─────────────────────────────

  /**
   * Legacy typed reaction endpoint. The like system is unified: every type
   * maps to an emoji reaction (LIKE → ❤️) so the feed has ONE counter.
   */
  async reactToPost(postId: string, userId: string, dto: ReactDto) {
    const emojiByType: Record<string, string> = {
      LIKE: LIKE_EMOJI,
      LOVE: LIKE_EMOJI,
      FIRE: '🔥',
      CHEER: '🥂',
      SAD: '😢',
    };
    const emoji = emojiByType[dto.type] ?? LIKE_EMOJI;
    const res = await this.togglePostEmojiReaction(postId, userId, emoji);
    return { reacted: res.reacted, type: dto.type, emoji: res.emoji, likesCount: res.likesCount };
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
      const likesCount = await this.syncLikesCount(postId);
      await this.invalidatePostCache(postId);
      this.communityGateway.emitChanged({ type: 'post_reacted', postId });
      this.realtime.broadcast('post', 'reacted', { id: postId, data: { userId, emoji: clean, reacted: false, likesCount } });
      return { reacted: false, emoji: clean, likesCount };
    }

    // Drop any prior emoji from this user, then add the new one.
    if (mine.length > 0) {
      await this.prisma.postEmojiReaction.deleteMany({
        where: { id: { in: mine.map((r) => r.id) } },
      });
    }

    await this.prisma.postEmojiReaction.create({ data: { postId, userId, emoji: clean } });
    const likesCount = await this.syncLikesCount(postId);
    await this.invalidatePostCache(postId);
    this.communityGateway.emitChanged({ type: 'post_reacted', postId });
    this.realtime.broadcast('post', 'reacted', { id: postId, data: { userId, emoji: clean, reacted: true, likesCount } });

    // Swapping emoji shouldn't re-notify the author.
    if (post.userId !== userId && mine.length === 0) {
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

    return { reacted: true, emoji: clean, likesCount };
  }

  /** Keep the denormalised Post.likesCount in sync with emoji reactions
   * (admin panel + ranking still read the column). */
  private async syncLikesCount(postId: string): Promise<number> {
    const likesCount = await this.prisma.postEmojiReaction.count({ where: { postId } });
    await this.prisma.post.update({ where: { id: postId }, data: { likesCount } }).catch(() => undefined);
    return likesCount;
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
      data: {
        reporterId,
        targetType,
        targetId,
        reason: dto.reason,
        description: dto.description,
        // Typed FK column matching the target kind (see Report in schema.prisma).
        ...(targetType === ReportTargetType.POST ? { reportedPostId: targetId } : {}),
        ...(targetType === ReportTargetType.COMMENT ? { reportedCommentId: targetId } : {}),
        ...(targetType === ReportTargetType.USER ? { reportedUserId: targetId } : {}),
      },
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

    const viewerInclude = this.storyViewerInclude(currentUserId);
    const [venueRows, personalRows] = await Promise.all([
      this.prisma.story.findMany({
        where: { scope: StoryScope.VENUE, expiresAt: { gt: now } },
        orderBy: { createdAt: 'asc' },
        include: viewerInclude,
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
              ...viewerInclude,
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
      const stories = venueRows.map((s) => this.shapeStory(s));
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
      const shaped = this.shapeStory(s);
      entry.stories.push(shaped);
      if (!shaped.seen) entry.hasUnseen = true;
      byAuthor.set(s.userId, entry);
    }
    const personal = Array.from(byAuthor.values()).sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return 0;
    });

    return { venue, personal };
  }

  /**
   * Viewer-relative relations for a story row: whether the viewer has seen it
   * and which emojis they reacted with. Anonymous viewers get neither.
   */
  private storyViewerInclude(currentUserId?: string) {
    return {
      views: currentUserId
        ? { where: { userId: currentUserId }, select: { id: true } }
        : false,
      reactions: currentUserId
        ? { where: { userId: currentUserId }, select: { emoji: true } }
        : false,
    } as const;
  }

  private shapeStory(s: {
    id: string;
    userId: string;
    mediaUrl: string;
    caption: string | null;
    viewsCount: number;
    createdAt: Date;
    expiresAt: Date;
    scope: StoryScope;
    views?: { id: string }[] | false;
    reactions?: { emoji: string }[] | false;
  }) {
    const seen = Array.isArray(s.views) && s.views.length > 0;
    const myReactions = Array.isArray(s.reactions) ? s.reactions.map((r) => r.emoji) : [];
    return {
      id: s.id,
      userId: s.userId,
      mediaUrl: s.mediaUrl,
      caption: s.caption,
      viewsCount: s.viewsCount,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      scope: s.scope,
      seen,
      myReactions,
    };
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
        ...this.storyViewerInclude(currentUserId),
      },
    });
    if (rows.length === 0) return { user: null, stories: [], hasUnseen: false };
    const stories = rows.map((s) => this.shapeStory(s));
    return { user: rows[0].user, stories, hasUnseen: stories.some((s) => !s.seen) };
  }

  /**
   * Who has seen a story. Owner only (like Instagram) — venue stories are
   * readable by staff since they're the de-facto owners.
   */
  async getStoryViewers(storyId: string, requester: { id: string; role: UserRole }) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, userId: true, scope: true, viewsCount: true },
    });
    if (!story) throw new NotFoundException('Story not found');
    const isOwner = story.userId === requester.id;
    const isStaff = ADMIN_ROLES.includes(requester.role);
    if (!isOwner && !(story.scope === StoryScope.VENUE && isStaff)) {
      throw new ForbiddenException('Not your story');
    }
    const [views, reactions] = await Promise.all([
      this.prisma.storyView.findMany({
        where: { storyId },
        orderBy: { viewedAt: 'desc' },
        take: 500,
        select: {
          viewedAt: true,
          user: {
            select: {
              id: true,
              profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.storyReaction.findMany({
        where: { storyId },
        select: { userId: true, emoji: true },
      }),
    ]);
    const reactionsByUser = new Map<string, string[]>();
    for (const r of reactions) {
      const list = reactionsByUser.get(r.userId) ?? [];
      list.push(r.emoji);
      reactionsByUser.set(r.userId, list);
    }
    return {
      total: story.viewsCount,
      viewers: views.map((v) => ({
        id: v.user.id,
        firstName: v.user.profile?.firstName ?? null,
        lastName: v.user.profile?.lastName ?? null,
        avatarUrl: v.user.profile?.avatarUrl ?? null,
        viewedAt: v.viewedAt,
        reactions: reactionsByUser.get(v.user.id) ?? [],
      })),
    };
  }

  async createStory(
    userId: string,
    dto: CreateStoryDto,
    scope: StoryScope = StoryScope.PERSONAL,
  ) {
    if (!dto.mediaUrl) throw new BadRequestException('mediaUrl is required');
    // Stories have no review queue (24h lifetime), so a flagged caption is
    // rejected outright instead of being held.
    const caption = dto.caption?.trim() || null;
    if (caption && this.basicModerationCheck(caption) >= 0.5) {
      throw new BadRequestException('Caption violates community guidelines');
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaUrl: dto.mediaUrl,
        caption,
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
        .catch((err) => this.logger.warn(`applyMentions(story ${story.id}) failed: ${err?.message ?? err}`));
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
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (!story) throw new NotFoundException('Story not found');
    // Own views and views of expired stories don't count (would inflate
    // viewsCount every time the owner previews their own story).
    if (story.userId === userId) return { success: true, counted: false };
    if (story.expiresAt.getTime() <= Date.now()) return { success: true, counted: false };

    // Idempotent — unique constraint on (storyId, userId). Only the first
    // insert bumps the counter.
    const existing = await this.prisma.storyView.findUnique({
      where: { storyId_userId: { storyId, userId } },
      select: { id: true },
    });
    if (existing) return { success: true, counted: false };
    try {
      await this.prisma.storyView.create({ data: { storyId, userId } });
    } catch (err: any) {
      // P2002 = concurrent duplicate insert (double-tap) — already counted.
      if (err?.code === 'P2002') return { success: true, counted: false };
      throw err;
    }
    await this.prisma.story.update({
      where: { id: storyId },
      data: { viewsCount: { increment: 1 } },
    });
    return { success: true, counted: true };
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

  private basicModerationCheck(content: string | null | undefined): number {
    // Primera línea de moderación automática. Lo que caiga aquí se RETIENE para
    // revisión manual (PENDING_REVIEW); el resto se publica directo.
    // Word-boundary matching (no substring hits: "disputa" ≠ "puta",
    // "computadora" ≠ "puta", "bombardeo" ≠ "bomba").
    // TODO: reemplazar por OpenAI Moderation API para score real (ML).
    if (!content) return 0.1;
    const normalized = content
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_MARKS, '');
    const hit = BLOCKED_TERMS.some((re) => re.test(normalized));
    return hit ? 0.9 : 0.1;
  }
}

const BLOCKED_PHRASES = [
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

// U+0300..U+036F = combining diacritical marks (left after NFD decomposition).
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

// Pre-compiled once. `\b` doesn't understand accented letters, so the input is
// stripped of diacritics before matching (see basicModerationCheck).
const BLOCKED_TERMS: RegExp[] = BLOCKED_PHRASES.map((p) => {
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
});
