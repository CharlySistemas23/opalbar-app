// ─────────────────────────────────────────────
//  RealtimeGateway — single unified socket.io gateway for the whole app
//
//  Handles JWT auth, auto-joins per-user / per-role rooms, and exposes a
//  programmatic emit API to every service in the codebase via RealtimeService.
//
//  Rooms a connected user joins automatically:
//    • user:${userId}              — personal events (notifications, DMs, mine)
//    • role:${role}                — broadcasts to all users with that role
//    • staff                       — anyone with role MODERATOR / ADMIN / SUPER_ADMIN
//
//  Broadcasts the gateway accepts:
//    • broadcast                   — all connected sockets
// ─────────────────────────────────────────────
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    role: UserRole;
  };
}

export type RealtimeTarget =
  | { broadcast: true }
  | { userIds: string[] }
  | { roles: UserRole[] }
  | { staff: true }
  | { room: string };

@WebSocketGateway({
  namespace: '/rt',
  cors: { origin: '*', credentials: false },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  // userId → number of active sockets (user can have multiple devices/tabs)
  private online = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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

      // Honour the logout blocklist
      if (payload.jti) {
        const blocked = await this.redis.exists(RedisService.sessionBlocklistKey(payload.jti));
        if (blocked) {
          socket.emit('error', { message: 'Token revoked' });
          socket.disconnect(true);
          return;
        }
      }

      // Resolve role (cached on token if available, fallback to DB)
      const userId: string = payload.sub;
      const role: UserRole = (payload.role as UserRole) ?? (await this.fetchRole(userId)) ?? UserRole.USER;

      (socket as AuthedSocket).data = { userId, role };

      // Auto-join rooms
      await socket.join(`user:${userId}`);
      await socket.join(`role:${role}`);
      if (role === UserRole.MODERATOR || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
        await socket.join('staff');
      }

      const count = (this.online.get(userId) ?? 0) + 1;
      this.online.set(userId, count);
      if (count === 1) {
        this.server.emit('presence:online', { userId, at: new Date().toISOString() });
      }

      socket.emit('rt:ready', { userId, role });
      this.logger.debug(`rt connect user=${userId} role=${role} sockets=${count}`);
    } catch (err) {
      this.logger.warn(`rt auth failed: ${(err as Error).message}`);
      socket.emit('error', { message: 'Invalid token' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = (socket as AuthedSocket).data?.userId;
    if (!userId) return;
    const count = (this.online.get(userId) ?? 1) - 1;
    if (count <= 0) {
      this.online.delete(userId);
      this.server.emit('presence:offline', { userId, at: new Date().toISOString() });
    } else {
      this.online.set(userId, count);
    }
  }

  // ── Public emit API ───────────────────────────
  /**
   * Emit a typed event to one or more rooms. Called from RealtimeService.
   * Failures are swallowed — realtime must never break a write path.
   */
  emit(event: string, payload: unknown, target: RealtimeTarget): void {
    try {
      if ('broadcast' in target && target.broadcast) {
        this.server.emit(event, payload);
        return;
      }
      if ('staff' in target && target.staff) {
        this.server.to('staff').emit(event, payload);
        return;
      }
      if ('room' in target && target.room) {
        this.server.to(target.room).emit(event, payload);
        return;
      }
      if ('userIds' in target && target.userIds.length) {
        for (const uid of target.userIds) {
          this.server.to(`user:${uid}`).emit(event, payload);
        }
        return;
      }
      if ('roles' in target && target.roles.length) {
        for (const r of target.roles) {
          this.server.to(`role:${r}`).emit(event, payload);
        }
        return;
      }
    } catch (err) {
      this.logger.warn(`emit failed event=${event}: ${(err as Error).message}`);
    }
  }

  isOnline(userId: string) {
    return this.online.has(userId);
  }

  // ── Helpers ──────────────────────────────────
  private async fetchRole(userId: string): Promise<UserRole | null> {
    try {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      return u?.role ?? null;
    } catch {
      return null;
    }
  }

  private extractToken(socket: Socket): string | null {
    const fromAuth = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (fromAuth) return fromAuth;
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const q = socket.handshake.query?.token;
    if (typeof q === 'string') return q;
    return null;
  }
}
