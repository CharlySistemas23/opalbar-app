import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto, UpdateInterestsDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: { include: { loyaltyLevel: true } },
        interests: { include: { category: true } },
        consent: true,
        notificationSettings: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...safe } = user as any;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.language && { language: dto.language }),
      },
      create: {
        userId,
        firstName: dto.firstName || '',
        lastName: dto.lastName || '',
        bio: dto.bio,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        city: dto.city,
        language: dto.language || 'es',
      },
    });
    return profile;
  }

  async updateInterests(userId: string, dto: UpdateInterestsDto) {
    // Delete existing and re-insert
    await this.prisma.userInterest.deleteMany({ where: { userId } });
    if (dto.categoryIds.length > 0) {
      await this.prisma.userInterest.createMany({
        data: dto.categoryIds.map((categoryId) => ({ userId, categoryId })),
        skipDuplicates: true,
      });
    }
    return this.prisma.userInterest.findMany({
      where: { userId },
      include: { category: true },
    });
  }

  async updateNotificationSettings(userId: string, settings: Record<string, boolean>) {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      update: settings,
      create: { userId, ...settings },
    });
  }

  async requestDataExport(userId: string) {
    return this.prisma.dataExportRequest.create({
      data: { userId, status: 'PENDING' },
    });
  }

  async requestAccountDeletion(userId: string, reason?: string) {
    const deletionDays = 30;
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + deletionDays);

    return this.prisma.dataDeletionRequest.create({
      data: { userId, reason, scheduledFor, status: 'PENDING' },
    });
  }

  async updateConsent(userId: string, consent: Record<string, boolean>) {
    return this.prisma.userConsent.upsert({
      where: { userId },
      update: { ...consent, updatedAt: new Date() },
      create: { userId, ...consent },
    });
  }

  async uploadAvatar(userId: string, avatarUrl: string) {
    return this.prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl },
    });
  }
}
