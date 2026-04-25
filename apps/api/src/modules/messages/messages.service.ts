import { ForbiddenException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { DmPolicy, MessageThreadStatus, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MessagesGateway } from './messages.gateway';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';

const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.MODERATOR,
];

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly gateway: MessagesGateway,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  // Deterministic thread key: sort user IDs so pair (a,b) == (b,a)
  private pair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  /**
   * Decide initial thread status based on recipient's DM policy. Implements
   * the "IG/FB hybrid" gating:
   *   EVERYONE  → ACCEPTED
   *   FOLLOWING → ACCEPTED only if recipient already follows the sender,
   *               otherwise PENDING (lands in their requests inbox)
   *   NONE      → ACCEPTED only if recipient already follows the sender,
   *               otherwise hard-rejected (Forbidden)
   * Staff (admin/moderator) can bypass any filter — both as sender (their
   * messages always go through) and as recipient (we don't gate inbound
   * messages to staff accounts).
   */
  private async resolveInitialStatus(
    senderId: string,
    recipientId: string,
  ): Promise<MessageThreadStatus> {
    const [sender, recipient] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, role: true },
      }),
      this.prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, role: true, dmPolicy: true },
      }),
    ]);

    if (!recipient) throw new NotFoundException('User not found');

    const senderIsStaff = !!sender && STAFF_ROLES.includes(sender.role);
    const recipientIsStaff = STAFF_ROLES.includes(recipient.role);
    if (senderIsStaff || recipientIsStaff) return MessageThreadStatus.ACCEPTED;

    if (recipient.dmPolicy === DmPolicy.EVERYONE) return MessageThreadStatus.ACCEPTED;

    // FOLLOWING / NONE both require recipient → sender follow to auto-accept
    const recipientFollowsSender = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: recipientId, followingId: senderId } },
      select: { id: true },
    });

    if (recipientFollowsSender) return MessageThreadStatus.ACCEPTED;

    if (recipient.dmPolicy === DmPolicy.NONE) {
      throw new ForbiddenException('This user is not accepting messages');
    }

    return MessageThreadStatus.PENDING;
  }

  async getOrCreateThread(meId: string, otherId: string) {
    if (meId === otherId) throw new ForbiddenException("Can't message yourself");
    const [uA, uB] = this.pair(meId, otherId);
    const existing = await this.prisma.messageThread.findUnique({
      where: { userAId_userBId: { userAId: uA, userBId: uB } },
    });
    if (existing) return existing;

    const status = await this.resolveInitialStatus(meId, otherId);
    return this.prisma.messageThread.create({
      data: { userAId: uA, userBId: uB, status, requestedById: meId },
    });
  }

  async listThreads(meId: string) {
    // Inbox shows ACCEPTED threads + PENDING threads I started myself.
    // PENDING threads where I'm the recipient go to /messages/requests.
    const threads = await this.prisma.messageThread.findMany({
      where: {
        OR: [{ userAId: meId }, { userBId: meId }],
        AND: [
          {
            OR: [
              { status: MessageThreadStatus.ACCEPTED },
              { status: MessageThreadStatus.PENDING, requestedById: meId },
            ],
          },
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        userA: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        userB: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, createdAt: true, senderId: true, isRead: true },
        },
      },
      take: 100,
    });

    // Normalize: add "otherUser" shortcut + unreadCount
    const results = await Promise.all(
      threads.map(async (thread) => {
        const other = thread.userAId === meId ? thread.userB : thread.userA;
        const unreadCount = await this.prisma.message.count({
          where: { threadId: thread.id, isRead: false, senderId: { not: meId } },
        });
        return {
          id: thread.id,
          lastMessageAt: thread.lastMessageAt,
          otherUser: other,
          lastMessage: thread.messages[0] ?? null,
          unreadCount,
        };
      }),
    );
    return results;
  }

  async getThread(meId: string, threadId: string) {
    const thread = await this.prisma.messageThread.findFirst({
      where: {
        id: threadId,
        OR: [{ userAId: meId }, { userBId: meId }],
      },
      include: {
        userA: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        userB: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    const otherUser = thread.userAId === meId ? thread.userB : thread.userA;
    return { id: thread.id, otherUser, lastMessageAt: thread.lastMessageAt };
  }

  async listMessages(meId: string, threadId: string, cursor?: string, limit = 50) {
    const ensureMembership = await this.prisma.messageThread.findFirst({
      where: { id: threadId, OR: [{ userAId: meId }, { userBId: meId }] },
      select: { id: true },
    });
    if (!ensureMembership) throw new NotFoundException('Thread not found');

    const messages = await this.prisma.message.findMany({
      where: { threadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // Mark incoming ones as read
    await this.prisma.message.updateMany({
      where: { threadId, senderId: { not: meId }, isRead: false },
      data: { isRead: true },
    });

    return messages.reverse();
  }

  async sendMessage(meId: string, threadOrUserId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) throw new ForbiddenException('Empty message');

    // threadOrUserId can be either a threadId or a targetUserId
    let thread = await this.prisma.messageThread.findUnique({
      where: { id: threadOrUserId },
    });

    if (thread) {
      if (thread.userAId !== meId && thread.userBId !== meId) {
        throw new ForbiddenException('Not a member of this thread');
      }
      if (thread.status === MessageThreadStatus.BLOCKED) {
        throw new ForbiddenException('This conversation is blocked');
      }
    } else {
      // treat as userId — getOrCreateThread will run gating
      const targetUser = await this.prisma.user.findUnique({ where: { id: threadOrUserId } });
      if (!targetUser) throw new NotFoundException('User not found');
      thread = await this.getOrCreateThread(meId, threadOrUserId);
    }

    const threadId = thread.id;
    const recipientId = thread.userAId === meId ? thread.userBId : thread.userAId;
    const isFirstMessage = (await this.prisma.message.count({ where: { threadId } })) === 0;

    const msg = await this.prisma.message.create({
      data: { threadId, senderId: meId, content: trimmed },
    });
    await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });

    // Real-time push to anyone in the thread room (existing DM gateway)
    this.gateway.emitNewMessage(threadId, msg);

    // Real-time fan-out: both participants + admin moderation feed
    this.realtime.toUsers([thread.userAId, thread.userBId], 'message', 'sent', { id: msg.id, data: msg });
    this.realtime.toStaff('message', 'sent', { id: msg.id, data: { threadId, senderId: meId } });

    // Inbox notifications. PENDING threads notify the recipient as a
    // request only on the first message; ACCEPTED threads send a normal
    // message notification (per-message). We never notify the sender.
    if (thread.status === MessageThreadStatus.PENDING && isFirstMessage) {
      const senderProfile = await this.prisma.userProfile.findUnique({ where: { userId: meId } });
      const senderName = senderProfile
        ? `${senderProfile.firstName ?? ''} ${senderProfile.lastName ?? ''}`.trim() || 'Alguien'
        : 'Alguien';
      await this.notifications
        .createNotification({
          userId: recipientId,
          type: NotificationType.MESSAGE_REQUEST,
          title: `${senderName} quiere enviarte un mensaje`,
          body: trimmed.slice(0, 120),
          data: {
            threadId,
            actorId: meId,
            actorName: senderName,
            actorAvatarUrl: senderProfile?.avatarUrl ?? null,
            isRequest: true,
          },
        })
        .catch(() => {});
    } else if (thread.status === MessageThreadStatus.ACCEPTED) {
      const senderProfile = await this.prisma.userProfile.findUnique({ where: { userId: meId } });
      const senderName = senderProfile
        ? `${senderProfile.firstName ?? ''} ${senderProfile.lastName ?? ''}`.trim() || 'Alguien'
        : 'Alguien';
      await this.notifications
        .createNotification({
          userId: recipientId,
          type: NotificationType.MESSAGE_NEW,
          title: senderName,
          body: trimmed.slice(0, 120),
          data: {
            threadId,
            actorId: meId,
            actorName: senderName,
            actorAvatarUrl: senderProfile?.avatarUrl ?? null,
          },
        })
        .catch(() => {});
    }

    return msg;
  }

  // ─────────────────────────────────────────
  //  MESSAGE REQUESTS (IG/FB hybrid)
  // ─────────────────────────────────────────

  async listRequests(meId: string) {
    const threads = await this.prisma.messageThread.findMany({
      where: {
        status: MessageThreadStatus.PENDING,
        OR: [{ userAId: meId }, { userBId: meId }],
        // I'm the RECIPIENT, not the requester
        NOT: { requestedById: meId },
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        userA: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        userB: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, createdAt: true, senderId: true },
        },
      },
      take: 100,
    });

    return threads.map((t) => {
      const other = t.userAId === meId ? t.userB : t.userA;
      return {
        id: t.id,
        lastMessageAt: t.lastMessageAt,
        otherUser: other,
        lastMessage: t.messages[0] ?? null,
      };
    });
  }

  async requestsCount(meId: string) {
    const count = await this.prisma.messageThread.count({
      where: {
        status: MessageThreadStatus.PENDING,
        OR: [{ userAId: meId }, { userBId: meId }],
        NOT: { requestedById: meId },
      },
    });
    return { count };
  }

  private async assertRecipientOf(meId: string, threadId: string) {
    const t = await this.prisma.messageThread.findUnique({ where: { id: threadId } });
    if (!t) throw new NotFoundException('Thread not found');
    if (t.userAId !== meId && t.userBId !== meId) throw new ForbiddenException('Not a member');
    if (t.requestedById === meId) {
      throw new ForbiddenException('Only the recipient can act on a request');
    }
    return t;
  }

  async acceptRequest(meId: string, threadId: string) {
    await this.assertRecipientOf(meId, threadId);
    const updated = await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { status: MessageThreadStatus.ACCEPTED },
    });
    this.realtime.toUsers([updated.userAId, updated.userBId], 'message', 'updated', {
      id: updated.id,
      data: updated,
    });
    return updated;
  }

  async declineRequest(meId: string, threadId: string) {
    const t = await this.assertRecipientOf(meId, threadId);
    // Hard-delete: declined requests should disappear, not linger as BLOCKED.
    await this.prisma.messageThread.delete({ where: { id: threadId } });
    this.realtime.toUsers([t.userAId, t.userBId], 'message', 'deleted', { id: threadId });
    return { ok: true };
  }

  async blockRequest(meId: string, threadId: string) {
    const t = await this.assertRecipientOf(meId, threadId);
    const updated = await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { status: MessageThreadStatus.BLOCKED },
    });
    this.realtime.toUsers([t.userAId, t.userBId], 'message', 'updated', {
      id: updated.id,
      data: updated,
    });
    return updated;
  }

  async deleteMessage(meId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== meId) throw new ForbiddenException('Not your message');
    const r = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
    this.realtime.toStaff('message', 'deleted', { id: messageId });
    return r;
  }

  // ─────────────────────────────────────────
  //  ADMIN MODERATION
  //  Used by staff to supervise private DMs for abuse.
  // ─────────────────────────────────────────

  async adminListThreads(search?: string, limit = 100) {
    const where: any = {};
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { userA: { email: { contains: q, mode: 'insensitive' } } },
        { userB: { email: { contains: q, mode: 'insensitive' } } },
        { userA: { profile: { OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ] } } },
        { userB: { profile: { OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ] } } },
      ];
    }

    const threads = await this.prisma.messageThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        userA: {
          select: {
            id: true, email: true, status: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        userB: {
          select: {
            id: true, email: true, status: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, createdAt: true, senderId: true, deletedAt: true },
        },
        _count: { select: { messages: true } },
      },
      take: Math.min(limit, 200),
    });

    return threads.map((t) => ({
      id: t.id,
      lastMessageAt: t.lastMessageAt,
      userA: t.userA,
      userB: t.userB,
      lastMessage: t.messages[0] ?? null,
      messageCount: t._count.messages,
    }));
  }

  async adminGetThread(threadId: string) {
    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        userA: {
          select: {
            id: true, email: true, phone: true, status: true, role: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        userB: {
          select: {
            id: true, email: true, phone: true, status: true, role: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    return thread;
  }

  async adminListMessages(threadId: string) {
    const exists = await this.prisma.messageThread.findUnique({ where: { id: threadId } });
    if (!exists) throw new NotFoundException('Thread not found');

    // Admin can see ALL messages including soft-deleted ones
    return this.prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  async adminDeleteMessage(messageId: string, adminId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    const r = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: `[Eliminado por moderación · ${new Date().toISOString()}]`,
      },
    });
    this.realtime.toStaff('message', 'deleted', { id: messageId });
    this.realtime.toUser(msg.senderId, 'message', 'deleted', { id: messageId });
    return r;
  }
}
