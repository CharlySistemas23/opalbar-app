import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendPolicy, FriendshipStatus, MessageThreadStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '../../common/dto/pagination.dto';

const NEW_ACCOUNT_DAYS = 7;

const USER_BASIC_SELECT = {
  id: true,
  isPrivate: true,
  profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
} as const;

export type FriendshipContext = {
  status: 'self' | 'none' | 'outgoing' | 'incoming' | 'accepted' | 'blocked';
  isFriend: boolean;
  mutualCount: number;
  friendshipId: string | null;
  /** true when the viewer is the one who blocked the subject. */
  blockedByMe: boolean;
  /** true when a BLOCKED row exists in either direction. */
  isBlocked: boolean;
};

@Injectable()
export class FriendshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────

  /** Find an existing friendship row in either direction. */
  private async findPair(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  }

  /**
   * Heuristic to land a request in "Filtradas" instead of "Principales".
   * Mirrors the IG/FB approach: low-trust signals push the request out of the
   * recipient's main inbox so legit requests stay visible.
   *
   * Calibration matters here. The original rule filtered on ANY of {no avatar,
   * account < 7d, 0 mutual friends} — in a young network nobody has mutuals
   * yet, so *every* genuine request was hidden in a secondary tab and users
   * reported that friend requests "never arrive". Now only the combination of
   * throwaway-account signals filters:
   *
   *   · brand-new account (< 7 days) AND no avatar        → filtered
   *   · brand-new account (< 7 days) AND 0 mutual friends
   *     AND the recipient does not follow them            → filtered
   *
   * An established account is never filtered, and a request from someone the
   * recipient already follows always reaches the main inbox.
   */
  private async shouldFilter(senderId: string, recipientId: string): Promise<boolean> {
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: {
        createdAt: true,
        profile: { select: { avatarUrl: true } },
      },
    });
    if (!sender) return true;

    const ageMs = Date.now() - sender.createdAt.getTime();
    const isNewAccount = ageMs < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
    if (!isNewAccount) return false;

    if (!sender.profile?.avatarUrl) return true;

    // A new account the recipient already follows is clearly wanted contact.
    const followed = await this.prisma.follow.findFirst({
      where: { followerId: recipientId, followingId: senderId },
      select: { id: true },
    });
    if (followed) return false;

    const mutuals = await this.countMutualFriends(senderId, recipientId);
    return mutuals === 0;
  }

  /** True when a BLOCKED friendship row exists in either direction. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    if (!a || !b || a === b) return false;
    const row = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.BLOCKED,
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
      select: { id: true },
    });
    return !!row;
  }

  /** Ids of users involved in a BLOCKED row with `userId` (either direction). */
  async getBlockedIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.BLOCKED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  }

  /**
   * Remove the FRIEND_REQUEST notification that was created for `recipientId`
   * when `friendshipId` was requested. Used on cancel/decline/block so the
   * recipient's inbox doesn't keep a dead "wants to be your friend" card.
   */
  private async deleteRequestNotification(recipientId: string, friendshipId: string) {
    try {
      await this.prisma.notification.deleteMany({
        where: {
          userId: recipientId,
          type: NotificationType.FRIEND_REQUEST,
          data: { path: ['friendshipId'], equals: friendshipId } as any,
        },
      });
    } catch {
      // Best-effort cleanup — never fail the main action because of it.
    }
  }

  /** Return the set of accepted-friend userIds for a given user. */
  async getFriendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  }

  /** Count of mutual accepted friends between two users. */
  async countMutualFriends(a: string, b: string): Promise<number> {
    const [aFriends, bFriends] = await Promise.all([
      this.getFriendIds(a),
      this.getFriendIds(b),
    ]);
    const set = new Set(aFriends);
    let n = 0;
    for (const id of bFriends) if (set.has(id)) n++;
    return n;
  }

  /**
   * Public-profile context: returns the friendship state between viewer and
   * subject, used by users.service.getPublicProfile() so the mobile UI can
   * render the right CTA (Add / Pending / Friends / Accept).
   */
  async getProfileContext(viewerId: string, subjectId: string): Promise<FriendshipContext> {
    const base = { isFriend: false, friendshipId: null, blockedByMe: false, isBlocked: false };
    if (viewerId === subjectId) {
      return { ...base, status: 'self', mutualCount: 0 };
    }
    const fs = await this.findPair(viewerId, subjectId);
    if (fs && fs.status === FriendshipStatus.BLOCKED) {
      // No mutual count for blocked pairs — nothing about the relationship
      // should leak either way.
      return {
        ...base,
        status: 'blocked',
        mutualCount: 0,
        friendshipId: fs.id,
        isBlocked: true,
        blockedByMe: fs.requesterId === viewerId,
      };
    }
    const mutualCount = await this.countMutualFriends(viewerId, subjectId);

    if (!fs) {
      return { ...base, status: 'none', mutualCount };
    }
    if (fs.status === FriendshipStatus.ACCEPTED) {
      return { ...base, status: 'accepted', isFriend: true, mutualCount, friendshipId: fs.id };
    }
    if (fs.status === FriendshipStatus.PENDING) {
      return {
        ...base,
        status: fs.requesterId === viewerId ? 'outgoing' : 'incoming',
        mutualCount,
        friendshipId: fs.id,
      };
    }
    // DECLINED → from the requester's point of view it's simply "none" again
    // (they can re-request); the addressee never learns a decline happened.
    return { ...base, status: 'none', mutualCount };
  }

  // ─────────────────────────────────────────────
  //  ACTIONS
  // ─────────────────────────────────────────────

  async sendRequest(meId: string, otherId: string) {
    if (meId === otherId) throw new BadRequestException("Can't friend yourself");

    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, friendPolicy: true },
    });
    if (!other) throw new NotFoundException('User not found');

    if (other.friendPolicy === FriendPolicy.NONE) {
      throw new ForbiddenException('This user is not accepting friend requests');
    }
    if (other.friendPolicy === FriendPolicy.FRIENDS_OF_FRIENDS) {
      const mutuals = await this.countMutualFriends(meId, otherId);
      if (mutuals === 0) {
        throw new ForbiddenException('Only friends of friends can send a request');
      }
    }

    const existing = await this.findPair(meId, otherId);
    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        return { ok: true, status: 'accepted' as const, friendship: existing };
      }
      if (existing.status === FriendshipStatus.PENDING) {
        // If the OTHER party already requested me, treat send as accept.
        if (existing.requesterId === otherId) {
          return this.accept(meId, existing.id);
        }
        return { ok: true, status: 'outgoing' as const, friendship: existing };
      }
      if (existing.status === FriendshipStatus.BLOCKED) {
        throw new ForbiddenException('Cannot send a request');
      }
      // DECLINED → re-request: revive the same row, flip requester to me.
      // Behaves exactly like a fresh request (filter heuristic, notification,
      // realtime) so the addressee sees it again in their inbox.
      const filtered = await this.shouldFilter(meId, otherId);
      const revived = await this.prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: meId,
          addresseeId: otherId,
          status: FriendshipStatus.PENDING,
          filteredAt: filtered ? new Date() : null,
          declinedAt: null,
          acceptedAt: null,
          blockedAt: null,
        },
      });
      this.notifyRequest(meId, otherId, revived.id, filtered);
      this.emitFriendshipEvent([meId, otherId], 'requested', otherId, meId, revived.id);
      return { ok: true, status: 'outgoing' as const, friendship: revived };
    }

    const filtered = await this.shouldFilter(meId, otherId);
    let created;
    try {
      created = await this.prisma.friendship.create({
        data: {
          requesterId: meId,
          addresseeId: otherId,
          status: FriendshipStatus.PENDING,
          filteredAt: filtered ? new Date() : null,
        },
      });
    } catch (err: any) {
      // Race: two taps in flight → unique(requesterId, addresseeId) fires.
      // Re-read and return the current state instead of a 500.
      if (err?.code === 'P2002') {
        const row = await this.findPair(meId, otherId);
        if (row) {
          const status =
            row.status === FriendshipStatus.ACCEPTED
              ? ('accepted' as const)
              : row.requesterId === meId
                ? ('outgoing' as const)
                : ('incoming' as const);
          return { ok: true, status, friendship: row };
        }
      }
      throw err;
    }
    this.notifyRequest(meId, otherId, created.id, filtered);
    this.emitFriendshipEvent([meId, otherId], 'requested', otherId, meId, created.id);
    return { ok: true, status: 'outgoing' as const, friendship: created };
  }

  /**
   * Push a `user:updated` envelope with `{ friendship: <action> }` to both
   * parties so any screen subscribed via useRealtime('user') refreshes.
   */
  private emitFriendshipEvent(
    userIds: string[],
    action: 'requested' | 'accepted' | 'declined' | 'cancelled' | 'removed' | 'blocked' | 'unblocked',
    subjectId: string,
    by: string,
    friendshipId?: string | null,
  ) {
    this.realtime.toUsers(userIds, 'user', 'updated', {
      id: subjectId,
      data: { friendship: action, by, friendshipId: friendshipId ?? null, userIds },
    });
  }

  private async notifyRequest(senderId: string, recipientId: string, friendshipId: string, filtered: boolean) {
    // Filtered requests don't push — they sit silently in the secondary tab,
    // matching IG/FB. The recipient still sees a badge count when they open
    // the requests inbox.
    if (filtered) return;

    const actor = await this.prisma.userProfile.findUnique({
      where: { userId: senderId },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    const actorName = `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || 'Alguien';
    this.notifications
      .createNotification({
        userId: recipientId,
        type: NotificationType.FRIEND_REQUEST,
        title: 'Solicitud de amistad',
        titleEn: 'Friend request',
        body: `${actorName} quiere ser tu amigo.`,
        bodyEn: `${actorName} wants to be your friend.`,
        data: {
          actorId: senderId,
          actorName,
          actorAvatarUrl: actor?.avatarUrl ?? null,
          friendshipId,
        },
      })
      .catch(() => {});
  }

  async accept(meId: string, friendshipId: string) {
    const fs = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!fs) throw new NotFoundException('Friendship not found');
    if (fs.addresseeId !== meId) {
      throw new ForbiddenException('Only the addressee can accept');
    }
    if (fs.status === FriendshipStatus.ACCEPTED) {
      return { ok: true, status: 'accepted' as const, friendship: fs };
    }
    if (fs.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: FriendshipStatus.ACCEPTED,
        acceptedAt: new Date(),
        filteredAt: null,
      },
    });

    // Notify the requester that we accepted.
    const me = await this.prisma.userProfile.findUnique({
      where: { userId: meId },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    const myName = `${me?.firstName ?? ''} ${me?.lastName ?? ''}`.trim() || 'Alguien';
    this.notifications
      .createNotification({
        userId: fs.requesterId,
        type: NotificationType.FRIEND_ACCEPTED,
        title: 'Aceptaron tu solicitud',
        titleEn: 'Friend request accepted',
        body: `${myName} aceptó tu solicitud de amistad.`,
        bodyEn: `${myName} accepted your friend request.`,
        data: {
          actorId: meId,
          actorName: myName,
          actorAvatarUrl: me?.avatarUrl ?? null,
          friendshipId,
        },
      })
      .catch(() => {});

    // The FRIEND_REQUEST notification is now stale — the inbox row is gone.
    await this.deleteRequestNotification(meId, friendshipId);

    this.emitFriendshipEvent([fs.requesterId, fs.addresseeId], 'accepted', fs.requesterId, meId, friendshipId);

    return { ok: true, status: 'accepted' as const, friendship: updated };
  }

  async decline(meId: string, friendshipId: string) {
    const fs = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!fs) throw new NotFoundException('Friendship not found');
    if (fs.addresseeId !== meId) {
      throw new ForbiddenException('Only the addressee can decline');
    }
    if (fs.status === FriendshipStatus.DECLINED) {
      return { ok: true, status: 'declined' as const, friendship: fs };
    }
    if (fs.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }
    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.DECLINED, declinedAt: new Date() },
    });
    await this.deleteRequestNotification(meId, friendshipId);
    // Both sides refresh: my inbox drops the row, the requester's profile
    // button goes back to "Agregar" (we don't push a notification — silent
    // decline, like IG/FB).
    this.emitFriendshipEvent([fs.requesterId, fs.addresseeId], 'declined', fs.requesterId, meId, friendshipId);
    return { ok: true, status: 'declined' as const, friendship: updated };
  }

  async cancel(meId: string, otherId: string) {
    // Cancel my outgoing request to other. Only the requester can cancel;
    // an addressee who calls this simply gets `none` (nothing to cancel).
    const fs = await this.prisma.friendship.findFirst({
      where: {
        requesterId: meId,
        addresseeId: otherId,
        status: FriendshipStatus.PENDING,
      },
    });
    if (!fs) return { ok: true, status: 'none' as const };
    await this.prisma.friendship.delete({ where: { id: fs.id } });
    // Remove the stale "X wants to be your friend" from the addressee's inbox.
    await this.deleteRequestNotification(otherId, fs.id);
    this.emitFriendshipEvent([meId, otherId], 'cancelled', otherId, meId, fs.id);
    return { ok: true, status: 'none' as const };
  }

  async remove(meId: string, otherId: string) {
    // Unfriend in either direction. Never touches a BLOCKED row — that has
    // its own endpoint and only the blocker may lift it.
    const fs = await this.findPair(meId, otherId);
    if (!fs) return { ok: true, status: 'none' as const };
    if (fs.status === FriendshipStatus.BLOCKED) {
      throw new ForbiddenException('Cannot interact with this user');
    }
    await this.prisma.friendship.delete({ where: { id: fs.id } });
    if (fs.status === FriendshipStatus.PENDING) {
      await this.deleteRequestNotification(fs.addresseeId, fs.id);
    }
    this.emitFriendshipEvent([meId, otherId], 'removed', otherId, meId, fs.id);
    return { ok: true, status: 'none' as const };
  }

  /**
   * Bloquea a un usuario:
   *  - la relación queda BLOCKED (requester = quien bloquea)
   *  - se borran follows en ambos sentidos
   *  - las solicitudes pendientes (en cualquier dirección) desaparecen
   *    (la fila se sobreescribe) junto con sus notificaciones
   *  - los hilos de mensajes entre ambos pasan a BLOCKED
   */
  async block(meId: string, otherId: string) {
    if (meId === otherId) throw new BadRequestException("Can't block yourself");
    const target = await this.prisma.user.findFirst({
      where: { id: otherId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.findPair(meId, otherId);
    if (existing && existing.status === FriendshipStatus.BLOCKED && existing.requesterId !== meId) {
      // They blocked me first. We can't take over their row (it's their
      // block), but from my side the relationship is already dead. Report
      // success so the UI hides them either way.
      return { ok: true, status: 'blocked' as const };
    }

    if (existing) {
      if (existing.status === FriendshipStatus.PENDING) {
        await this.deleteRequestNotification(existing.addresseeId, existing.id);
      }
      await this.prisma.friendship.update({
        where: { id: existing.id },
        data: {
          status: FriendshipStatus.BLOCKED,
          requesterId: meId,
          addresseeId: otherId,
          blockedAt: new Date(),
          acceptedAt: null,
          declinedAt: null,
          filteredAt: null,
        },
      });
    } else {
      await this.prisma.friendship.create({
        data: {
          requesterId: meId,
          addresseeId: otherId,
          status: FriendshipStatus.BLOCKED,
          blockedAt: new Date(),
        },
      });
    }

    await Promise.all([
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: meId, followingId: otherId },
            { followerId: otherId, followingId: meId },
          ],
        },
      }),
      this.prisma.messageThread.updateMany({
        where: {
          OR: [
            { userAId: meId, userBId: otherId },
            { userAId: otherId, userBId: meId },
          ],
        },
        data: { status: MessageThreadStatus.BLOCKED },
      }),
    ]);

    this.emitFriendshipEvent([meId, otherId], 'blocked', otherId, meId, existing?.id ?? null);
    return { ok: true, status: 'blocked' as const };
  }

  /**
   * Desbloquea a un usuario (borra la relación BLOCKED y reabre los hilos de
   * mensajes). Solo quien bloqueó puede desbloquear.
   */
  async unblock(meId: string, otherId: string) {
    const fs = await this.findPair(meId, otherId);
    if (!fs || fs.status !== FriendshipStatus.BLOCKED) {
      // Nothing to lift — idempotent.
      return { ok: true, status: 'none' as const };
    }
    if (fs.requesterId !== meId) {
      throw new ForbiddenException('Only the blocker can unblock');
    }
    await this.prisma.friendship.delete({ where: { id: fs.id } });
    // Threads we froze on block go back to ACCEPTED. We only touch BLOCKED
    // rows so a thread the other user blocked via DM settings stays blocked.
    await this.prisma.messageThread.updateMany({
      where: {
        status: MessageThreadStatus.BLOCKED,
        OR: [
          { userAId: meId, userBId: otherId },
          { userAId: otherId, userBId: meId },
        ],
      },
      data: { status: MessageThreadStatus.ACCEPTED },
    });
    this.emitFriendshipEvent([meId, otherId], 'unblocked', otherId, meId, fs.id);
    return { ok: true, status: 'none' as const };
  }

  // ─────────────────────────────────────────────
  //  LISTS
  // ─────────────────────────────────────────────

  /** My accepted friends (flat, used by GET /friendships). */
  async listFriends(meId: string, limit = 100) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: meId }, { addresseeId: meId }],
      },
      orderBy: { acceptedAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        requester: { select: USER_BASIC_SELECT },
        addressee: { select: USER_BASIC_SELECT },
      },
    });
    return rows.map((r) => (r.requesterId === meId ? r.addressee : r.requester));
  }

  /**
   * Paginated friends of `targetId` as seen by `viewerId`.
   * `mutual` → only friends the viewer also has. Privacy is enforced by the
   * caller (users.service) so the rule stays in one place with followers/following.
   */
  async listFriendsOf(
    targetId: string,
    viewerId: string | undefined,
    page = 1,
    limit = 30,
    mutual = false,
  ) {
    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(1, limit || 30), 100);

    const where: any = {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ requesterId: targetId }, { addresseeId: targetId }],
    };

    if (mutual) {
      if (!viewerId || viewerId === targetId) {
        return paginate([], 0, safePage, safeLimit);
      }
      const mine = await this.getFriendIds(viewerId);
      const mineSet = mine.filter((id) => id !== targetId);
      if (mineSet.length === 0) return paginate([], 0, safePage, safeLimit);
      where.AND = [
        {
          OR: [
            { requesterId: targetId, addresseeId: { in: mineSet } },
            { addresseeId: targetId, requesterId: { in: mineSet } },
          ],
        },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.friendship.count({ where }),
      this.prisma.friendship.findMany({
        where,
        orderBy: { acceptedAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          requester: { select: USER_BASIC_SELECT },
          addressee: { select: USER_BASIC_SELECT },
        },
      }),
    ]);

    const items = rows.map((r) => {
      const user = r.requesterId === targetId ? r.addressee : r.requester;
      return { ...user, friendshipId: r.id, since: r.acceptedAt };
    });
    return paginate(items, total, safePage, safeLimit);
  }

  /** Users I have blocked (so I can unblock them from settings). */
  async listBlocked(meId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { requesterId: meId, status: FriendshipStatus.BLOCKED },
      orderBy: { blockedAt: 'desc' },
      take: 200,
      include: { addressee: { select: USER_BASIC_SELECT } },
    });
    return rows.map((r) => ({ ...r.addressee, blockedAt: r.blockedAt, friendshipId: r.id }));
  }

  /**
   * Incoming requests waiting for my decision.
   * @param tab "main" → not filtered; "filtered" → filtered (low-trust)
   */
  async listIncoming(meId: string, tab: 'main' | 'filtered' = 'main', limit = 50) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        addresseeId: meId,
        status: FriendshipStatus.PENDING,
        ...(tab === 'filtered'
          ? { filteredAt: { not: null } }
          : { filteredAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        requester: {
          select: {
            id: true, createdAt: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true, bio: true } },
            _count: { select: { followers: true } },
          },
        },
      },
    });

    // Decorate with mutuals so the inbox can show "3 friends in common".
    // My own friend ids are fetched ONCE — calling countMutualFriends per row
    // re-queried them for every request in the page (up to 100 round-trips).
    const myFriends = new Set(await this.getFriendIds(meId));
    const senderFriends = await Promise.all(rows.map((r) => this.getFriendIds(r.requesterId)));

    return rows.map((r, i) => {
      let mutualCount = 0;
      for (const id of senderFriends[i]) if (myFriends.has(id)) mutualCount++;
      return {
        friendshipId: r.id,
        createdAt: r.createdAt,
        filtered: !!r.filteredAt,
        mutualCount,
        user: r.requester,
      };
    });
  }

  /** Counts for badges (main tab + filtered tab). */
  async incomingCounts(meId: string) {
    const [main, filtered] = await Promise.all([
      this.prisma.friendship.count({
        where: { addresseeId: meId, status: FriendshipStatus.PENDING, filteredAt: null },
      }),
      this.prisma.friendship.count({
        where: { addresseeId: meId, status: FriendshipStatus.PENDING, filteredAt: { not: null } },
      }),
    ]);
    return { main, filtered, total: main + filtered };
  }

  /** My outgoing pending requests (so I can cancel them). */
  async listOutgoing(meId: string, limit = 50) {
    const rows = await this.prisma.friendship.findMany({
      where: { requesterId: meId, status: FriendshipStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        addressee: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      friendshipId: r.id,
      createdAt: r.createdAt,
      user: r.addressee,
    }));
  }

  // ─────────────────────────────────────────────
  //  PRIVACY (used by users.service)
  // ─────────────────────────────────────────────

  async updateFriendPolicy(userId: string, policy: FriendPolicy) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { friendPolicy: policy },
      select: { id: true, friendPolicy: true },
    });
  }
}
