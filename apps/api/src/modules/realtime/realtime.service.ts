// ─────────────────────────────────────────────
//  RealtimeService — high-level façade over RealtimeGateway
//  Keeps service code free of socket.io knowledge.
// ─────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';

/** Resource families. Add new ones as the app grows. */
export type RealtimeResource =
  | 'user'
  | 'post'
  | 'comment'
  | 'message'
  | 'notification'
  | 'report'
  | 'reservation'
  | 'ticket'
  | 'event'
  | 'offer'
  | 'review'
  | 'checkin'
  | 'venue'
  | 'flag'
  | 'loyalty'
  | 'gdpr';

export type RealtimeAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'approved'
  | 'rejected'
  | 'banned'
  | 'unbanned'
  | 'role_changed'
  | 'status_changed'
  | 'reacted'
  | 'commented'
  | 'read'
  | 'sent';

export interface RealtimeEnvelope {
  resource: RealtimeResource;
  action: RealtimeAction;
  id?: string;
  data?: any;
  at: string;
}

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  private wrap(resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }): RealtimeEnvelope {
    return {
      resource,
      action,
      id: payload?.id,
      data: payload?.data,
      at: new Date().toISOString(),
    };
  }

  /** Notify staff (mod/admin/super_admin). Use for moderation surfaces. */
  toStaff(resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }) {
    this.gateway.emit('rt:event', this.wrap(resource, action, payload), { staff: true });
  }

  /** Notify a specific user (e.g. their own notification, their reservation update). */
  toUser(userId: string, resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }) {
    if (!userId) return;
    this.gateway.emit('rt:event', this.wrap(resource, action, payload), { userIds: [userId] });
  }

  /** Notify multiple users. */
  toUsers(userIds: string[], resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }) {
    if (!userIds?.length) return;
    this.gateway.emit('rt:event', this.wrap(resource, action, payload), { userIds });
  }

  /** Broadcast to every connected socket. Use sparingly (public catalogs). */
  broadcast(resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }) {
    this.gateway.emit('rt:event', this.wrap(resource, action, payload), { broadcast: true });
  }

  /** Send to all users with one of the given roles. */
  toRoles(roles: UserRole[], resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }) {
    this.gateway.emit('rt:event', this.wrap(resource, action, payload), { roles });
  }

  /** Send to a custom room (e.g. `venue:${id}`, `event:${id}`). */
  toRoom(room: string, resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }) {
    this.gateway.emit('rt:event', this.wrap(resource, action, payload), { room });
  }

  /** Convenience: notify both the affected user and staff. */
  toUserAndStaff(userId: string, resource: RealtimeResource, action: RealtimeAction, payload?: { id?: string; data?: any }) {
    this.toUser(userId, resource, action, payload);
    this.toStaff(resource, action, payload);
  }

  isOnline(userId: string) {
    return this.gateway.isOnline(userId);
  }
}
