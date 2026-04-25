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

  /**
   * Instagram-style aggregation: when many users like the same post in a
   * short window we don't want N rows — we want one row that says
   * "Ana, Lucas y 3 más reaccionaron a tu publicación".
   *
   * Looks for an UNREAD notification on the same `aggregationKey` from the
   * last 24h. If found, merges the new actor into `data.actors[]` and bumps
   * the count + title. Otherwise creates a fresh notification seeded with
   * one actor.
   *
   * Caller passes a stable `aggregationKey` like `like:${postId}` —
   * granular enough that comments don't merge with reactions, and likes on
   * different posts stay separate.
   */
  async createOrAggregate(input: {
    userId: string;
    type: NotificationType;
    aggregationKey: string;
    actor: { id: string; name?: string; avatarUrl?: string };
    titleSingular: string;             // "Ana reaccionó a tu publicación"
    titlePlural: (count: number, first: string) => string; // (n, name) => `${name} y ${n - 1} más reaccionaron…`
    body?: string;
    extraData?: Record<string, unknown>;
    imageUrl?: string;
    windowMs?: number;                 // default 24h
  }) {
    const window = input.windowMs ?? 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - window);

    // Find an unread, recent notification with the same aggregation key
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        read: false,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    const matchesKey =
      existing &&
      typeof existing.data === 'object' &&
      existing.data !== null &&
      (existing.data as any).aggregationKey === input.aggregationKey;

    if (existing && matchesKey) {
      const prev = (existing.data as any) ?? {};
      const actors: Array<{ id: string; name?: string; avatarUrl?: string }> = Array.isArray(prev.actors)
        ? prev.actors
        : [];

      // Move actor to head, dedupe by id
      const filtered = actors.filter((a) => a.id !== input.actor.id);
      const nextActors = [input.actor, ...filtered].slice(0, 8);
      const count = nextActors.length;
      const firstName = nextActors[0]?.name ?? 'Alguien';

      const nextData = {
        ...prev,
        ...(input.extraData ?? {}),
        aggregationKey: input.aggregationKey,
        actors: nextActors,
        aggregatedCount: count,
        actorId: nextActors[0]?.id,
        actorName: firstName,
        actorAvatarUrl: nextActors[0]?.avatarUrl,
      };

      const title = count > 1 ? input.titlePlural(count, firstName) : input.titleSingular;

      const updated = await this.prisma.notification.update({
        where: { id: existing.id },
        data: {
          title,
          body: input.body ?? existing.body,
          data: nextData as any,
          createdAt: new Date(),       // float to top of list
        },
      });

      this.realtime.toUser(input.userId, 'notification', 'created', {
        id: updated.id,
        data: updated,
      });

      // Send push only if this is the SECOND interaction or every 5th —
      // avoids "Ana liked your post" five times in a row.
      if (count === 2 || count % 5 === 0) {
        await this.sendPush(input.userId, title, input.body ?? '', nextData);
      }

      return updated;
    }

    // No aggregate found → seed a new notification with one actor
    const seedData = {
      ...(input.extraData ?? {}),
      aggregationKey: input.aggregationKey,
      actors: [input.actor],
      aggregatedCount: 1,
      actorId: input.actor.id,
      actorName: input.actor.name,
      actorAvatarUrl: input.actor.avatarUrl,
    };

    return this.createNotification({
      userId: input.userId,
      type: input.type,
      title: input.titleSingular,
      body: input.body ?? '',
      data: seedData,
      imageUrl: input.imageUrl,
    });
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
