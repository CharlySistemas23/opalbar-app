import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
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

    return notification;
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  private async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    try {
      // Get active device tokens
      const sessions = await this.prisma.session.findMany({
        where: { userId, isActive: true, deviceToken: { not: null } },
        select: { deviceToken: true },
      });

      const tokens = sessions.map((s) => s.deviceToken!).filter(Boolean);

      if (tokens.length === 0) return;

      // Placeholder — In production: call FCM/APNs API
      this.logger.log(`Push notification queued for user ${userId}: "${title}" → ${tokens.length} device(s)`);

      // FCM implementation would go here:
      // const fcmServerKey = this.config.get('fcm.serverKey');
      // await fetch('https://fcm.googleapis.com/fcm/send', { ... })

    } catch (error) {
      this.logger.error(`Failed to send push to user ${userId}:`, error);
    }
  }
}
