// ─────────────────────────────────────────────
//  MessagesGateway — real-time chat (Socket.io)
//  Emits: message:new, typing:start, typing:stop, message:read, presence:online, presence:offline
// ─────────────────────────────────────────────
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    joinedThreadIds: Set<string>;
  };
}

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  transports: ['websocket', 'polling'],
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagesGateway.name);

  @WebSocketServer()
  server!: Server;

  // Track online users: userId → count of connected sockets (a user can have multiple devices)
  private online = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── CONNECTION ──────────────────────────────────
  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        socket.emit('error', { message: 'No token' });
        socket.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });

      // Check blocklist (logged out tokens)
      const isBlocked = await this.redis.exists(
        RedisService.sessionBlocklistKey(payload.jti),
      );
      if (isBlocked) {
        socket.emit('error', { message: 'Token revoked' });
        socket.disconnect(true);
        return;
      }

      (socket as AuthedSocket).data = {
        userId: payload.sub,
        joinedThreadIds: new Set(),
      };

      // Per-user room — used by broadcastPresence to target individual users
      // instead of the global namespace. Mandatory; without this, presence
      // events have no recipients to land on.
      socket.join(`user:${payload.sub}`);

      // Presence
      const count = (this.online.get(payload.sub) ?? 0) + 1;
      this.online.set(payload.sub, count);
      if (count === 1) void this.broadcastPresence(payload.sub, true);

      this.logger.log(`user ${payload.sub} connected (sockets=${count})`);
    } catch (err) {
      this.logger.warn(`auth failed: ${(err as Error).message}`);
      socket.emit('error', { message: 'Invalid token' });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const authed = socket as AuthedSocket;
    const userId = authed.data?.userId;
    if (!userId) return;

    const count = (this.online.get(userId) ?? 1) - 1;
    if (count <= 0) {
      this.online.delete(userId);
      const lastSeenAt = new Date();
      // Persist last-seen so the peer can render "última vez hace X" even after
      // they reconnect. Failures here must not break disconnect cleanup.
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { lastSeenAt },
        });
      } catch (err) {
        this.logger.warn(`lastSeenAt update failed for ${userId}: ${(err as Error).message}`);
      }
      void this.broadcastPresence(userId, false, lastSeenAt);
    } else {
      this.online.set(userId, count);
    }

    this.logger.log(`user ${userId} disconnected`);
  }

  // ── THREAD ROOMS ────────────────────────────────
  @SubscribeMessage('thread:join')
  async onThreadJoin(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { threadId: string },
  ) {
    const { userId } = socket.data;
    const { threadId } = body ?? {};
    if (!threadId) return { ok: false, error: 'Missing threadId' };

    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) return { ok: false, error: 'Thread not found' };
    if (thread.userAId !== userId && thread.userBId !== userId) {
      return { ok: false, error: 'Not a member' };
    }

    await socket.join(this.threadRoom(threadId));
    socket.data.joinedThreadIds.add(threadId);

    // Notify the other user in the thread that we're present
    const otherId = thread.userAId === userId ? thread.userBId : thread.userAId;
    const otherOnline = this.online.has(otherId);
    let otherLastSeenAt: string | null = null;
    if (!otherOnline) {
      const u = await this.prisma.user.findUnique({
        where: { id: otherId },
        select: { lastSeenAt: true },
      });
      otherLastSeenAt = u?.lastSeenAt ? u.lastSeenAt.toISOString() : null;
    }
    return { ok: true, otherOnline, otherLastSeenAt };
  }

  @SubscribeMessage('thread:leave')
  async onThreadLeave(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { threadId: string },
  ) {
    const { threadId } = body ?? {};
    if (!threadId) return;
    await socket.leave(this.threadRoom(threadId));
    socket.data.joinedThreadIds.delete(threadId);
  }

  // ── TYPING INDICATOR ───────────────────────────
  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { threadId: string },
  ) {
    if (!body?.threadId) return;
    socket.to(this.threadRoom(body.threadId)).emit('typing:start', {
      threadId: body.threadId,
      userId: socket.data.userId,
    });
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { threadId: string },
  ) {
    if (!body?.threadId) return;
    socket.to(this.threadRoom(body.threadId)).emit('typing:stop', {
      threadId: body.threadId,
      userId: socket.data.userId,
    });
  }

  // ── VOICE RECORDING INDICATOR ──────────────────
  @SubscribeMessage('voice:start')
  onVoiceStart(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { threadId: string },
  ) {
    if (!body?.threadId) return;
    socket.to(this.threadRoom(body.threadId)).emit('voice:start', {
      threadId: body.threadId,
      userId: socket.data.userId,
    });
  }

  @SubscribeMessage('voice:stop')
  onVoiceStop(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { threadId: string },
  ) {
    if (!body?.threadId) return;
    socket.to(this.threadRoom(body.threadId)).emit('voice:stop', {
      threadId: body.threadId,
      userId: socket.data.userId,
    });
  }

  // ── READ RECEIPTS ──────────────────────────────
  @SubscribeMessage('message:read')
  async onMessageRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { threadId: string },
  ) {
    const { userId } = socket.data;
    const { threadId } = body ?? {};
    if (!threadId) return;

    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) return;
    if (thread.userAId !== userId && thread.userBId !== userId) return;

    await this.prisma.message.updateMany({
      where: { threadId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    socket.to(this.threadRoom(threadId)).emit('message:read', {
      threadId,
      byUserId: userId,
      at: new Date().toISOString(),
    });
  }

  // ── PUBLIC API (called from MessagesService) ────
  /** Emit a newly-created message to everyone in the thread room. */
  emitNewMessage(threadId: string, message: unknown) {
    this.server.to(this.threadRoom(threadId)).emit('message:new', {
      threadId,
      message,
    });
  }

  /** True if the user has any socket currently joined to the thread room.
   *  Used by MessagesService to skip notifications when the recipient is
   *  already viewing the conversation. */
  isUserInThread(userId: string, threadId: string): boolean {
    if (!this.online.has(userId)) return false;
    const room = this.server.sockets.adapter.rooms.get(this.threadRoom(threadId));
    if (!room || room.size === 0) return false;
    for (const socketId of room) {
      const s = this.server.sockets.sockets.get(socketId) as AuthedSocket | undefined;
      if (s?.data?.userId === userId) return true;
    }
    return false;
  }

  // ── HELPERS ────────────────────────────────────
  private threadRoom(threadId: string) {
    return `thread:${threadId}`;
  }

  // Limit presence to "people who can see this user": followers (one-way
  // discovery), accepted friendships, and staff (admin/moderator dashboards
  // may want to know who's online). Anonymous viewers, blocked users, or
  // strangers must NOT receive presence pings.
  // Audit ref: backend audit P0 #3, 2026-05-18 — was leaking via this.server.emit.
  private async broadcastPresence(userId: string, online: boolean, lastSeenAt?: Date) {
    const at = (lastSeenAt ?? new Date()).toISOString();
    const event = online ? 'presence:online' : 'presence:offline';
    const payload = { userId, at, lastSeenAt: online ? null : at };

    try {
      const [followers, friendships, staff] = await Promise.all([
        this.prisma.follow.findMany({
          where: { targetUserId: userId },
          select: { userId: true },
        }),
        this.prisma.friendship.findMany({
          where: {
            status: 'ACCEPTED',
            OR: [{ requesterId: userId }, { addresseeId: userId }],
          },
          select: { requesterId: true, addresseeId: true },
        }),
        this.prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'] } },
          select: { id: true },
        }),
      ]);

      const recipientIds = new Set<string>();
      followers.forEach((f) => recipientIds.add(f.userId));
      friendships.forEach((f) => {
        recipientIds.add(f.requesterId === userId ? f.addresseeId : f.requesterId);
      });
      staff.forEach((s) => recipientIds.add(s.id));
      // The actor's own other sockets — they can see themselves online.
      recipientIds.add(userId);

      // Emit only to per-user rooms (handleConnection joins `user:{id}`).
      for (const rid of recipientIds) {
        this.server.to(`user:${rid}`).emit(event, payload);
      }
    } catch (err) {
      this.logger.warn(`broadcastPresence failed for ${userId}: ${err}`);
    }
  }

  private extractToken(socket: Socket): string | null {
    // Prefer handshake auth object; fallback to Authorization header
    const fromAuth = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (fromAuth) return fromAuth;
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const q = socket.handshake.query?.token;
    if (typeof q === 'string') return q;
    return null;
  }
}
