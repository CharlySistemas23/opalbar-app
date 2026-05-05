import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
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
    private readonly redis: RedisService,
  ) {}

  // Audit fix: bell badge polls this constantly. The unread count gets
  // cached in Redis (10s TTL) and invalidated on markAsRead/markAllAsRead/
  // createNotification — turns hot-path DB count into a Redis HIT.
  private static unreadCacheKey(userId: string): string {
    return `notif:unread:${userId}`;
  }

  private async invalidateUnreadCache(userId: string): Promise<void> {
    await this.redis.del(NotificationsService.unreadCacheKey(userId)).catch(() => undefined);
  }

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

    const cacheKey = NotificationsService.unreadCacheKey(userId);
    const cached = await this.redis.get(cacheKey).catch(() => null);
    let unreadCount: number;
    if (cached !== null) {
      unreadCount = parseInt(cached, 10) || 0;
    } else {
      unreadCount = await this.prisma.notification.count({ where: { userId, read: false } });
      await this.redis.set(cacheKey, String(unreadCount), 10).catch(() => undefined);
    }
    return { ...paginate(data, total, page, limit), unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const r = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
    await this.invalidateUnreadCache(userId);
    this.realtime.toUser(userId, 'notification', 'read', { id: notificationId });
    return r;
  }

  async markAllAsRead(userId: string) {
    const r = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    await this.invalidateUnreadCache(userId);
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
    // The inner `data` field is Prisma JSON. Record<string, unknown> isn't
    // structurally identical to InputJsonValue (Prisma forbids `undefined`),
    // so we cast at the boundary.
    const notification = await this.prisma.notification.create({ data: data as any });
    await this.invalidateUnreadCache(data.userId);

    // Send push notification (placeholder — integrate FCM/APNs)
    await this.sendPush(data.userId, data.title, data.body, data.data, data.imageUrl);

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

    // Find an unread, recent notification with the SAME aggregation key.
    // Audit fix: previously orderBy createdAt desc + post-match meant that
    // when 2+ posts had unread aggregations, the query picked the most recent
    // unrelated one and matchesKey failed → new notification created instead
    // of merging. Now we filter by aggregationKey JSON path directly.
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        read: false,
        createdAt: { gte: since },
        data: { path: ['aggregationKey'], equals: input.aggregationKey } as any,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
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

      // Audit fix: la regla anterior (count===2 || count%5===0) dejaba huecos
      // raros: 1=push, 2=push, 3=NO, 4=NO, 5=push... La UI muestra "3 personas
      // reaccionaron" pero el push se saltaba a la #3. Ahora envia siempre y
      // el body actualizado refleja el conteo agregado, con un soft-throttle
      // por usuario+aggregationKey en Redis para evitar spam (max 1 push/min
      // por agregacion).
      const throttleKey = RedisService.cacheKey('notif', 'agg', input.userId, input.aggregationKey);
      const recentlySent = await this.redis.get(throttleKey).catch(() => null);
      if (!recentlySent) {
        await this.sendPush(input.userId, title, input.body ?? '', nextData, input.imageUrl ?? input.actor.avatarUrl);
        await this.redis.set(throttleKey, '1', 60).catch(() => {});
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
    imageUrl?: string,
  ) {
    await this.push.sendToUser(userId, {
      title,
      body,
      data,
      ...(imageUrl ? { richContent: { image: imageUrl } } : {}),
    });
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
    // Audit fix: antes incluiamos a TODOS los users ACTIVE con push token,
    // ignorando notificationSettings. Si un user apago "newEvents" o
    // "pushEnabled" en sus ajustes, igual recibia broadcasts. Ahora filtramos
    // por settings segun el tipo del broadcast.
    const settingField = NotificationsService.notificationSettingFieldFor(payload.type);
    const where = {
      status: 'ACTIVE' as const,
      pushTokens: { some: {} },
      OR: [
        { notificationSettings: null },
        {
          notificationSettings: {
            pushEnabled: true,
            ...(settingField ? { [settingField]: true } : {}),
          },
        },
      ],
    };

    // Audit fix: cursor-paginated batches to avoid OOM/connection-pool
    // exhaustion when user count grows. Previously findMany pulled every
    // eligible user + Promise.all opened N concurrent push + N inserts.
    const BATCH = 500;
    let cursor: string | undefined;
    let totalSent = 0;
    while (true) {
      const batch = await this.prisma.user.findMany({
        where,
        select: { id: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      const { sent } = await this.createForUsers(batch.map((r) => r.id), payload);
      totalSent += sent;
      if (batch.length < BATCH) break;
      cursor = batch[batch.length - 1].id;
    }
    return { sent: totalSent };
  }

  // Mapea NotificationType al boolean correspondiente en NotificationSettings.
  // Devuelve null para tipos sin granular control (siempre se respeta
  // pushEnabled global). Mantener sincronizado al agregar tipos nuevos.
  private static notificationSettingFieldFor(type: NotificationType): keyof Pick<
    {
      pushEnabled: boolean; emailEnabled: boolean; eventReminders: boolean;
      newEvents: boolean; newOffers: boolean; communityReplies: boolean;
      communityReactions: boolean; pointsUpdates: boolean;
      marketingEmails: boolean; weeklyDigest: boolean;
    },
    'eventReminders' | 'newEvents' | 'newOffers' | 'communityReplies' | 'communityReactions' | 'pointsUpdates'
  > | null {
    // Audit fix: VENUE_STORY_NEW was missing → broadcast bypassed the user's
    // newEvents toggle. LOYALTY_LEVEL_UP did not exist in the enum (correct
    // value is LEVEL_UP), so the pointsUpdates toggle never applied to that
    // type. Both fixed below.
    const map: Record<string, any> = {
      EVENT_NEW: 'newEvents',
      EVENT_REMINDER: 'eventReminders',
      VENUE_STORY_NEW: 'newEvents',
      OFFER_NEW: 'newOffers',
      OFFER_EXPIRING: 'newOffers',
      COMMUNITY_COMMENT: 'communityReplies',
      COMMUNITY_REACTION: 'communityReactions',
      POST_LIKE: 'communityReactions',
      POST_REACTION: 'communityReactions',
      POINTS_EARNED: 'pointsUpdates',
      LEVEL_UP: 'pointsUpdates',
    };
    return map[type] ?? null;
  }
}
