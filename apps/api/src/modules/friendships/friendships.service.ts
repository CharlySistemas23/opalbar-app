import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendPolicy, FriendshipStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';

const NEW_ACCOUNT_DAYS = 7;

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
   * Signals (any one is enough):
   *  · sender has no avatar
   *  · sender's account is < 7 days old
   *  · sender has 0 mutual friends with recipient
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

    if (!sender.profile?.avatarUrl) return true;

    const ageMs = Date.now() - sender.createdAt.getTime();
    if (ageMs < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000) return true;

    const mutuals = await this.countMutualFriends(senderId, recipientId);
    if (mutuals === 0) return true;

    return false;
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
  async getProfileContext(viewerId: string, subjectId: string) {
    if (viewerId === subjectId) {
      return { status: 'self' as const, isFriend: false, mutualCount: 0, friendshipId: null };
    }
    const fs = await this.findPair(viewerId, subjectId);
    const mutualCount = await this.countMutualFriends(viewerId, subjectId);

    if (!fs) {
      return { status: 'none' as const, isFriend: false, mutualCount, friendshipId: null };
    }
    if (fs.status === FriendshipStatus.ACCEPTED) {
      return { status: 'accepted' as const, isFriend: true, mutualCount, friendshipId: fs.id };
    }
    if (fs.status === FriendshipStatus.PENDING) {
      const direction = fs.requesterId === viewerId ? 'outgoing' : 'incoming';
      return {
        status: direction === 'outgoing' ? ('outgoing' as const) : ('incoming' as const),
        isFriend: false,
        mutualCount,
        friendshipId: fs.id,
      };
    }
    if (fs.status === FriendshipStatus.BLOCKED) {
      return { status: 'blocked' as const, isFriend: false, mutualCount, friendshipId: fs.id };
    }
    return { status: 'none' as const, isFriend: false, mutualCount, friendshipId: null };
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
        },
      });
      this.notifyRequest(meId, otherId, revived.id, filtered);
      return { ok: true, status: 'outgoing' as const, friendship: revived };
    }

    const filtered = await this.shouldFilter(meId, otherId);
    const created = await this.prisma.friendship.create({
      data: {
        requesterId: meId,
        addresseeId: otherId,
        status: FriendshipStatus.PENDING,
        filteredAt: filtered ? new Date() : null,
      },
    });
    this.notifyRequest(meId, otherId, created.id, filtered);
    this.realtime.toUsers([meId, otherId], 'user', 'updated', {
      id: otherId,
      data: { friendship: 'requested', by: meId },
    });
    return { ok: true, status: 'outgoing' as const, friendship: created };
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

    this.realtime.toUsers([fs.requesterId, fs.addresseeId], 'user', 'updated', {
      id: friendshipId,
      data: { friendship: 'accepted', by: meId },
    });

    return { ok: true, status: 'accepted' as const, friendship: updated };
  }

  async decline(meId: string, friendshipId: string) {
    const fs = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!fs) throw new NotFoundException('Friendship not found');
    if (fs.addresseeId !== meId) {
      throw new ForbiddenException('Only the addressee can decline');
    }
    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.DECLINED, declinedAt: new Date() },
    });
    this.realtime.toUser(meId, 'user', 'updated', {
      id: friendshipId,
      data: { friendship: 'declined' },
    });
    return { ok: true, status: 'declined' as const, friendship: updated };
  }

  async cancel(meId: string, otherId: string) {
    // Cancel my outgoing request to other.
    const fs = await this.prisma.friendship.findFirst({
      where: {
        requesterId: meId,
        addresseeId: otherId,
        status: FriendshipStatus.PENDING,
      },
    });
    if (!fs) return { ok: true, status: 'none' as const };
    await this.prisma.friendship.delete({ where: { id: fs.id } });
    this.realtime.toUsers([meId, otherId], 'user', 'updated', {
      id: otherId,
      data: { friendship: 'cancelled', by: meId },
    });
    return { ok: true, status: 'none' as const };
  }

  async remove(meId: string, otherId: string) {
    // Unfriend in either direction.
    const fs = await this.findPair(meId, otherId);
    if (!fs) return { ok: true, status: 'none' as const };
    await this.prisma.friendship.delete({ where: { id: fs.id } });
    this.realtime.toUsers([meId, otherId], 'user', 'updated', {
      id: otherId,
      data: { friendship: 'removed', by: meId },
    });
    return { ok: true, status: 'none' as const };
  }

  // ─────────────────────────────────────────────
  //  LISTS
  // ─────────────────────────────────────────────

  /** My accepted friends. */
  async listFriends(meId: string, limit = 100) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: meId }, { addresseeId: meId }],
      },
      orderBy: { acceptedAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        requester: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        addressee: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });
    return rows.map((r) => (r.requesterId === meId ? r.addressee : r.requester));
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
    const out = await Promise.all(
      rows.map(async (r) => {
        const mutuals = await this.countMutualFriends(meId, r.requesterId);
        return {
          friendshipId: r.id,
          createdAt: r.createdAt,
          filtered: !!r.filteredAt,
          mutualCount: mutuals,
          user: r.requester,
        };
      }),
    );
    return out;
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
