import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MentionPolicy,
  MentionStatus,
  MentionTargetType,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FriendshipsService } from '../friendships/friendships.service';

// ─────────────────────────────────────────────
//  MentionsService — polymorphic tagging across posts & stories
//  · `applyMentions(...)` is called by community.service after a post/story
//    is created. It dedupes, validates the target users' MentionPolicy,
//    creates Mention rows (APPROVED or PENDING), and sends notifications.
//  · `listTaggedFeed(...)` powers the "Etiquetado en" tab on the user
//    profile.
//  · `listPendingApprovals(...)` powers the approval inbox screen.
// ─────────────────────────────────────────────

export type MentionInput = { userId: string; x?: number | null; y?: number | null };

@Injectable()
export class MentionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly friendships: FriendshipsService,
  ) {}

  /**
   * Persist mentions for a freshly-created post/story.
   * Called from CommunityService.createPost / createStory.
   *
   * Caller passes the author + the raw mentions array from the DTO. We:
   *   1. Drop self-mentions and duplicates
   *   2. Look up each target's mentionPolicy
   *   3. Decide APPROVED vs PENDING vs reject (silently drop)
   *   4. Bulk-insert mentions; notify the relevant users
   */
  async applyMentions(opts: {
    authorId: string;
    targetType: MentionTargetType;
    targetId: string;
    mentions: MentionInput[];
  }) {
    const { authorId, targetType, targetId, mentions } = opts;
    if (!mentions || mentions.length === 0) return [];

    // Dedupe by userId and drop self-mention.
    const byId = new Map<string, MentionInput>();
    for (const m of mentions) {
      if (!m.userId || m.userId === authorId) continue;
      if (!byId.has(m.userId)) byId.set(m.userId, m);
    }
    if (byId.size === 0) return [];

    const targetUserIds = Array.from(byId.keys());
    const targets = await this.prisma.user.findMany({
      where: { id: { in: targetUserIds }, deletedAt: null },
      select: { id: true, mentionPolicy: true },
    });
    const targetMap = new Map(targets.map((t) => [t.id, t]));

    // Friendship sets for FRIENDS_OF_FRIENDS / FRIENDS_ONLY checks.
    // Cache author's friends once instead of per-mention.
    let authorFriendIds: Set<string> | null = null;
    const ensureAuthorFriends = async () => {
      if (authorFriendIds) return authorFriendIds;
      const ids = await this.friendships.getFriendIds(authorId);
      authorFriendIds = new Set(ids);
      return authorFriendIds;
    };

    type Decided = MentionInput & { status: MentionStatus };
    const decided: Decided[] = [];

    for (const userId of targetUserIds) {
      const target = targetMap.get(userId);
      if (!target) continue; // user gone / soft-deleted — silently drop
      const policy = target.mentionPolicy;
      const input = byId.get(userId)!;

      if (policy === MentionPolicy.NONE) continue; // silently drop
      if (policy === MentionPolicy.EVERYONE) {
        decided.push({ ...input, status: MentionStatus.APPROVED });
        continue;
      }

      // FRIENDS_ONLY → must already be friends; otherwise drop.
      if (policy === MentionPolicy.FRIENDS_ONLY) {
        const friends = await ensureAuthorFriends();
        if (friends.has(userId)) {
          decided.push({ ...input, status: MentionStatus.APPROVED });
        } else {
          decided.push({ ...input, status: MentionStatus.PENDING });
        }
        continue;
      }

      // FRIENDS_OF_FRIENDS → friend = APPROVED, mutual friend exists = PENDING,
      // otherwise drop. This keeps strangers out without surprising the target.
      if (policy === MentionPolicy.FRIENDS_OF_FRIENDS) {
        const friends = await ensureAuthorFriends();
        if (friends.has(userId)) {
          decided.push({ ...input, status: MentionStatus.APPROVED });
        } else {
          const mutuals = await this.friendships.countMutualFriends(authorId, userId);
          if (mutuals > 0) {
            decided.push({ ...input, status: MentionStatus.PENDING });
          }
        }
      }
    }

    if (decided.length === 0) return [];

    // Bulk insert; rely on @@unique([targetType, targetId, targetUserId]) to
    // avoid duplicates if applyMentions is ever called twice for the same item.
    await this.prisma.mention.createMany({
      data: decided.map((d) => ({
        targetType,
        targetId,
        targetUserId: d.userId,
        authorId,
        status: d.status,
        x: d.x ?? null,
        y: d.y ?? null,
      })),
      skipDuplicates: true,
    });

    // Re-read so we have the inserted ids for notification payloads.
    const created = await this.prisma.mention.findMany({
      where: {
        targetType,
        targetId,
        targetUserId: { in: decided.map((d) => d.userId) },
      },
    });

    this.notifyTargets(authorId, targetType, targetId, created).catch(() => {});

    return created;
  }

  private async notifyTargets(
    authorId: string,
    targetType: MentionTargetType,
    targetId: string,
    mentions: { id: string; targetUserId: string; status: MentionStatus }[],
  ) {
    if (mentions.length === 0) return;
    const actor = await this.prisma.userProfile.findUnique({
      where: { userId: authorId },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    const actorName = `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';

    const isPost = targetType === MentionTargetType.POST;
    const approvedType = isPost ? NotificationType.POST_MENTION : NotificationType.STORY_MENTION;
    const pendingType = NotificationType.MENTION_APPROVAL_NEEDED;

    for (const m of mentions) {
      const isApproved = m.status === MentionStatus.APPROVED;
      const type = isApproved ? approvedType : pendingType;

      const title = isApproved
        ? isPost
          ? 'Te etiquetaron en una publicación'
          : 'Te etiquetaron en una historia'
        : 'Solicitud de etiqueta';
      const titleEn = isApproved
        ? isPost
          ? 'You were tagged in a post'
          : 'You were tagged in a story'
        : 'Tag request';
      const body = isApproved
        ? `${actorName} te etiquetó.`
        : `${actorName} quiere etiquetarte. Aprueba para que sea visible.`;
      const bodyEn = isApproved
        ? `${actorName} tagged you.`
        : `${actorName} wants to tag you. Approve to make it visible.`;

      this.notifications
        .createNotification({
          userId: m.targetUserId,
          type,
          title,
          titleEn,
          body,
          bodyEn,
          data: {
            actorId: authorId,
            actorName,
            actorAvatarUrl: actor?.avatarUrl ?? null,
            mentionId: m.id,
            targetType,
            targetId,
          },
        })
        .catch(() => {});

      this.realtime.toUser(m.targetUserId, 'mention', isApproved ? 'created' : 'pending', {
        id: m.id,
        data: { targetType, targetId, by: authorId },
      });
    }
  }

  // ─────────────────────────────────────────────
  //  APPROVAL FLOW (target user moderates pending mentions)
  // ─────────────────────────────────────────────

  async approveMention(meId: string, mentionId: string) {
    const m = await this.prisma.mention.findUnique({ where: { id: mentionId } });
    if (!m) throw new NotFoundException('Mention not found');
    if (m.targetUserId !== meId) throw new ForbiddenException('Not your mention');
    if (m.status === MentionStatus.APPROVED) return m;
    const updated = await this.prisma.mention.update({
      where: { id: mentionId },
      data: { status: MentionStatus.APPROVED },
    });
    this.realtime.toUser(meId, 'mention', 'approved', { id: mentionId });
    return updated;
  }

  async rejectMention(meId: string, mentionId: string) {
    const m = await this.prisma.mention.findUnique({ where: { id: mentionId } });
    if (!m) throw new NotFoundException('Mention not found');
    if (m.targetUserId !== meId) throw new ForbiddenException('Not your mention');
    // Reject is destructive for stories (caption-only mention) but reversible
    // for posts (the post itself remains). Set status REJECTED so we keep an
    // audit trail and the author can't silently re-tag the same item.
    const updated = await this.prisma.mention.update({
      where: { id: mentionId },
      data: { status: MentionStatus.REJECTED },
    });
    this.realtime.toUser(meId, 'mention', 'rejected', { id: mentionId });
    return updated;
  }

  /** Author or target user removes an existing tag. */
  async removeMention(meId: string, mentionId: string) {
    const m = await this.prisma.mention.findUnique({ where: { id: mentionId } });
    if (!m) throw new NotFoundException('Mention not found');
    const isAuthor = m.authorId === meId;
    const isTarget = m.targetUserId === meId;
    if (!isAuthor && !isTarget) throw new ForbiddenException('Not your mention');
    await this.prisma.mention.delete({ where: { id: mentionId } });
    this.realtime.toUsers([m.authorId, m.targetUserId], 'mention', 'deleted', { id: mentionId });
    return { ok: true };
  }

  // ─────────────────────────────────────────────
  //  LISTS
  // ─────────────────────────────────────────────

  /** Pending tag requests waiting for my decision. */
  async listPendingApprovals(meId: string, limit = 50) {
    const rows = await this.prisma.mention.findMany({
      where: { targetUserId: meId, status: MentionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        author: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
    return rows;
  }

  async pendingCount(meId: string) {
    const n = await this.prisma.mention.count({
      where: { targetUserId: meId, status: MentionStatus.PENDING },
    });
    return { count: n };
  }

  /**
   * "Etiquetado en" feed for a user profile.
   * Returns approved mentions hydrated with the underlying post/story.
   * Only the target user themselves can see PENDING (everyone else sees APPROVED only).
   */
  async listTaggedFeed(subjectUserId: string, viewerId: string | undefined, limit = 30) {
    const showPending = viewerId === subjectUserId;
    const rows = await this.prisma.mention.findMany({
      where: {
        targetUserId: subjectUserId,
        status: showPending
          ? { in: [MentionStatus.APPROVED, MentionStatus.PENDING] }
          : MentionStatus.APPROVED,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 60),
    });

    // Hydrate posts and stories in two queries (cheaper than per-row fetch).
    const postIds = rows.filter((r) => r.targetType === MentionTargetType.POST).map((r) => r.targetId);
    const storyIds = rows.filter((r) => r.targetType === MentionTargetType.STORY).map((r) => r.targetId);

    const [posts, stories] = await Promise.all([
      postIds.length
        ? this.prisma.post.findMany({
            where: { id: { in: postIds }, deletedAt: null },
            select: {
              id: true, content: true, imageUrl: true, createdAt: true, userId: true,
              user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
              _count: { select: { reactions: true, comments: true } },
            },
          })
        : Promise.resolve([] as any[]),
      storyIds.length
        ? this.prisma.story.findMany({
            where: { id: { in: storyIds }, expiresAt: { gt: new Date() } },
            select: {
              id: true, mediaUrl: true, caption: true, createdAt: true, expiresAt: true, userId: true,
              user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            },
          })
        : Promise.resolve([] as any[]),
    ]);
    const postMap = new Map(posts.map((p) => [p.id, p]));
    const storyMap = new Map(stories.map((s) => [s.id, s]));

    return rows
      .map((r) => {
        const item = r.targetType === MentionTargetType.POST ? postMap.get(r.targetId) : storyMap.get(r.targetId);
        if (!item) return null;
        return {
          mentionId: r.id,
          targetType: r.targetType,
          status: r.status,
          x: r.x,
          y: r.y,
          createdAt: r.createdAt,
          item,
        };
      })
      .filter(Boolean);
  }

  /** Mentions on a single post/story, used to render face-tag overlays. */
  async listForTarget(targetType: MentionTargetType, targetId: string) {
    return this.prisma.mention.findMany({
      where: { targetType, targetId, status: MentionStatus.APPROVED },
      include: {
        targetUser: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  //  PRIVACY
  // ─────────────────────────────────────────────

  async updateMentionPolicy(userId: string, policy: MentionPolicy) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { mentionPolicy: policy },
      select: { id: true, mentionPolicy: true },
    });
  }
}
