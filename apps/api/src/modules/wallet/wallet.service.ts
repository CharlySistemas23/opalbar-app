import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletTransactionType, WalletReferenceType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

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

  async deductPoints(userId: string, points: number, description: string, referenceId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newBalance = Math.max(0, user.points - points);

    return this.prisma.$transaction([
      this.prisma.walletTransaction.create({
        data: {
          userId,
          type: WalletTransactionType.REDEEM,
          points: -points,
          balance: newBalance,
          description,
          referenceId,
          referenceType: WalletReferenceType.OFFER_REDEMPTION,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { points: { decrement: points } },
      }),
    ]);
  }

  private async updateLoyaltyLevel(userId: string, points: number) {
    const level = await this.prisma.loyaltyLevel.findFirst({
      where: {
        minPoints: { lte: points },
        OR: [{ maxPoints: null }, { maxPoints: { gte: points } }],
      },
      orderBy: { minPoints: 'desc' },
    });

    if (level) {
      await this.prisma.userProfile.updateMany({
        where: { userId },
        data: { loyaltyLevelId: level.id },
      });
    }
  }
}
