import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AdminActionType,
  ModerationAction,
  Prisma,
  PostStatus,
  ReportStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset, PaginationDto } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CommunityGateway } from '../community/community.gateway';
import { CommunityService } from '../community/community.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
    private readonly communityGateway: CommunityGateway,
    private readonly community: CommunityService,
  ) {}

  async broadcastPush(title: string, body: string, audience: 'ALL' | 'ADMINS' = 'ALL') {
    if (!title?.trim() || !body?.trim()) {
      throw new BadRequestException('title y body son requeridos');
    }
    const where: any = audience === 'ADMINS'
      ? { role: { in: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'] } }
      : { status: 'ACTIVE' };
    const users = await this.prisma.user.findMany({ where, select: { id: true } });
    let sent = 0;
    for (const u of users) {
      const r = await this.push.sendToUser(u.id, {
        title,
        body,
        data: { type: 'BROADCAST', audience },
      });
      sent += r?.sent ?? 0;
    }
    this.logger.log(`📣 Broadcast sent: ${sent} notifications to ${users.length} users (${audience})`);
    return { totalUsers: users.length, sent };
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
    const prev = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
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

  async getPendingPosts(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getPaginationOffset(page, limit);
    const where = { status: PostStatus.PENDING_REVIEW };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where, skip, take: limit,
        include: { user: { select: { id: true, email: true, profile: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.post.count({ where }),
    ]);

    // Add surface type (community vs wall) for frontend filtering
    const WALL_MARKER = '__WALL__';
    const dataWithSurface = data.map((post: any) => ({
      ...post,
      surface: post.mediaUrls?.includes(WALL_MARKER) ? 'wall' : 'community',
    }));

    return paginate(dataWithSurface, total, page, limit);
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
    } else if (action === 'reject') {
      this.communityGateway.emitChanged({ type: 'post_deleted', postId });
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

  async getReports(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getPaginationOffset(page, limit);
    const where = { status: ReportStatus.PENDING };

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where, skip, take: limit,
        include: { reporter: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
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
      const r = await this.prisma.dataExportRequest.update({
        where: { id },
        data: { status: 'REJECTED', processedAt: new Date() },
      });
      this.realtime.toUserAndStaff(request.userId, 'gdpr', 'rejected', { id, data: { kind: 'export' } });
      return r;
    }
    const downloadUrl = `https://opalbar.com/exports/${request.userId}-${Date.now()}.json`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const r = await this.prisma.dataExportRequest.update({
      where: { id },
      data: { status: 'COMPLETED', processedAt: new Date(), downloadUrl, expiresAt },
    });
    this.realtime.toUserAndStaff(request.userId, 'gdpr', 'approved', { id, data: { kind: 'export', downloadUrl } });
    return r;
  }

  async processDeletionRequest(id: string, action: 'APPROVE' | 'REJECT') {
    const request = await this.prisma.dataDeletionRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    if (action === 'REJECT') {
      const r = await this.prisma.dataDeletionRequest.update({
        where: { id },
        data: { status: 'REJECTED', processedAt: new Date() },
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
    ]);
  }

  /**
   * Admin direct delete (no GDPR queue). Same soft-delete as GDPR approval but
   * callable from the user detail screen. SuperAdmin only at controller level.
   */
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

  async createLoyaltyLevel(data: {
    name: string; nameEn?: string; slug: string;
    minPoints: number; maxPoints?: number; color: string; icon: string;
    benefits: string[]; sortOrder: number;
  }) {
    return this.prisma.loyaltyLevel.create({ data });
  }

  async updateLoyaltyLevel(id: string, data: any) {
    return this.prisma.loyaltyLevel.update({ where: { id }, data });
  }

  async deleteLoyaltyLevel(id: string) {
    return this.prisma.loyaltyLevel.delete({ where: { id } });
  }

  // ── FEATURE FLAGS ─────────────────────────

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async setFeatureFlag(key: string, enabled: boolean) {
    return this.prisma.featureFlag.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled, description: '' },
    });
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
