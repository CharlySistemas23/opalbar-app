import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export type CommunityChangeType =
  | 'post_created'
  | 'post_updated'
  | 'post_deleted'
  | 'post_reacted'
  | 'comment_created'
  | 'comment_deleted'
  | 'comment_liked';

@WebSocketGateway({
  namespace: '/community',
  cors: { origin: '*', credentials: false },
  transports: ['websocket', 'polling'],
})
export class CommunityGateway {
  private readonly logger = new Logger(CommunityGateway.name);

  @WebSocketServer()
  server!: Server;

  emitChanged(payload: {
    type: CommunityChangeType;
    postId?: string;
    commentId?: string;
  }) {
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

  async handleConnection() {
    this.logger.debug('community socket connected');
  }
}
