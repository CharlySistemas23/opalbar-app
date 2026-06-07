// ─────────────────────────────────────────────
//  CommunityGateway — real-time community changes (Socket.io)
//
//  PREVIO (2026-05-18 audit P0 #4): este gateway estaba SIN JWT auth y
//  emitía `community:changed` global a cualquiera conectado al namespace
//  `/community`. Riesgo de leakage de postId/commentId de posts privados.
//  Fix: validar JWT en handleConnection, igual que `RealtimeGateway`.
// ─────────────────────────────────────────────
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../database/redis.service';

export type CommunityChangeType =
  | 'post_created'
  | 'post_updated'
  | 'post_deleted'
  | 'post_reacted'
  | 'comment_created'
  | 'comment_updated'
  | 'comment_deleted'
  | 'comment_liked'
  | 'comment_reacted';

@WebSocketGateway({
  namespace: '/community',
  cors: { origin: '*', credentials: false },
  transports: ['websocket', 'polling'],
})
export class CommunityGateway implements OnGatewayConnection {
  private readonly logger = new Logger(CommunityGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  emitChanged(payload: {
    type: CommunityChangeType;
    postId?: string;
    commentId?: string;
  }) {
    // Global event still emitted, but only authenticated sockets are
    // connected to the namespace now (any anonymous socket is disconnected
    // in handleConnection before it can subscribe).
    this.server.emit('community:changed', {
      ...payload,
      at: new Date().toISOString(),
    });
    if (payload.postId) {
      this.server.to(`post:${payload.postId}`).emit('community:post-changed', {
        ...payload,
        at: new Date().toISOString(),
      });
    }
  }

  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        socket.emit('error', { message: 'No token' });
        socket.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string; jti: string }>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
      // Honor session blocklist (logged-out tokens).
      const isBlocked = await this.redis.exists(
        RedisService.sessionBlocklistKey(payload.jti),
      );
      if (isBlocked) {
        socket.emit('error', { message: 'Token revoked' });
        socket.disconnect(true);
        return;
      }
      // Tag the socket with userId so future `socket.join('post:...')`
      // subscriptions can be authorized server-side.
      (socket.data as { userId?: string }).userId = payload.sub;
      this.logger.debug(`community socket connected (user=${payload.sub})`);
    } catch (err) {
      this.logger.warn(`community auth failed: ${(err as Error).message}`);
      socket.emit('error', { message: 'Invalid token' });
      socket.disconnect(true);
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
