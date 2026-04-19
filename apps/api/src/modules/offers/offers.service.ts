import {
  BadRequestException, ConflictException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { OfferStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { CreateOfferDto, OfferFilterDto } from './dto/offer.dto';

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: OfferFilterDto) {
    const { page = 1, limit = 20, search, venueId, type, highlighted, date } = filter;
    const skip = getPaginationOffset(page, limit);
    const now = date ? new Date(date) : new Date();

    const where: any = {
      status: OfferStatus.ACTIVE,
      startDate: { lte: now },
      endDate: { gte: now },
      ...(venueId && { venueId }),
      ...(type && { type }),
      ...(highlighted && { isHighlighted: true }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        skip,
        take: limit,
        include: {
          venue: { select: { id: true, name: true, city: true } },
          _count: { select: { redemptions: true } },
        },
        orderBy: [{ isHighlighted: 'desc' }, { endDate: 'asc' }],
      }),
      this.prisma.offer.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: {
        venue: true,
        _count: { select: { redemptions: true } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async create(dto: CreateOfferDto, createdById: string) {
    return this.prisma.offer.create({
      data: {
        title: dto.title,
        titleEn: dto.titleEn,
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        terms: dto.terms,
        imageUrl: dto.imageUrl,
        venueId: dto.venueId,
        type: dto.type,
        discountValue: dto.discountValue,
        minimumPurchase: dto.minimumPurchase,
        maxRedemptions: dto.maxRedemptions,
        maxPerUser: dto.maxPerUser ?? 1,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        daysOfWeek: dto.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        startTime: dto.startTime,
        endTime: dto.endTime,
        isHighlighted: dto.isHighlighted ?? false,
        pointsRequired: dto.pointsRequired ?? 0,
        status: OfferStatus.DRAFT,
        createdById,
      },
    });
  }

  async redeem(offerId: string, userId: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');

    const now = new Date();

    // Validity checks
    if (offer.status !== OfferStatus.ACTIVE) throw new BadRequestException('Offer is not active');
    if (offer.startDate > now || offer.endDate < now) throw new BadRequestException('Offer is not currently valid');
    if (offer.maxRedemptions && offer.currentRedemptions >= offer.maxRedemptions) {
      throw new ConflictException('Offer has been fully redeemed');
    }

    // Day of week check
    const dayOfWeek = now.getDay();
    if (offer.daysOfWeek.length > 0 && !offer.daysOfWeek.includes(dayOfWeek)) {
      throw new BadRequestException('Offer is not valid today');
    }

    // Per-user limit
    const userRedemptions = await this.prisma.offerRedemption.count({
      where: { userId, offerId },
    });
    if (userRedemptions >= offer.maxPerUser) {
      throw new ConflictException('You have already redeemed this offer the maximum number of times');
    }

    // Points check
    if (offer.pointsRequired > 0) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.points < offer.pointsRequired) {
        throw new BadRequestException(`Insufficient points. Required: ${offer.pointsRequired}`);
      }
    }

    // Redeem in transaction
    const [redemption] = await this.prisma.$transaction([
      this.prisma.offerRedemption.create({
        data: { userId, offerId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }),
      this.prisma.offer.update({
        where: { id: offerId },
        data: {
          currentRedemptions: { increment: 1 },
          ...(offer.maxRedemptions && offer.currentRedemptions + 1 >= offer.maxRedemptions && {
            status: OfferStatus.DEPLETED,
          }),
        },
      }),
      // Deduct points if required
      ...(offer.pointsRequired > 0
        ? [
            this.prisma.user.update({
              where: { id: userId },
              data: { points: { decrement: offer.pointsRequired } },
            }),
            this.prisma.walletTransaction.create({
              data: {
                userId,
                type: 'REDEEM',
                points: -offer.pointsRequired,
                balance: 0, // will be updated by wallet service
                description: `Canje de oferta: ${offer.title}`,
                referenceId: offerId,
                referenceType: 'OFFER_REDEMPTION',
              },
            }),
          ]
        : []),
    ]);

    return redemption;
  }

  async getMyRedemptions(userId: string) {
    return this.prisma.offerRedemption.findMany({
      where: { userId },
      include: {
        offer: {
          include: { venue: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
