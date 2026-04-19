import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationAction, PostStatus, ReportStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data.map(({ passwordHash: _, ...u }: any) => u), total, page, limit);
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
  }

  async unbanUser(moderatorId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } }),
      this.prisma.moderationLog.create({
        data: { moderatorId, targetType: 'USER', targetId: userId, action: ModerationAction.APPROVED, reason: 'Unban' },
      }),
    ]);
  }

  async updateUserRole(userId: string, role: UserRole) {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
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

    return paginate(data, total, page, limit);
  }

  async moderatePost(moderatorId: string, postId: string, action: 'approve' | 'reject', reason?: string) {
    const status = action === 'approve' ? PostStatus.PUBLISHED : PostStatus.REJECTED;
    const moderationAction = action === 'approve' ? ModerationAction.APPROVED : ModerationAction.REJECTED;

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: postId },
        data: { status, rejectionReason: action === 'reject' ? reason : null },
      }),
      this.prisma.moderationLog.create({
        data: { moderatorId, targetType: 'POST', targetId: postId, action: moderationAction, reason },
      }),
    ]);
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

  async resolveReport(reportId: string, moderatorId: string, status: ReportStatus) {
    return this.prisma.report.update({
      where: { id: reportId },
      data: { status, reviewedById: moderatorId, reviewedAt: new Date() },
    });
  }

  // ── STATS ─────────────────────────────────

  async getDashboardStats() {
    const [users, events, offers, posts, pendingPosts, pendingReports] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.event.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.offer.count({ where: { status: 'ACTIVE' } }),
      this.prisma.post.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.post.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
    ]);
    return { users, events, offers, posts, pendingPosts, pendingReports };
  }

  // ── LOYALTY LEVELS ────────────────────────

  async createLoyaltyLevel(data: {
    name: string; nameEn?: string; slug: string;
    minPoints: number; maxPoints?: number; color: string; icon: string;
    benefits: string[]; sortOrder: number;
  }) {
    return this.prisma.loyaltyLevel.create({ data });
  }
}
