import { ForbiddenException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MessagesGateway } from './messages.gateway';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly gateway: MessagesGateway,
    private readonly realtime: RealtimeService,
  ) {}

  // Deterministic thread key: sort user IDs so pair (a,b) == (b,a)
  private pair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async getOrCreateThread(meId: string, otherId: string) {
    if (meId === otherId) throw new ForbiddenException("Can't message yourself");
    const [uA, uB] = this.pair(meId, otherId);
    const existing = await this.prisma.messageThread.findUnique({
      where: { userAId_userBId: { userAId: uA, userBId: uB } },
    });
    if (existing) return existing;
    return this.prisma.messageThread.create({
      data: { userAId: uA, userBId: uB },
    });
  }

  async listThreads(meId: string) {
    const threads = await this.prisma.messageThread.findMany({
      where: { OR: [{ userAId: meId }, { userBId: meId }] },
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
    let threadId: string | null = null;
    const maybeThread = await this.prisma.messageThread.findUnique({
      where: { id: threadOrUserId },
    });
    if (maybeThread) {
      if (maybeThread.userAId !== meId && maybeThread.userBId !== meId) {
        throw new ForbiddenException('Not a member of this thread');
      }
      threadId = maybeThread.id;
    } else {
      // treat as userId
      const targetUser = await this.prisma.user.findUnique({ where: { id: threadOrUserId } });
      if (!targetUser) throw new NotFoundException('User not found');
      const thread = await this.getOrCreateThread(meId, threadOrUserId);
      threadId = thread.id;
    }

    const msg = await this.prisma.message.create({
      data: { threadId: threadId!, senderId: meId, content: trimmed },
    });
    await this.prisma.messageThread.update({
      where: { id: threadId! },
      data: { lastMessageAt: new Date() },
    });

    // Real-time push to anyone in the thread room (existing DM gateway)
    this.gateway.emitNewMessage(threadId!, msg);

    // Real-time fan-out: both participants + admin moderation feed
    const thread = maybeThread ?? (await this.prisma.messageThread.findUnique({ where: { id: threadId! } }));
    if (thread) {
      this.realtime.toUsers([thread.userAId, thread.userBId], 'message', 'sent', { id: msg.id, data: msg });
    }
    this.realtime.toStaff('message', 'sent', { id: msg.id, data: { threadId, senderId: meId } });

    return msg;
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
