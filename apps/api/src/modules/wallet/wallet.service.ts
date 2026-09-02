import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, WalletTransactionType, WalletReferenceType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset, PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getWallet(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, points: true,
        profile: { include: { loyaltyLevel: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const nextLevel = await this.prisma.loyaltyLevel.findFirst({
      where: { minPoints: { gt: user.points } },
      orderBy: { minPoints: 'asc' },
    });

    return { ...user, nextLevel };
  }

  async getTransactions(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = getPaginationOffset(page, limit);

    const [data, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where: { userId } }),
    ]);

    return paginate(data, total, page, limit);
  }

  async getLoyaltyLevels() {
    return this.prisma.loyaltyLevel.findMany({
      where: { isActive: true },
      orderBy: { minPoints: 'asc' },
    });
  }

  async addPoints(
    userId: string,
    points: number,
    description: string,
    referenceId?: string,
    referenceType?: WalletReferenceType,
    descriptionEn?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newBalance = user.points + points;

    const [tx] = await this.prisma.$transaction([
      this.prisma.walletTransaction.create({
        data: {
          userId,
          type: WalletTransactionType.EARN,
          points,
          balance: newBalance,
          description,
          descriptionEn,
          referenceId,
          referenceType,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { points: { increment: points } },
      }),
    ]);

    // Check if user leveled up
    await this.updateLoyaltyLevel(userId, newBalance);

    return tx;
  }

  /**
   * Re-syncs `profile.loyaltyLevelId` with the user's current balance.
   * For callers that changed `User.points` outside `addPoints`/`deductPoints`
   * (admin adjustments, legacy increments) so the tier never drifts.
   */
  async recomputeLoyaltyLevel(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
    if (!user) throw new NotFoundException('User not found');
    await this.updateLoyaltyLevel(userId, user.points);
    return { points: user.points };
  }

  async deductPoints(userId: string, points: number, description: string, referenceId?: string) {
    if (points <= 0) throw new BadRequestException('Points to deduct must be positive');

    // Atomic deduct — fails with P2025 if balance < points (no negative balance).
    // Audit fix: previously read-then-write outside transaction allowed concurrent
    // redemptions to drive balance negative.
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId, points: { gte: points } } as any,
        data: { points: { decrement: points } },
        select: { points: true },
      }).catch(() => {
        throw new BadRequestException('Insufficient points');
      });
      return tx.walletTransaction.create({
        data: {
          userId,
          type: WalletTransactionType.REDEEM,
          points: -points,
          balance: user.points,
          description,
          referenceId,
          referenceType: WalletReferenceType.OFFER_REDEMPTION,
        },
      });
    });
  }

  private async updateLoyaltyLevel(userId: string, points: number) {
    const level = await this.prisma.loyaltyLevel.findFirst({
      where: {
        minPoints: { lte: points },
        OR: [{ maxPoints: null }, { maxPoints: { gte: points } }],
      },
      orderBy: { minPoints: 'desc' },
    });

    if (!level) return;

    // Check the current level *before* writing so we know if this counts as
    // a level-up (and therefore deserves the celebratory notification).
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { loyaltyLevelId: true },
    });
    const previousLevelId = profile?.loyaltyLevelId ?? null;

    if (previousLevelId === level.id) return;

    await this.prisma.userProfile.updateMany({
      where: { userId },
      data: { loyaltyLevelId: level.id },
    });

    // Only celebrate when the user actually moved up. If they downgraded
    // (which shouldn't happen via addPoints, but does via admin tools),
    // stay silent.
    const previousLevel = previousLevelId
      ? await this.prisma.loyaltyLevel.findUnique({ where: { id: previousLevelId }, select: { minPoints: true } })
      : null;
    if (previousLevel && previousLevel.minPoints >= level.minPoints) return;

    const nameEs = level.name;
    const nameEn = level.nameEn ?? level.name;
    try {
      await this.notifications.createNotification({
        userId,
        type: NotificationType.LEVEL_UP,
        title: `¡Subiste a ${nameEs}!`,
        titleEn: `You leveled up to ${nameEn}!`,
        body: `Ahora eres nivel ${nameEs}. Disfruta nuevos beneficios.`,
        bodyEn: `You are now ${nameEn}. Enjoy your new perks.`,
        data: { levelId: level.id, levelName: nameEs, points },
      });
    } catch {
      // Notification failures must never break the points-earning flow.
    }
  }
}
