import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  AdminActionType,
  ModerationAction,
  NotificationType,
  Prisma,
  PostStatus,
  ReportStatus,
  UserRole,
  UserStatus,
  OtpType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset, PaginationDto } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CommunityGateway } from '../community/community.gateway';
import { CommunityService } from '../community/community.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpService } from '../otp/otp.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
    private readonly communityGateway: CommunityGateway,
    private readonly community: CommunityService,
    private readonly notifications: NotificationsService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
  ) {}

  async broadcastPush(title: string, body: string, audience: 'ALL' | 'ADMINS' = 'ALL', sentById?: string) {
    if (!title?.trim() || !body?.trim()) {
      throw new BadRequestException('title y body son requeridos');
    }
    const where: any = audience === 'ADMINS'
      ? { role: { in: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'] } }
      : { status: 'ACTIVE' };

    // Cursor-paginated batching. Backend audit P1 #2 (2026-05-18) — previous
    // `findMany` with no LIMIT was OOM-prone for audience='ALL' on large
    // user tables. Mirrors the fix in notifications.service.ts
    // broadcastToAllActiveUsers (commit 5b9d4f7).
    const BATCH = 500;
    let totalUsers = 0;
    let totalSent = 0;
    let cursor: string | undefined;
    // Safety cap to prevent runaway loops in case of corrupt cursor state.
    let safety = 200;
    while (safety-- > 0) {
      const page = await this.prisma.user.findMany({
        where,
        select: { id: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (page.length === 0) break;
      totalUsers += page.length;
      const { sent } = await this.notifications.createForUsers(
        page.map((u) => u.id),
        {
          type: NotificationType.SYSTEM,
          title,
          body,
          data: { type: 'BROADCAST', audience },
        },
      );
      totalSent += sent;
      if (page.length < BATCH) break;
      cursor = page[page.length - 1].id;
    }

    // Persistir en historial para que el admin vea qué mando, cuando y a cuantos.
    if (sentById) {
      await this.prisma.pushBroadcast.create({
        data: {
          title: title.slice(0, 200),
          body: body.slice(0, 500),
          audience,
          sentCount: totalSent,
          failedCount: Math.max(0, totalUsers - totalSent),
          sentById,
        },
      }).catch((err) => {
        this.logger.warn(`[admin] broadcast history persist failed: ${err?.message ?? err}`);
      });
    }
    this.logger.log(`📣 Broadcast persisted+pushed: ${totalSent}/${totalUsers} users (${audience})`);
    return { totalUsers, sent: totalSent };
  }

  async listBroadcasts() {
    return this.prisma.pushBroadcast.findMany({
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
  }

  // ── USERS ─────────────────────────────────

  async listUsers(pagination: PaginationDto & { search?: string; status?: UserStatus; role?: UserRole }) {
    const { page = 1, limit = 20, search, status, role } = pagination;
    const skip = getPaginationOffset(page, limit);

    const where: any = {
      ...(status && { status }),
      ...(role && { role }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { profile: { firstName: { contains: search, mode: 'insensitive' } } },
          { profile: { lastName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take: limit,
        include: {
          profile: { include: { loyaltyLevel: true } },
          interests: {
            include: { category: { select: { name: true, color: true, icon: true } } },
            take: 1,
          },
          _count: {
            select: {
              posts: true,
              reservations: true,
              reportedItems: true,
              reviews: true,
              followers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Attach last successful login in one batched query
    const userIds = data.map((u: any) => u.id);
    const logins = userIds.length
      ? await this.prisma.loginAttempt.findMany({
          where: { userId: { in: userIds }, success: true },
          orderBy: { createdAt: 'desc' },
          distinct: ['userId'],
          select: { userId: true, createdAt: true },
        })
      : [];
    const loginMap = new Map(logins.map((l) => [l.userId!, l.createdAt]));

    const enriched = data.map(({ passwordHash: _, ...u }: any) => ({
      ...u,
      lastLoginAt: loginMap.get(u.id) ?? null,
    }));

    return paginate(enriched, total, page, limit);
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { loyaltyLevel: true } },
        interests: { include: { category: true } },
        consent: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            reservations: true,
            reports: true,           // reports MADE by this user
            reportedItems: true,     // reports AGAINST this user
            followers: true,
            following: true,
            events: true,
            reviews: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Strip password hash
    const { passwordHash: _ph, ...safeUser } = user as any;

    // Recent activity samples (last 3 of each, lightweight)
    const [
      recentPosts,
      recentReservations,
      recentReports,
      recentRedemptions,
      recentWallet,
      recentAudit,
      lastLogin,
    ] = await Promise.all([
      this.prisma.post.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, content: true, status: true, imageUrl: true, createdAt: true },
      }),
      this.prisma.reservation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true, date: true, timeSlot: true, partySize: true, status: true, createdAt: true,
          venue: { select: { id: true, name: true } },
        },
      }),
      this.prisma.report.findMany({
        where: { targetType: 'USER', targetId: userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, reason: true, description: true, status: true, createdAt: true },
      }),
      this.prisma.offerRedemption.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, code: true, isUsed: true, usedAt: true, createdAt: true,
          offer: { select: { id: true, title: true, type: true } },
        },
      }),
      this.prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, type: true, points: true, balance: true, description: true,
          referenceType: true, createdAt: true,
        },
      }),
      this.prisma.adminActionLog.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          adminUser: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.loginAttempt.findFirst({
        where: { userId, success: true },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, ipAddress: true },
      }),
    ]);

    return {
      ...safeUser,
      recentPosts,
      recentReservations,
      reportsAgainst: recentReports,
      recentRedemptions,
      recentWallet,
      auditLog: recentAudit,
      lastLogin,
    };
  }

  // ─────────────────────────────────────────
  //  ADMIN AUDIT + INTERNAL NOTE
  // ─────────────────────────────────────────

  private async logAdminAction(params: {
    adminId: string;
    targetUserId: string;
    action: AdminActionType;
    summary: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }) {
    await this.prisma.adminActionLog.create({
      data: {
        adminUserId: params.adminId,
        targetUserId: params.targetUserId,
        action: params.action,
        summary: params.summary.slice(0, 300),
        before: params.before,
        after: params.after,
        metadata: params.metadata,
      },
    });
  }

  async getUserAuditLog(userId: string, limit = 50) {
    return this.prisma.adminActionLog.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
      include: {
        adminUser: {
          select: {
            id: true, email: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  async updateInternalNote(adminId: string, userId: string, note: string | null) {
    const existing = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { internalNote: true },
    });
    if (!existing) throw new NotFoundException('Profile not found');

    const trimmed = (note ?? '').trim();
    const next = trimmed.length ? trimmed.slice(0, 2000) : null;

    await this.prisma.userProfile.update({
      where: { userId },
      data: { internalNote: next },
    });

    await this.logAdminAction({
      adminId,
      targetUserId: userId,
      action: existing.internalNote ? AdminActionType.NOTE_UPDATED : AdminActionType.NOTE_ADDED,
      summary: next ? `Nota actualizada (${next.length} chars)` : 'Nota eliminada',
      before: { internalNote: existing.internalNote ?? null },
      after: { internalNote: next },
    });

    return { success: true, internalNote: next };
  }

  // ─────────────────────────────────────────
  //  AUDIENCE INSIGHTS — "Mis clientes" aggregate panel
  // ─────────────────────────────────────────

  async getAudienceInsights() {
    const now = new Date();
    const thirty = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninety = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const notDeleted: Prisma.UserWhereInput = { status: { not: 'DELETED' } };

    const [
      totalActive,
      signups30d,
      signups90dRows,
      statusRows,
      genderRows,
      discoveryRows,
      cityRows,
      loyaltyRows,
      interestRows,
      topUsers,
      pointsAgg,
      engagement,
      active7d,
    ] = await Promise.all([
      this.prisma.user.count({ where: notDeleted }),
      this.prisma.user.count({ where: { ...notDeleted, createdAt: { gte: thirty } } }),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "User"
        WHERE "createdAt" >= ${ninety} AND "status" <> 'DELETED'
        GROUP BY day
        ORDER BY day ASC
      `),
      this.prisma.user.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.userProfile.groupBy({
        by: ['gender'],
        _count: { _all: true },
      }),
      this.prisma.userProfile.groupBy({
        by: ['discoverySource'],
        _count: { _all: true },
      }),
      this.prisma.userProfile.groupBy({
        by: ['city'],
        _count: { _all: true },
        orderBy: { _count: { city: 'desc' } },
        take: 10,
      }),
      this.prisma.userProfile.groupBy({
        by: ['loyaltyLevelId'],
        _count: { _all: true },
      }),
      this.prisma.userInterest.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 10,
      }),
      this.prisma.user.findMany({
        where: notDeleted,
        orderBy: { points: 'desc' },
        take: 10,
        select: {
          id: true, email: true, points: true,
          profile: { select: { firstName: true, lastName: true, avatarUrl: true, loyaltyLevel: { select: { name: true, color: true } } } },
        },
      }),
      this.prisma.user.aggregate({
        where: notDeleted,
        _avg: { points: true },
        _sum: { points: true },
      }),
      this.prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>(Prisma.sql`
        SELECT bucket, COUNT(*)::bigint AS count FROM (
          SELECT
            CASE
              WHEN (SELECT COUNT(*) FROM "Post" p WHERE p."userId" = u."id" AND p."deletedAt" IS NULL) = 0 THEN 'inactive'
              WHEN (SELECT COUNT(*) FROM "Post" p WHERE p."userId" = u."id" AND p."deletedAt" IS NULL) < 3 THEN 'casual'
              WHEN (SELECT COUNT(*) FROM "Post" p WHERE p."userId" = u."id" AND p."deletedAt" IS NULL) < 10 THEN 'engaged'
              ELSE 'super'
            END AS bucket
          FROM "User" u
          WHERE u."status" <> 'DELETED'
        ) s
        GROUP BY bucket
      `),
      this.prisma.loginAttempt.groupBy({
        by: ['userId'],
        where: { success: true, createdAt: { gte: sevenDays }, userId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const loyaltyLevels = await this.prisma.loyaltyLevel.findMany({
      select: { id: true, name: true, color: true, icon: true, minPoints: true },
    });
    const loyaltyMap = new Map(loyaltyLevels.map((l) => [l.id, l]));

    const categories = await this.prisma.eventCategory.findMany({
      where: { id: { in: interestRows.map((r) => r.categoryId) } },
      select: { id: true, name: true, slug: true, color: true, icon: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Age buckets from profiles.birthDate
    const profilesWithBirth = await this.prisma.userProfile.findMany({
      where: { birthDate: { not: null } },
      select: { birthDate: true },
    });
    const ageBuckets: Record<string, number> = { '<18': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0 };
    for (const p of profilesWithBirth) {
      if (!p.birthDate) continue;
      const age = Math.floor((now.getTime() - p.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) ageBuckets['<18']++;
      else if (age < 25) ageBuckets['18-24']++;
      else if (age < 35) ageBuckets['25-34']++;
      else if (age < 45) ageBuckets['35-44']++;
      else if (age < 55) ageBuckets['45-54']++;
      else ageBuckets['55+']++;
    }

    // Reservation hour histogram
    const reservationRows = await this.prisma.reservation.findMany({
      where: { createdAt: { gte: ninety } },
      select: { timeSlot: true, date: true },
    });
    const hourBuckets: Record<string, number> = {};
    const dowBuckets: Record<number, number> = {};
    for (const r of reservationRows) {
      const hour = r.timeSlot.split(':')[0] ?? '00';
      hourBuckets[hour] = (hourBuckets[hour] ?? 0) + 1;
      const dow = new Date(r.date).getDay();
      dowBuckets[dow] = (dowBuckets[dow] ?? 0) + 1;
    }

    // Normalize raw rows
    const signupsByDay = signups90dRows.map((r) => ({
      day: (r.day as any).toISOString().slice(0, 10),
      count: Number(r.count),
    }));

    const genderBreakdown = genderRows.map((r) => ({
      key: r.gender ?? 'UNKNOWN',
      count: r._count._all,
    }));

    const discoveryBreakdown = discoveryRows.map((r) => ({
      key: r.discoverySource ?? 'UNKNOWN',
      count: r._count._all,
    }));

    const statusBreakdown = statusRows.map((r) => ({
      key: r.status,
      count: r._count._all,
    }));

    const topCities = cityRows
      .filter((r) => r.city)
      .map((r) => ({ city: r.city as string, count: r._count._all }));

    const loyaltyBreakdown = loyaltyRows.map((r) => {
      const level = r.loyaltyLevelId ? loyaltyMap.get(r.loyaltyLevelId) : null;
      return {
        id: r.loyaltyLevelId,
        name: level?.name ?? 'Sin nivel',
        color: level?.color,
        icon: level?.icon,
        count: r._count._all,
      };
    });

    const topInterests = interestRows.map((r) => ({
      categoryId: r.categoryId,
      name: categoryMap.get(r.categoryId)?.name ?? r.categoryId,
      slug: categoryMap.get(r.categoryId)?.slug,
      color: categoryMap.get(r.categoryId)?.color,
      icon: categoryMap.get(r.categoryId)?.icon,
      count: r._count._all,
    }));

    const engagementBuckets = engagement.reduce(
      (acc, row) => {
        acc[row.bucket] = Number(row.count);
        return acc;
      },
      { inactive: 0, casual: 0, engaged: 0, super: 0 } as Record<string, number>,
    );

    return {
      totals: {
        totalActive,
        signups30d,
        activeLast7d: active7d.length,
        averagePoints: Math.round(pointsAgg._avg.points ?? 0),
        totalPointsInCirculation: pointsAgg._sum.points ?? 0,
      },
      signupsByDay,
      statusBreakdown,
      genderBreakdown,
      discoveryBreakdown,
      ageBuckets,
      topCities,
      topInterests,
      loyaltyBreakdown,
      engagementBuckets,
      reservationHours: Object.entries(hourBuckets)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
      reservationDow: Object.entries(dowBuckets)
        .map(([dow, count]) => ({ dow: Number(dow), count }))
        .sort((a, b) => a.dow - b.dow),
      topUsers: topUsers.map(({ ...u }) => u),
    };
  }

  async adjustUserPoints(adminId: string, userId: string, delta: number, reason: string) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('delta must be a non-zero integer');
    }
    if (!reason?.trim()) throw new BadRequestException('reason is required');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newPoints = Math.max(0, user.points + delta);
    const effectiveDelta = newPoints - user.points;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { points: newPoints },
      }),
      this.prisma.walletTransaction.create({
        data: {
          userId,
          type: 'ADJUSTMENT',
          points: effectiveDelta,
          balance: newPoints,
          description: reason.trim(),
          referenceType: 'ADMIN_ADJUSTMENT',
          referenceId: adminId,
        },
      }),
    ]);

    await this.logAdminAction({
      adminId,
      targetUserId: userId,
      action: AdminActionType.POINTS_ADJUST,
      summary: `${effectiveDelta > 0 ? '+' : ''}${effectiveDelta} pts · ${reason.trim()}`,
      before: { points: user.points },
      after: { points: newPoints },
      metadata: { requestedDelta: delta, effectiveDelta },
    });

    return { success: true, newBalance: newPoints, delta: effectiveDelta };
  }

  async banUser(moderatorId: string, userId: string, reason: string) {
    if (userId === moderatorId) throw new BadRequestException('Cannot ban yourself');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.BANNED } }),
      this.prisma.moderationLog.create({
        data: { moderatorId, targetType: 'USER', targetId: userId, action: ModerationAction.BANNED_USER, reason },
      }),
    ]);

    await this.logAdminAction({
      adminId: moderatorId,
      targetUserId: userId,
      action: AdminActionType.BAN,
      summary: `Baneado · ${reason || 'sin motivo'}`,
      before: { status: user.status },
      after: { status: UserStatus.BANNED },
    });

    this.realtime.toUserAndStaff(userId, 'user', 'banned', { id: userId, data: { reason } });
  }

  async unbanUser(moderatorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } }),
      this.prisma.moderationLog.create({
        data: { moderatorId, targetType: 'USER', targetId: userId, action: ModerationAction.APPROVED, reason: 'Unban' },
      }),
    ]);

    await this.logAdminAction({
      adminId: moderatorId,
      targetUserId: userId,
      action: AdminActionType.UNBAN,
      summary: 'Usuario reactivado',
      before: { status: user?.status ?? null },
      after: { status: UserStatus.ACTIVE },
    });

    this.realtime.toUserAndStaff(userId, 'user', 'unbanned', { id: userId });
  }

  async updateUserRole(adminId: string, userId: string, role: UserRole) {
    if (userId === adminId) {
      throw new BadRequestException('No puedes cambiar tu propio rol');
    }
    const prev = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (!prev) throw new NotFoundException('User not found');
    if (prev.role === role) {
      return this.prisma.user.findUnique({ where: { id: userId } });
    }
    // Never demote the last SUPER_ADMIN — the platform would lose its owner.
    if (prev.role === UserRole.SUPER_ADMIN && role !== UserRole.SUPER_ADMIN) {
      const remaining = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, status: { not: UserStatus.DELETED }, id: { not: userId } },
      });
      if (remaining === 0) {
        throw new BadRequestException('No puedes quitar el rol al último SUPER_ADMIN');
      }
    }
    const result = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    await this.logAdminAction({
      adminId,
      targetUserId: userId,
      action: AdminActionType.ROLE_CHANGE,
      summary: `Rol ${prev?.role ?? '?'} → ${role}`,
      before: { role: prev?.role ?? null },
      after: { role },
    });
    this.realtime.toUserAndStaff(userId, 'user', 'role_changed', { id: userId, data: { role } });
    return result;
  }

  // ── POSTS MODERATION ─────────────────────

  /**
   * Moderation feed. Posts publish immediately (PUBLISHED) and admins verify
   * afterwards, so by default this lists EVERY status (newest first). Filters:
   *  · `status`   — PostStatus
   *  · `reported` — only posts with ≥1 PENDING report
   *  · `search`   — content / author email / author name
   */
  async getPosts(filter: PaginationDto & { status?: PostStatus; reported?: boolean }) {
    const { page = 1, limit = 20, status, reported, search } = filter;
    const skip = getPaginationOffset(page, limit);
    const q = search?.trim();

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(reported ? { reports: { some: { status: ReportStatus.PENDING } } } : {}),
      ...(q
        ? {
            OR: [
              { content: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
              { user: { profile: { firstName: { contains: q, mode: 'insensitive' } } } },
              { user: { profile: { lastName: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where, skip, take: limit,
        include: {
          user: {
            select: {
              id: true, email: true, role: true, status: true,
              profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
              reports: { where: { status: ReportStatus.PENDING } },
              emojiReactions: true,
            },
          },
        },
        // The moderation queue is FIFO — oldest flagged post first, so nothing
        // rots at the bottom of the list. Every other filter is newest-first.
        orderBy:
          status === PostStatus.PENDING_REVIEW
            ? [{ createdAt: 'asc' }]
            : status
              ? [{ createdAt: 'desc' }]
              : [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.post.count({ where }),
    ]);

    return paginate(data.map((p) => this.shapeAdminPost(p)), total, page, limit);
  }

  /** Any status, includes author email, pending + resolved reports and moderation history. */
  async getPostDetail(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true, email: true, role: true, status: true, createdAt: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
            _count: { select: { posts: true, reportedItems: true } },
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            reporter: {
              select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } },
            },
          },
        },
        _count: {
          select: {
            comments: { where: { deletedAt: null } },
            reports: { where: { status: ReportStatus.PENDING } },
            emojiReactions: true,
          },
        },
      },
    });
    if (!post) throw new NotFoundException('Post not found');

    const moderationLog = await this.prisma.moderationLog.findMany({
      where: { targetType: 'POST', targetId: postId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        moderator: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });

    return { ...this.shapeAdminPost(post), moderationLog };
  }

  /** Unified moderation payload: unified likesCount, marker-free mediaUrls, surface, counts. */
  private shapeAdminPost(post: any) {
    const WALL_MARKER = '__WALL__';
    const rawMedia: string[] = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
    const surface = rawMedia.includes(WALL_MARKER) ? 'wall' : 'community';
    const mediaUrls = rawMedia.filter((u) => u !== WALL_MARKER);
    if (post.imageUrl && !mediaUrls.includes(post.imageUrl)) mediaUrls.unshift(post.imageUrl);
    const { _count, user, ...rest } = post;
    return {
      ...rest,
      user,
      author: user,
      surface,
      mediaUrls,
      likesCount: Math.max(post.likesCount ?? 0, _count?.emojiReactions ?? 0),
      commentsCount: _count?.comments ?? post.commentsCount ?? 0,
      reportsCount: _count?.reports ?? 0,
      _count,
    };
  }

  /**
   * Single entry point for the moderation feed actions.
   *  · PUBLISHED → approve (points + POST_APPROVED once, from PENDING_REVIEW)
   *  · REJECTED  → reject (POST_REJECTED with reason)
   *  · HIDDEN    → hide silently (kept for the author, off the feed)
   */
  async setPostStatus(moderatorId: string, postId: string, status: PostStatus, reason?: string) {
    if (status === PostStatus.PUBLISHED) {
      await this.moderatePost(moderatorId, postId, 'approve');
    } else if (status === PostStatus.REJECTED) {
      await this.moderatePost(moderatorId, postId, 'reject', reason);
    } else if (status === PostStatus.HIDDEN) {
      const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true, deletedAt: true } });
      if (!post || post.deletedAt) throw new NotFoundException('Post not found');
      await this.prisma.$transaction([
        this.prisma.post.update({ where: { id: postId }, data: { status: PostStatus.HIDDEN, rejectionReason: reason ?? null } }),
        this.prisma.moderationLog.create({
          data: { moderatorId, targetType: 'POST', targetId: postId, action: ModerationAction.HIDDEN, reason },
        }),
      ]);
      await this.community.invalidateFeedCache();
      this.realtime.broadcast('post', 'hidden', { id: postId });
      this.communityGateway.emitChanged({ type: 'post_deleted', postId });
    } else {
      throw new BadRequestException('Estado no permitido. Usa PUBLISHED, HIDDEN o REJECTED');
    }
    return this.getPostDetail(postId);
  }

  /** Soft-delete from the moderation panel (same semantics as staff delete in community). */
  async deletePost(moderatorId: string, postId: string, role: UserRole) {
    await this.community.deletePost(postId, moderatorId, role);
    await this.prisma.moderationLog.create({
      data: { moderatorId, targetType: 'POST', targetId: postId, action: ModerationAction.HIDDEN, reason: 'Eliminado por moderación' },
    }).catch(() => null);
    return { success: true };
  }

  async moderatePost(moderatorId: string, postId: string, action: 'approve' | 'reject', reason?: string) {
    const status = action === 'approve' ? PostStatus.PUBLISHED : PostStatus.REJECTED;
    const moderationAction = action === 'approve' ? ModerationAction.APPROVED : ModerationAction.REJECTED;

    // Fetch the post so we know the author (for points) and can skip re-approving.
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true, status: true } });
    if (!post) throw new NotFoundException('Post not found');

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: postId },
        data: { status, rejectionReason: action === 'reject' ? reason : null },
      }),
      this.prisma.moderationLog.create({
        data: { moderatorId, targetType: 'POST', targetId: postId, action: moderationAction, reason },
      }),
    ]);

    // Award points only when transitioning PENDING_REVIEW → PUBLISHED.
    // (Author only earns once; re-approving a rejected post doesn't re-award.)
    if (action === 'approve' && post.status === PostStatus.PENDING_REVIEW) {
      const POINTS = 5;
      const updated = await this.prisma.user.update({
        where: { id: post.userId },
        data: { points: { increment: POINTS } },
        select: { points: true },
      });
      await this.prisma.walletTransaction.create({
        data: {
          userId: post.userId,
          type: 'EARN',
          points: POINTS,
          balance: updated.points,
          description: 'Puntos por publicación aprobada',
          referenceId: postId,
          referenceType: 'POST_ENGAGEMENT',
        },
      });
    }

    // Bust the 20 s feed cache so the next mobile fetch sees the new state.
    await this.community.invalidateFeedCache();

    this.realtime.broadcast('post', action === 'approve' ? 'approved' : 'rejected', { id: postId, data: { reason } });
    this.realtime.toUser(post.userId, 'post', action === 'approve' ? 'approved' : 'rejected', { id: postId, data: { reason } });
    // Notify the legacy /community socket so mobile feeds (which subscribe via
    // useCommunityRealtime) reload and surface the newly published post.
    if (action === 'approve' && post.status === PostStatus.PENDING_REVIEW) {
      this.communityGateway.emitChanged({ type: 'post_created', postId });

      // Push to the author: their post is now live.
      this.notifications
        .createNotification({
          userId: post.userId,
          type: NotificationType.POST_APPROVED,
          title: 'Tu publicación fue aprobada',
          titleEn: 'Your post was approved',
          body: 'Ya está visible para la comunidad.',
          bodyEn: 'It is now visible to the community.',
          data: { postId },
        })
        .catch(() => {});

      // Fan-out to the author's followers — same trigger Instagram uses for
      // "X posted something new". We do this only on first approval so reposts
      // (re-approving an edited post) don't re-spam followers.
      this.prisma.follow
        .findMany({ where: { followingId: post.userId }, select: { followerId: true } })
        .then(async (rows) => {
          if (rows.length === 0) return;
          const profile = await this.prisma.userProfile.findUnique({
            where: { userId: post.userId },
            select: { firstName: true, lastName: true, avatarUrl: true },
          });
          const authorName =
            `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || 'Alguien';
          await this.notifications.createForUsers(
            rows.map((r) => r.followerId),
            {
              type: NotificationType.COMMUNITY_NEW_POST,
              title: 'Nueva publicación',
              titleEn: 'New post',
              body: `${authorName} publicó algo nuevo.`,
              bodyEn: `${authorName} just posted.`,
              data: { postId, authorId: post.userId, authorName, authorAvatarUrl: profile?.avatarUrl ?? null },
            },
          );
        })
        .catch((err) => this.logger.warn(`follower fan-out failed: ${err?.message}`));
    } else if (action === 'reject') {
      this.communityGateway.emitChanged({ type: 'post_deleted', postId });

      // Tell the author *why* it was rejected so they can fix it.
      this.notifications
        .createNotification({
          userId: post.userId,
          type: NotificationType.POST_REJECTED,
          title: 'Tu publicación fue rechazada',
          titleEn: 'Your post was rejected',
          body: reason ? `Motivo: ${reason}` : 'Revisa las normas de la comunidad.',
          bodyEn: reason ? `Reason: ${reason}` : 'Please review community guidelines.',
          data: { postId, reason: reason ?? null },
        })
        .catch(() => {});
    }
  }

  /**
   * Moderate up to 100 posts in a single call. Caps protect DB from runaway selections.
   * Skips IDs that are not in PENDING_REVIEW to make the call idempotent.
   * Returns `{ processed, skipped }` so the UI can show a result toast.
   */
  async bulkModeratePosts(
    moderatorId: string,
    postIds: string[],
    action: 'approve' | 'reject',
    reason?: string,
  ): Promise<{ processed: number; skipped: number }> {
    if (!Array.isArray(postIds) || postIds.length === 0) {
      throw new BadRequestException('No post ids provided');
    }
    if (postIds.length > 100) {
      throw new BadRequestException('Maximum 100 posts per bulk action');
    }

    const targetStatus = action === 'approve' ? PostStatus.PUBLISHED : PostStatus.REJECTED;
    const moderationAction = action === 'approve' ? ModerationAction.APPROVED : ModerationAction.REJECTED;

    // Only operate on posts still pending — avoids re-moderating already-decided items.
    const pending = await this.prisma.post.findMany({
      where: { id: { in: postIds }, status: PostStatus.PENDING_REVIEW, deletedAt: null },
      select: { id: true, userId: true },
    });
    const actionableIds = pending.map((p) => p.id);
    const skipped = postIds.length - actionableIds.length;

    if (actionableIds.length === 0) {
      return { processed: 0, skipped };
    }

    await this.prisma.$transaction([
      this.prisma.post.updateMany({
        where: { id: { in: actionableIds } },
        data: {
          status: targetStatus,
          rejectionReason: action === 'reject' ? reason : null,
        },
      }),
      this.prisma.moderationLog.createMany({
        data: actionableIds.map((id) => ({
          moderatorId,
          targetType: 'POST' as const,
          targetId: id,
          action: moderationAction,
          reason,
        })),
      }),
    ]);

    // Award points per approved post — each author gets +5 for their own post only.
    if (action === 'approve') {
      const POINTS = 5;
      for (const p of pending) {
        const updated = await this.prisma.user.update({
          where: { id: p.userId },
          data: { points: { increment: POINTS } },
          select: { points: true },
        });
        await this.prisma.walletTransaction.create({
          data: {
            userId: p.userId,
            type: 'EARN',
            points: POINTS,
            balance: updated.points,
            description: 'Puntos por publicación aprobada',
            referenceId: p.id,
            referenceType: 'POST_ENGAGEMENT',
          },
        });
      }
    }

    await this.community.invalidateFeedCache();

    for (const p of pending) {
      this.realtime.broadcast('post', action === 'approve' ? 'approved' : 'rejected', { id: p.id });
      this.realtime.toUser(p.userId, 'post', action === 'approve' ? 'approved' : 'rejected', { id: p.id });
      this.communityGateway.emitChanged({
        type: action === 'approve' ? 'post_created' : 'post_deleted',
        postId: p.id,
      });
    }

    return { processed: actionableIds.length, skipped };
  }

  // ── REPORTS ───────────────────────────────

  /**
   * Reports list. `status` defaults to PENDING (the moderation queue); pass
   * `status=ALL` to list every report. `search` matches description, reporter
   * email/name or the exact target id.
   */
  async getReports(filter: PaginationDto & { status?: ReportStatus | 'ALL' }) {
    const { page = 1, limit = 20, search } = filter;
    const status = filter.status ?? ReportStatus.PENDING;
    const skip = getPaginationOffset(page, limit);
    const q = search?.trim();

    const where: Prisma.ReportWhereInput = {
      ...(status !== 'ALL' ? { status } : {}),
      ...(q
        ? {
            OR: [
              { targetId: q },
              { description: { contains: q, mode: 'insensitive' } },
              { reporter: { email: { contains: q, mode: 'insensitive' } } },
              { reporter: { profile: { firstName: { contains: q, mode: 'insensitive' } } } },
              { reporter: { profile: { lastName: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where, skip, take: limit,
        include: {
          reporter: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
        orderBy: status === ReportStatus.PENDING ? { createdAt: 'asc' } : { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async listGdprRequests() {
    const [exports, deletions] = await Promise.all([
      this.prisma.dataExportRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        },
        take: 100,
      }),
      this.prisma.dataDeletionRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        },
        take: 100,
      }),
    ]);
    return { exports, deletions };
  }

  async processExportRequest(id: string, action: 'APPROVE' | 'REJECT') {
    const request = await this.prisma.dataExportRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    if (action === 'REJECT') {
      // DataRequestStatus has no REJECTED — a rejected request is closed as FAILED.
      const r = await this.prisma.dataExportRequest.update({
        where: { id },
        data: { status: 'FAILED', processedAt: new Date() },
      });
      this.realtime.toUserAndStaff(request.userId, 'gdpr', 'rejected', { id, data: { kind: 'export' } });
      return r;
    }

    const payload = await this.buildUserExportBundle(request.userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = this.signExportToken(id, expiresAt.getTime());
    const apiBase = (this.config.get<string>('API_PUBLIC_URL')
      ?? this.config.get<string>('app.publicUrl')
      ?? 'https://api.opalbar.com').replace(/\/+$/, '');
    const downloadUrl = `${apiBase}/api/v1/users/me/export/download/${id}?token=${token}`;

    const r = await this.prisma.dataExportRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        downloadUrl,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: request.userId },
      select: { email: true, profile: { select: { firstName: true } } },
    });
    if (user?.email) {
      const firstName = user.profile?.firstName ?? '';
      const subject = 'OPALBAR — Tu exportación de datos está lista';
      const expiresStr = expiresAt.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
      const text = [
        `Hola ${firstName},`,
        ``,
        `Procesamos tu solicitud de exportación de datos personales (GDPR).`,
        `Descarga tu archivo JSON desde el siguiente enlace:`,
        ``,
        downloadUrl,
        ``,
        `El enlace expira el ${expiresStr}.`,
        ``,
        `Si no fuiste tú quien solicitó esta exportación, contacta a soporte de inmediato.`,
        ``,
        `— Equipo OPALBAR`,
      ].join('\n');
      const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 8px">Tu exportación de datos está lista</h2>
  <p style="color:#555;margin:0 0 16px">Hola ${firstName || ''}, procesamos tu solicitud de exportación de datos personales (GDPR).</p>
  <p style="margin:24px 0">
    <a href="${downloadUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Descargar mis datos (JSON)</a>
  </p>
  <p style="color:#888;font-size:13px">El enlace expira el <strong>${expiresStr}</strong>.</p>
  <p style="color:#aaa;font-size:12px;margin-top:32px">Si no fuiste tú quien solicitó esta exportación, contacta a soporte de inmediato.</p>
</div>`.trim();
      try {
        await this.otp.sendEmail(user.email, subject, html, text);
      } catch (err: any) {
        this.logger.warn(`[GDPR] Failed to email export link to ${user.email}: ${err?.message ?? err}`);
      }
    }

    this.realtime.toUserAndStaff(request.userId, 'gdpr', 'approved', { id, data: { kind: 'export', downloadUrl } });
    return r;
  }

  /**
   * Returns the export payload only when the signed token is valid and the
   * request hasn't expired. Public endpoint — token is the auth.
   */
  async fetchExportPayload(id: string, token: string) {
    const request = await this.prisma.dataExportRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'COMPLETED' || !request.payloadJson) {
      throw new NotFoundException('Export not available');
    }
    if (request.expiresAt && request.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Export expired');
    }
    const expected = this.signExportToken(id, request.expiresAt?.getTime() ?? 0);
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
      throw new NotFoundException('Invalid token');
    }
    return request.payloadJson;
  }

  private signExportToken(requestId: string, expiresAtMs: number): string {
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }
    return crypto
      .createHmac('sha256', secret)
      .update(`gdpr-export:${requestId}:${expiresAtMs}`)
      .digest('hex');
  }

  private async buildUserExportBundle(userId: string) {
    const [user, posts, comments, reservations, reviews, follows, followers, sessions, points, notificationsLog] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true, email: true, phone: true, role: true, status: true, isVerified: true,
            points: true, createdAt: true, lastSeenAt: true, dmPolicy: true, friendPolicy: true,
            mentionPolicy: true, isPrivate: true,
            profile: true,
            interests: { select: { category: { select: { name: true, slug: true } } } },
            consent: true,
            notificationSettings: true,
          },
        }),
        this.prisma.post.findMany({
          where: { userId },
          select: { id: true, content: true, imageUrl: true, mediaUrls: true, status: true, createdAt: true, updatedAt: true },
        }),
        this.prisma.comment.findMany({
          where: { userId },
          select: { id: true, postId: true, content: true, createdAt: true, updatedAt: true },
        }),
        this.prisma.reservation.findMany({
          where: { userId },
          select: {
            id: true, status: true, partySize: true, date: true, timeSlot: true,
            specialRequests: true, confirmCode: true, createdAt: true,
            venue: { select: { name: true } },
          },
        }),
        this.prisma.review.findMany({
          where: { userId },
          select: {
            id: true, rating: true, title: true, body: true, pros: true, cons: true,
            visitDate: true, status: true, createdAt: true,
            venue: { select: { name: true } },
          },
        }),
        this.prisma.follow.findMany({
          where: { followerId: userId },
          select: { followingId: true, createdAt: true },
        }),
        this.prisma.follow.findMany({
          where: { followingId: userId },
          select: { followerId: true, createdAt: true },
        }),
        this.prisma.session.findMany({
          where: { userId },
          select: {
            id: true, deviceName: true, deviceOs: true, ipAddress: true, userAgent: true,
            createdAt: true, updatedAt: true, expiresAt: true, isActive: true,
          },
        }),
        this.prisma.walletTransaction.findMany({
          where: { userId },
          select: {
            id: true, type: true, points: true, balance: true, description: true,
            referenceType: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.notification.findMany({
          where: { userId },
          select: { id: true, type: true, title: true, body: true, createdAt: true, readAt: true },
          take: 1000,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        format: 'opalbar-gdpr-export-v1',
        userId,
      },
      account: user,
      posts,
      comments,
      reservations,
      reviews,
      following: follows,
      followers,
      sessions,
      pointsTransactions: points,
      notifications: notificationsLog,
    };
  }

  async processDeletionRequest(id: string, action: 'APPROVE' | 'REJECT') {
    const request = await this.prisma.dataDeletionRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    if (action === 'REJECT') {
      const r = await this.prisma.dataDeletionRequest.update({
        where: { id },
        data: { status: 'FAILED', processedAt: new Date() },
      });
      this.realtime.toUserAndStaff(request.userId, 'gdpr', 'rejected', { id, data: { kind: 'deletion' } });
      return r;
    }

    await this.softDeleteUser(request.userId);
    await this.prisma.dataDeletionRequest.update({
      where: { id },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });
    this.realtime.toUserAndStaff(request.userId, 'gdpr', 'approved', { id, data: { kind: 'deletion' } });
    this.realtime.toStaff('user', 'deleted', { id: request.userId });
    return { success: true };
  }

  /**
   * Soft-delete a user while freeing up their email/phone so they can register
   * again if they want. We null out the unique identifiers (Postgres allows
   * multiple NULLs under a unique constraint), clear PII, revoke sessions, and
   * mark the status as DELETED with a timestamp. Content (posts, comments,
   * reservations, etc.) is kept for audit but will render as "Usuario eliminado".
   */
  async softDeleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Note: in-flight access tokens stay valid until natural expiry (1h).
    // The Session model doesn't persist `jti`, so per-token blocklist isn't
    // possible without a schema migration. JwtStrategy already rejects DELETED
    // users (jwt.strategy.ts) — that's the actual access-time guard.
    await this.prisma.$transaction([
      // 1) Free the email/phone unique slots + clear PII on user record
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: null,
          phone: null,
          passwordHash: null,
          status: 'DELETED',
          isVerified: false,
          deletedAt: new Date(),
        },
      }),
      // 2) Clear profile PII but keep the row so _count references stay valid
      this.prisma.userProfile.updateMany({
        where: { userId },
        data: {
          firstName: 'Usuario',
          lastName: 'eliminado',
          bio: null,
          avatarUrl: null,
          birthDate: null,
          city: null,
        },
      }),
      // 3) Revoke all sessions (user can't log back in with old tokens)
      this.prisma.session.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      // 4) Clear interests + consent (GDPR right-to-be-forgotten)
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      // 5) Audit fix: stop push deliveries — user shouldn't receive notifications.
      this.prisma.pushToken.deleteMany({ where: { userId } }),
      // 6) Audit fix: cut social graph — follows persisting let stale relations
      //    keep this user as "follower" of others, leaking their content.
      this.prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
      // 7) Drop friendships in either direction.
      this.prisma.friendship.deleteMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      }),
    ]);
  }

  /**
   * Admin direct delete (no GDPR queue). Same soft-delete as GDPR approval but
   * callable from the user detail screen. SuperAdmin only at controller level.
   */
  // ─────────────────────────────────────────────
  //  CREATE USER (manual, by admin) + reset password + resend verification
  // ─────────────────────────────────────────────

  /** Genera contraseña aleatoria fácil de comunicar pero segura. */
  private generateTempPassword(length = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
    let out = '';
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return `Opal-${out}!`;
  }

  async createUserManually(
    adminId: string,
    body: { email: string; firstName?: string; lastName?: string; role?: UserRole; phone?: string },
  ) {
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('Email inválido');
    }
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException(`Ya existe un usuario con el email ${email}`);

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone: body.phone?.trim() || null,
        passwordHash,
        role: body.role ?? 'USER',
        status: 'ACTIVE',
        isVerified: true, // alta admin = se considera verificado
        profile: {
          create: {
            firstName: body.firstName?.trim() || 'Usuario',
            lastName: body.lastName?.trim() || '',
            language: 'es',
          },
        },
        consent: {
          create: { termsAccepted: true, privacyAccepted: true, termsVersion: '1.0', privacyVersion: '1.0' },
        },
      },
    });
    this.realtime.toStaff('user', 'created', { id: user.id });
    this.logger.log(`[admin] user ${user.id} created manually by admin ${adminId}`);
    return {
      user: { id: user.id, email: user.email, role: user.role },
      tempPassword,
      message: 'Usuario creado. Comunícale la contraseña al usuario; puede cambiarla desde su perfil.',
    };
  }

  async resetUserPassword(adminId: string, userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'SUPER_ADMIN' && target.id !== adminId) {
      throw new BadRequestException('No puedes resetear la contraseña de otro SUPER_ADMIN');
    }
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalidar sesiones existentes para forzar re-login con la nueva clave
    await this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    }).catch(() => null);
    this.realtime.toUser(userId, 'auth', 'sessions_revoked', { data: { reason: 'password_reset_by_admin' } });
    return {
      tempPassword,
      message: 'Contraseña reseteada. Sus sesiones activas fueron cerradas.',
    };
  }

  async resendVerification(userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.isVerified) return { sent: false, message: 'El usuario ya está verificado.' };
    if (!target.email) throw new BadRequestException('El usuario no tiene email para reenviar verificación.');
    // Real send: same EMAIL_VERIFICATION OTP flow the signup uses (rate-limited
    // per identifier by OtpService). The user finishes it from the app.
    const result = await this.otp.sendOtp({ email: target.email, type: OtpType.EMAIL_VERIFICATION });
    this.logger.log(`[admin] verification OTP re-sent to ${target.email} (user ${userId})`);
    return { sent: true, expiresIn: result.expiresIn, message: 'Código de verificación reenviado por correo.' };
  }

  /** Admin override: mark the account as verified without the OTP round-trip. */
  async markUserVerified(adminId: string, userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { isVerified: true, status: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.isVerified) return { success: true, message: 'El usuario ya está verificado.' };
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        ...(target.status === UserStatus.PENDING_VERIFICATION ? { status: UserStatus.ACTIVE } : {}),
      },
    });
    await this.logAdminAction({
      adminId,
      targetUserId: userId,
      action: AdminActionType.VERIFY,
      summary: 'Marcado como verificado por administración',
      before: { isVerified: false, status: target.status },
      after: { isVerified: true },
    }).catch(() => null);
    this.realtime.toUserAndStaff(userId, 'user', 'updated', { id: userId, data: { isVerified: true } });
    return { success: true, message: 'Usuario marcado como verificado.' };
  }

  // ─────────────────────────────────────────────
  //  RESERVAS (admin-create + pin posts)
  // ─────────────────────────────────────────────
  async createManualReservation(
    adminId: string,
    body: { userId: string; venueId: string; date: string; timeSlot: string; partySize: number; notes?: string; internalNotes?: string },
  ) {
    const { userId, venueId, date, timeSlot, partySize } = body;
    if (!userId || !venueId || !date || !timeSlot || !partySize) {
      throw new BadRequestException('Faltan campos: userId, venueId, date, timeSlot, partySize');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue no encontrado');

    const reservation = await this.prisma.reservation.create({
      data: {
        userId,
        venueId,
        date: new Date(date),
        timeSlot,
        partySize: Number(partySize),
        specialRequests: body.notes ?? null,
        internalNotes: body.internalNotes ?? `Creada manualmente por admin ${adminId}`,
        status: 'CONFIRMED', // alta admin = ya confirmada por default
      },
    });
    this.realtime.toStaff('reservation', 'created', { id: reservation.id });
    this.realtime.toUser(userId, 'reservation', 'created', { id: reservation.id });
    this.logger.log(`[admin] reservation ${reservation.id} created manually by ${adminId} for user ${userId}`);
    return reservation;
  }

  async togglePinPost(postId: string, pinned: boolean) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post no encontrado');
    if (pinned) {
      // Unpin cualquier otro post del mismo autor (1 pinned por user es lo razonable)
      await this.prisma.post.updateMany({
        where: { userId: post.userId, isPinned: true, id: { not: postId } },
        data: { isPinned: false },
      });
    }
    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { isPinned: pinned },
    });
    await this.community.invalidateFeedCache().catch(() => null);
    this.realtime.broadcast('post', pinned ? 'pinned' : 'unpinned', { id: postId });
    return updated;
  }

  // ─────────────────────────────────────────────
  //  TANDA 2: tickets · reviews · messages · events
  // ─────────────────────────────────────────────

  async createTicketForUser(
    adminId: string,
    body: { userId: string; subject: string; description: string; priority?: string; category?: string },
  ) {
    if (!body.userId || !body.subject?.trim() || !body.description?.trim()) {
      throw new BadRequestException('Faltan campos: userId, subject, description');
    }
    const target = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: body.userId,
        assignedToId: adminId,
        subject: body.subject.trim().slice(0, 200),
        category: (body.category as any) ?? 'OTHER',
        priority: (body.priority as any) ?? 'MEDIUM',
        status: 'OPEN',
      },
    });

    // Primer mensaje del ticket = la descripción que dio el admin (como AGENT)
    await this.prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: adminId,
        sender: 'AGENT',
        content: body.description.trim().slice(0, 2000),
      },
    });

    this.realtime.toUser(body.userId, 'ticket', 'created', { id: ticket.id });
    this.realtime.toStaff('ticket', 'created', { id: ticket.id });
    this.logger.log(`[admin] ticket ${ticket.id} created by admin ${adminId} for user ${body.userId}`);
    return ticket;
  }

  async hardDeleteReview(reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    // Hard delete de verdad — sin softDelete. Para casos de spam/abuso.
    await this.prisma.review.delete({ where: { id: reviewId } }).catch(async () => {
      // Si la FK bloquea (ej. helpfulVotes), caemos a soft-delete + status REJECTED
      await this.prisma.review.update({
        where: { id: reviewId },
        data: {
          deletedAt: new Date(),
          status: 'REJECTED',
          rejectionReason: 'Eliminado permanentemente por moderación.',
        },
      });
    });
    this.realtime.toStaff('review', 'deleted', { id: reviewId });
  }

  async sendMessageAsAdmin(adminId: string, userId: string, content: string) {
    const text = (content ?? '').trim();
    if (!text) throw new BadRequestException('Mensaje vacío');
    if (text.length > 2000) throw new BadRequestException('Mensaje demasiado largo (máximo 2000)');
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (target.id === adminId) throw new BadRequestException('No puedes enviarte un mensaje a ti mismo');

    // Buscar/crear thread entre admin y user. La unique constraint es
    // (userAId, userBId) — para evitar duplicados ordenamos los IDs.
    const [a, b] = adminId < userId ? [adminId, userId] : [userId, adminId];
    let thread = await this.prisma.messageThread.findFirst({
      where: {
        OR: [
          { userAId: a, userBId: b },
          { userAId: b, userBId: a },
        ],
      },
    });
    if (!thread) {
      thread = await this.prisma.messageThread.create({
        data: { userAId: a, userBId: b, status: 'ACCEPTED', requestedById: adminId },
      });
    } else if (thread.status !== 'ACCEPTED') {
      thread = await this.prisma.messageThread.update({
        where: { id: thread.id },
        data: { status: 'ACCEPTED' },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: adminId,
        content: text,
      },
    });
    await this.prisma.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });

    this.realtime.toUsers([thread.userAId, thread.userBId], 'message', 'received', {
      id: message.id,
      data: { threadId: thread.id, message },
    });
    this.logger.log(`[admin] platform message ${message.id} from ${adminId} to ${userId}`);
    return { thread, message };
  }

  async duplicateEvent(eventId: string, adminId: string) {
    const original = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!original) throw new NotFoundException('Evento no encontrado');
    const { id: _id, currentCapacity: _cap, createdAt: _c, updatedAt: _u, ...rest } = original;
    const dup = await this.prisma.event.create({
      data: {
        ...rest,
        title: `${rest.title} (copia)`,
        status: 'DRAFT',
        currentCapacity: 0,
      },
    });
    this.realtime.toStaff('event', 'created', { id: dup.id });
    this.logger.log(`[admin] event ${eventId} duplicated as ${dup.id} by ${adminId}`);
    return dup;
  }

  // ─────────────────────────────────────────────
  //  TANDA 3: sessions · bulk reviews · venue blocks
  // ─────────────────────────────────────────────

  async listUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        deviceName: true,
        deviceOs: true,
        ipAddress: true,
        userAgent: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async revokeUserSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new NotFoundException('Sesión no encontrada');
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
    this.realtime.toUser(userId, 'auth', 'session_revoked', { id: sessionId });
    return { success: true };
  }

  async revokeAllUserSessions(userId: string) {
    const r = await this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    this.realtime.toUser(userId, 'auth', 'sessions_revoked', { data: { count: r.count } });
    return { revoked: r.count };
  }

  async bulkDeleteReviews(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Indica al menos un id');
    }
    if (ids.length > 100) {
      throw new BadRequestException('Máximo 100 reseñas por bulk');
    }
    // Soft-delete masivo (REJECTED + deletedAt) para esquivar FK constraints
    // de helpfulVotes y mantener trazabilidad. Es lo que hace hardDeleteReview
    // como fallback, aplicado en bloque.
    const r = await this.prisma.review.updateMany({
      where: { id: { in: ids } },
      data: {
        deletedAt: new Date(),
        status: 'REJECTED',
        rejectionReason: 'Eliminado masivamente por moderación.',
      },
    });
    this.realtime.toStaff('review', 'bulk_deleted', { data: { count: r.count } });
    return { deleted: r.count };
  }

  /** Every venue, active or not — the admin pickers must be able to target an inactive venue. */
  async listVenues() {
    return this.prisma.venue.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, slug: true, city: true, address: true, imageUrl: true, isActive: true,
        openTime: true, closeTime: true, reservationCapacity: true, reservationsEnabled: true, slotMinutes: true,
        _count: { select: { events: true, offers: true, reservations: true } },
      },
    });
  }

  /** Ticket + requester + agent + full message thread (staff view; no read-receipt side effects). */
  async getTicketDetail(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, email: true, phone: true, role: true, status: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        assignedTo: { select: { id: true, email: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            senderUser: { select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          },
        },
        _count: { select: { messages: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return ticket;
  }

  async listVenueBlocks(venueId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
    if (!venue) throw new NotFoundException('Venue no encontrado');
    return this.prisma.reservationBlock.findMany({
      where: { venueId, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async createVenueBlock(
    adminId: string,
    venueId: string,
    body: { startsAt: string; endsAt: string; reason?: string },
  ) {
    const start = new Date(body.startsAt);
    const end = new Date(body.endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Fechas inválidas');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
    if (!venue) throw new NotFoundException('Venue no encontrado');
    const block = await this.prisma.reservationBlock.create({
      data: {
        venueId,
        startsAt: start,
        endsAt: end,
        reason: body.reason?.trim()?.slice(0, 200) || null,
        createdById: adminId,
      },
    });
    this.realtime.toStaff('venue', 'block_created', { id: block.id, data: { venueId } });
    return block;
  }

  async deleteVenueBlock(blockId: string) {
    await this.prisma.reservationBlock.delete({ where: { id: blockId } }).catch(() => null);
  }

  async deleteUserDirect(adminId: string, userId: string) {
    if (userId === adminId) {
      throw new BadRequestException('Cannot delete yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot delete a super admin');
    }
    await this.softDeleteUser(userId);
    this.realtime.toStaff('user', 'deleted', { id: userId });
    this.realtime.toUser(userId, 'user', 'deleted', { id: userId });
    return { success: true };
  }

  async getReportDetail(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    // Load the target content based on type
    let target: any = null;
    if (report.targetType === 'POST') {
      target = await this.prisma.post.findUnique({
        where: { id: report.targetId },
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          _count: { select: { reactions: true, comments: true } },
        },
      });
    } else if (report.targetType === 'COMMENT') {
      target = await this.prisma.comment.findUnique({
        where: { id: report.targetId },
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
      });
    } else if (report.targetType === 'USER') {
      target = await this.prisma.user.findUnique({
        where: { id: report.targetId },
        select: {
          id: true, email: true, status: true, role: true, createdAt: true,
          profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      });
    }

    // Count total reports against this same target (to show "also reported by N others")
    const otherReports = await this.prisma.report.count({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        id: { not: id },
      },
    });

    return { report, target, otherReports };
  }

  async resolveReport(reportId: string, moderatorId: string, status: ReportStatus) {
    const r = await this.prisma.report.update({
      where: { id: reportId },
      data: { status, reviewedById: moderatorId, reviewedAt: new Date() },
    });
    this.realtime.toStaff('report', 'updated', { id: reportId, data: { status } });
    return r;
  }

  // ── STATS ─────────────────────────────────

  async getDashboardStats() {
    const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      totalUsers, activeEvents, activeOffers, publishedPosts,
      pendingPosts, openReports, pendingReservations, openTickets,
      signupsLast30d,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.event.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.offer.count({ where: { status: 'ACTIVE' } }),
      this.prisma.post.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.post.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.reservation.count({ where: { status: 'PENDING' } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirty } } }),
    ]);
    return {
      totalUsers,
      activeEvents,
      activeOffers,
      publishedPosts,
      pendingPosts,
      openReports,
      pendingReservations,
      openTickets,
      signupsLast30d,
    };
  }

  async getRecentActivity(limit = 50) {
    const [signups, reservations, posts, reports] = await Promise.all([
      this.prisma.user.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, createdAt: true, profile: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.reservation.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { profile: { select: { firstName: true, lastName: true } } } },
          venue: { select: { name: true } },
        },
      }),
      this.prisma.post.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.report.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const events: { type: string; id: string; when: Date; text: string; meta?: string }[] = [];

    signups.forEach((u) => {
      const n = `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.trim() || u.email;
      events.push({ type: 'SIGNUP', id: u.id, when: u.createdAt, text: `Usuario registrado: ${n}` });
    });
    reservations.forEach((r) => {
      const n = `${r.user?.profile?.firstName ?? ''} ${r.user?.profile?.lastName ?? ''}`.trim() || 'Usuario';
      events.push({
        type: 'RESERVATION',
        id: r.id,
        when: r.createdAt,
        text: `Reserva ${statusEs(r.status)}: ${n} · ${r.venue?.name ?? ''} · ${r.timeSlot}`,
        meta: r.status,
      });
    });
    posts.forEach((p) => {
      const n = `${p.user?.profile?.firstName ?? ''} ${p.user?.profile?.lastName ?? ''}`.trim() || 'Usuario';
      events.push({
        type: 'POST',
        id: p.id,
        when: p.createdAt,
        text: p.status === 'PENDING_REVIEW' ? `Post en revisión por ${n}` : `Nuevo post de ${n}`,
        meta: p.status,
      });
    });
    reports.forEach((r) => {
      events.push({
        type: 'REPORT',
        id: r.id,
        when: r.createdAt,
        text: `Reporte: ${r.reason} sobre ${r.targetType.toLowerCase()}`,
        meta: r.status,
      });
    });

    return events.sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, limit);
  }

  // ── LOYALTY LEVELS ────────────────────────

  // Helpers
  // prettier-ignore
  // (declared below)

  /** Every level, inactive ones included (the public endpoint only returns active). */
  async listLoyaltyLevels() {
    return this.prisma.loyaltyLevel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { minPoints: 'asc' }],
      include: { _count: { select: { profiles: true } } },
    });
  }

  async createLoyaltyLevel(data: {
    name: string; nameEn?: string; slug: string;
    minPoints: number; maxPoints?: number | null; color: string; icon: string;
    benefits?: string[]; sortOrder?: number; isActive?: boolean;
  }) {
    const dup = await this.prisma.loyaltyLevel.findFirst({
      where: { OR: [{ slug: data.slug }, { name: data.name }] },
      select: { id: true },
    });
    if (dup) throw new ConflictException('Ya existe un nivel con ese nombre o slug');
    return this.prisma.loyaltyLevel.create({
      data: { ...data, benefits: data.benefits ?? [], sortOrder: data.sortOrder ?? 0 },
    });
  }

  async updateLoyaltyLevel(
    id: string,
    data: {
      name?: string; nameEn?: string | null; slug?: string;
      minPoints?: number; maxPoints?: number | null; color?: string; icon?: string;
      benefits?: string[]; sortOrder?: number; isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.loyaltyLevel.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Nivel no encontrado');
    if (data.slug || data.name) {
      const dup = await this.prisma.loyaltyLevel.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(data.slug ? [{ slug: data.slug }] : []),
            ...(data.name ? [{ name: data.name }] : []),
          ],
        },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Ya existe un nivel con ese nombre o slug');
    }
    return this.prisma.loyaltyLevel.update({ where: { id }, data });
  }

  async deleteLoyaltyLevel(id: string) {
    const level = await this.prisma.loyaltyLevel.findUnique({
      where: { id },
      include: { _count: { select: { profiles: true } } },
    });
    if (!level) throw new NotFoundException('Nivel no encontrado');
    if (level._count.profiles > 0) {
      // Members still sit on this level — deactivate instead of orphaning them.
      throw new ConflictException(
        `No se puede eliminar: ${level._count.profiles} miembro(s) tienen este nivel. Desactívalo en su lugar.`,
      );
    }
    return this.prisma.loyaltyLevel.delete({ where: { id } });
  }

  // ── FEATURE FLAGS ─────────────────────────

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async createFeatureFlag(key: string, description?: string, enabled = false) {
    const cleanKey = (key ?? '').trim();
    if (!cleanKey) throw new BadRequestException('Falta el key del flag');
    if (!/^[a-z][a-z0-9_]{2,49}$/.test(cleanKey)) {
      throw new BadRequestException('Key inválido. Usa snake_case (3-50 caracteres, empieza con letra)');
    }
    const exists = await this.prisma.featureFlag.findUnique({ where: { key: cleanKey } });
    if (exists) throw new BadRequestException(`Ya existe un flag con key "${cleanKey}"`);
    return this.prisma.featureFlag.create({
      data: {
        key: cleanKey,
        enabled: !!enabled,
        description: description?.trim() || null,
      },
    });
  }

  async updateFeatureFlag(
    key: string,
    patch: { enabled?: boolean; description?: string | null },
  ) {
    const data: { enabled?: boolean; description?: string | null } = {};
    if (typeof patch.enabled === 'boolean') data.enabled = patch.enabled;
    if (typeof patch.description !== 'undefined') {
      data.description = patch.description?.trim() || null;
    }
    return this.prisma.featureFlag.upsert({
      where: { key },
      update: data,
      create: { key, enabled: !!data.enabled, description: data.description ?? '' },
    });
  }

  /** Compat con el endpoint viejo `setFeatureFlag(key, enabled)` */
  async setFeatureFlag(key: string, enabled: boolean) {
    return this.updateFeatureFlag(key, { enabled });
  }

  async deleteFeatureFlag(key: string) {
    await this.prisma.featureFlag.delete({ where: { key } }).catch(() => null);
  }

  // ─────────────────────────────────────────────
  //  UNIFIED INBOX — everything the admin has to act on, in one list.
  //
  //  Returns ContentFlags + pending posts + pending reviews + open reports +
  //  open tickets + pending reservations (today through next 7 days), ordered
  //  by urgency.
  //
  //  `urgency` is 0-100 derived from:
  //    - severity / priority / status of the item (base score)
  //    - age (older items get a boost so nothing rots forever)
  //
  //  `deepLink` is the Expo Router path to open the item in admin mobile.
  // ─────────────────────────────────────────────
  async getInbox(limit = 50): Promise<{ items: InboxItem[]; counts: InboxCounts }> {
    const [flags, pendingPosts, pendingReviews, openReports, openTickets, pendingReservations] = await Promise.all([
      this.prisma.contentFlag.findMany({
        where: { status: 'PENDING' },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.post.findMany({
        where: { status: 'PENDING_REVIEW', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, content: true, createdAt: true, userId: true },
      }),
      this.prisma.review.findMany({
        where: { status: 'PENDING_REVIEW', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, rating: true, body: true, createdAt: true, venueId: true },
      }),
      this.prisma.report.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, targetType: true, targetId: true, reason: true, createdAt: true },
      }),
      this.prisma.supportTicket.findMany({
        where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        select: { id: true, subject: true, priority: true, status: true, createdAt: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          status: 'PENDING',
          date: { gte: startOfToday(), lt: endOfNextDay(7) },
        },
        orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
        take: 100,
        select: { id: true, date: true, timeSlot: true, partySize: true, createdAt: true },
      }),
    ]);

    const ageBoost = (d: Date): number => {
      // 0h → 0, 24h → 10, 72h → 20. Capped so a stale item can't outrank a fresh CRITICAL one.
      const hours = (Date.now() - d.getTime()) / 3_600_000;
      return Math.min(20, hours * (10 / 24));
    };

    const items: InboxItem[] = [];

    for (const f of flags) {
      const base = f.severity === 'CRITICAL' ? 90 : f.severity === 'HIGH' ? 70 : f.severity === 'MEDIUM' ? 50 : 30;
      items.push({
        id: `flag:${f.id}`,
        type: 'FLAG',
        refId: f.id,
        urgency: Math.min(100, base + ageBoost(f.createdAt)),
        title: `Flag ${f.targetType} · ${f.triggeredBy}`,
        preview: f.matchedText ?? undefined,
        createdAt: f.createdAt.toISOString(),
        deepLink: `/(admin)/flags`,
        meta: { severity: f.severity, targetType: f.targetType, targetId: f.targetId },
      });
    }

    for (const r of openReports) {
      items.push({
        id: `report:${r.id}`,
        type: 'REPORT',
        refId: r.id,
        urgency: Math.min(100, 65 + ageBoost(r.createdAt)),
        title: `Reporte ${r.targetType}`,
        preview: r.reason ?? undefined,
        createdAt: r.createdAt.toISOString(),
        deepLink: `/(admin)/reports/${r.id}`,
        meta: { targetType: r.targetType, targetId: r.targetId },
      });
    }

    for (const t of openTickets) {
      const base = t.priority === 'URGENT' ? 85 : t.priority === 'HIGH' ? 65 : t.priority === 'MEDIUM' ? 45 : 25;
      items.push({
        id: `ticket:${t.id}`,
        type: 'TICKET',
        refId: t.id,
        urgency: Math.min(100, base + ageBoost(t.createdAt)),
        title: t.subject,
        createdAt: t.createdAt.toISOString(),
        deepLink: `/(admin)/manage/support/${t.id}`,
        meta: { priority: t.priority, status: t.status },
      });
    }

    for (const p of pendingPosts) {
      items.push({
        id: `post:${p.id}`,
        type: 'POST',
        refId: p.id,
        urgency: Math.min(100, 40 + ageBoost(p.createdAt)),
        title: 'Post pendiente de moderación',
        preview: p.content.slice(0, 120),
        createdAt: p.createdAt.toISOString(),
        deepLink: `/(admin)/manage/community/${p.id}`,
        meta: { userId: p.userId },
      });
    }

    for (const r of pendingReviews) {
      items.push({
        id: `review:${r.id}`,
        type: 'REVIEW',
        refId: r.id,
        urgency: Math.min(100, 40 + ageBoost(r.createdAt)),
        title: `Reseña pendiente · ${r.rating}★`,
        preview: r.body?.slice(0, 120),
        createdAt: r.createdAt.toISOString(),
        deepLink: `/(admin)/manage/reviews`,
        meta: { rating: r.rating, venueId: r.venueId },
      });
    }

    // Reservations pending — urgency rises as the date approaches.
    // today=80, tomorrow=60, 2-3d=40, 4-7d=25.
    for (const r of pendingReservations) {
      const daysOut = Math.max(0, Math.floor((r.date.getTime() - startOfToday().getTime()) / 86_400_000));
      const base = daysOut === 0 ? 80 : daysOut === 1 ? 60 : daysOut <= 3 ? 40 : 25;
      items.push({
        id: `reservation:${r.id}`,
        type: 'RESERVATION',
        refId: r.id,
        urgency: Math.min(100, base + ageBoost(r.createdAt)),
        title: `Mesa ${r.partySize}p · ${r.timeSlot}`,
        preview: `${r.date.toISOString().slice(0, 10)} (en ${daysOut}d)`,
        createdAt: r.createdAt.toISOString(),
        deepLink: `/(admin)/manage/reservations/${r.id}`,
        meta: { date: r.date.toISOString(), timeSlot: r.timeSlot, partySize: r.partySize, daysOut },
      });
    }

    items.sort((a, b) => b.urgency - a.urgency || b.createdAt.localeCompare(a.createdAt));

    const counts: InboxCounts = {
      flags: flags.length,
      reports: openReports.length,
      tickets: openTickets.length,
      posts: pendingPosts.length,
      reviews: pendingReviews.length,
      reservations: pendingReservations.length,
      total: items.length,
    };

    return { items: items.slice(0, limit), counts };
  }

  /** Counts only — cheap endpoint for admin tab bar badges (poll ~30s). */
  async getInboxCounts(): Promise<InboxCounts> {
    const [flags, reports, tickets, posts, reviews, reservations] = await Promise.all([
      this.prisma.contentFlag.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      this.prisma.post.count({ where: { status: 'PENDING_REVIEW', deletedAt: null } }),
      this.prisma.review.count({ where: { status: 'PENDING_REVIEW', deletedAt: null } }),
      this.prisma.reservation.count({
        where: { status: 'PENDING', date: { gte: startOfToday(), lt: endOfNextDay(7) } },
      }),
    ]);
    return {
      flags, reports, tickets, posts, reviews, reservations,
      total: flags + reports + tickets + posts + reviews + reservations,
    };
  }
}

// ── Inbox types ─────────────────────────────
export type InboxItemType = 'FLAG' | 'POST' | 'REVIEW' | 'REPORT' | 'TICKET' | 'RESERVATION';

export interface InboxItem {
  id: string;               // prefixed-unique: "flag:abc123"
  type: InboxItemType;
  refId: string;            // original item id (without prefix)
  urgency: number;          // 0-100
  title: string;
  preview?: string;
  createdAt: string;
  deepLink: string;         // Expo Router path in admin mobile
  meta?: Record<string, unknown>;
}

export interface InboxCounts {
  flags: number;
  reports: number;
  tickets: number;
  posts: number;
  reviews: number;
  reservations: number;
  total: number;
}

// ── Date helpers ────────────────────────────
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfNextDay(days: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + days + 1);
  return d;
}

function statusEs(s: string) {
  switch (s) {
    case 'PENDING': return 'pendiente';
    case 'CONFIRMED': return 'confirmada';
    case 'CANCELLED': return 'cancelada';
    case 'COMPLETED': return 'completada';
    default: return s.toLowerCase();
  }
}
