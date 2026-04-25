import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset, PaginationDto } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
  ) {}

  async getNotifications(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getPaginationOffset(page, limit);

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({ where: { userId, read: false } });
    return { ...paginate(data, total, page, limit), unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const r = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
    this.realtime.toUser(userId, 'notification', 'read', { id: notificationId });
    return r;
  }

  async markAllAsRead(userId: string) {
    const r = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    this.realtime.toUser(userId, 'notification', 'read');
    return r;
  }

  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    titleEn?: string;
    body: string;
    bodyEn?: string;
    data?: Record<string, unknown>;
    imageUrl?: string;
  }) {
    const notification = await this.prisma.notification.create({ data });

    // Send push notification (placeholder — integrate FCM/APNs)
    await this.sendPush(data.userId, data.title, data.body, data.data);

    // Real-time push to the user's open sockets
    this.realtime.toUser(data.userId, 'notification', 'created', {
      id: notification.id,
      data: notification,
    });

    return notification;
  }

  async deleteNotification(userId: string, notificationId: string) {
    const r = await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    this.realtime.toUser(userId, 'notification', 'deleted', { id: notificationId });
    return r;
  }

  private async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    await this.push.sendToUser(userId, { title, body, data });
  }

  /**
   * Fan-out a notification to many users (followers, all active users, etc.).
   * Skips empty userId arrays. Failures per-user are swallowed so a single
   * failed push doesn't block the rest of the broadcast.
   */
  async createForUsers(
    userIds: string[],
    payload: {
      type: NotificationType;
      title: string;
      titleEn?: string;
      body: string;
      bodyEn?: string;
      data?: Record<string, unknown>;
      imageUrl?: string;
    },
  ) {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    if (unique.length === 0) return { sent: 0 };
    await Promise.all(
      unique.map((uid) =>
        this.createNotification({ userId: uid, ...payload }).catch((err) => {
          this.logger.warn(`createForUsers failed for ${uid}: ${err?.message}`);
        }),
      ),
    );
    return { sent: unique.length };
  }

  /**
   * Convenience helper: notify every active user with a real push token.
   * Used for venue stories, new events from the bar, and similar
   * "house-wide announcements". Returns the count of users notified.
   */
  async broadcastToAllActiveUsers(payload: {
    type: NotificationType;
    title: string;
    titleEn?: string;
    body: string;
    bodyEn?: string;
    data?: Record<string, unknown>;
    imageUrl?: string;
  }) {
    // Only users with at least one push token — saves work in the very common
    // case of accounts that never installed the APK (admin, seed, web-only).
    const rows = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', pushTokens: { some: {} } },
      select: { id: true },
    });
    return this.createForUsers(rows.map((r) => r.id), payload);
  }
}
