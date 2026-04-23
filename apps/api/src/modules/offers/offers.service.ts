import {
  BadRequestException, ConflictException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { OfferStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService, LockBusyError } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { CreateOfferDto, OfferFilterDto, UpdateOfferDto } from './dto/offer.dto';

// Cache TTLs — public reads. Offers change less than events so we can hold longer.
const CACHE_TTL_LIST = 60;
const CACHE_TTL_ONE = 120;

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private static hashFilter(obj: unknown): string {
    return createHash('md5').update(JSON.stringify(obj ?? {})).digest('hex').slice(0, 12);
  }

  private async invalidate(): Promise<void> {
    await this.redis.cacheDelPattern('cache:offers:*');
  }

  async findAll(filter: OfferFilterDto & { status?: OfferStatus; includeAll?: boolean }) {
    const isPublicList = !(filter as any).includeAll && !(filter as any).status;
    const key = RedisService.cacheKey('offers', 'list', OffersService.hashFilter(filter));

    const exec = async () => {
      const { page = 1, limit = 20, search, venueId, type, highlighted, date, status, includeAll } = filter as any;
      const skip = getPaginationOffset(page, limit);
      const now = date ? new Date(date) : new Date();

      const where: any = {};
      if (status) where.status = status;
      else if (!includeAll) {
        where.status = OfferStatus.ACTIVE;
        where.startDate = { lte: now };
        where.endDate = { gte: now };
      }
      Object.assign(where, {
        ...(venueId && { venueId }),
        ...(type && { type }),
        ...(highlighted && { isHighlighted: true }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      });

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
    };

    if (isPublicList) return this.redis.cacheWrap(key, CACHE_TTL_LIST, exec);
    return exec();
  }

  async findOne(id: string) {
    const key = RedisService.cacheKey('offers', 'one', id);
    return this.redis.cacheWrap(key, CACHE_TTL_ONE, async () => {
      const offer = await this.prisma.offer.findUnique({
        where: { id },
        include: {
          venue: true,
          _count: { select: { redemptions: true } },
        },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      return offer;
    });
  }

  async create(dto: CreateOfferDto, createdById: string) {
    const created = await this.prisma.offer.create({
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
        status: dto.status ?? OfferStatus.DRAFT,
        createdById,
      },
    });
    await this.invalidate();
    return created;
  }

  async update(id: string, dto: UpdateOfferDto) {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Offer not found');

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    const updated = await this.prisma.offer.update({
      where: { id },
      data,
      include: {
        venue: { select: { id: true, name: true, city: true } },
        _count: { select: { redemptions: true } },
      },
    });
    await this.invalidate();
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Offer not found');
    // Hard delete — cascade removes all redemptions
    await this.prisma.offer.delete({ where: { id } });
    await this.invalidate();
  }

  async softArchive(id: string) {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Offer not found');
    await this.prisma.offer.update({
      where: { id },
      data: { status: OfferStatus.EXPIRED },
    });
    await this.invalidate();
  }

  async redeem(offerId: string, userId: string) {
    // Serialize redemptions of the SAME offer. Two concurrent callers on the same
    // offer would otherwise both pass the `currentRedemptions >= maxRedemptions`
    // check and oversell. Different offers can proceed in parallel.
    try {
      return await this.redis.withLock(`offer:redeem:${offerId}`, 5, () =>
        this.executeRedeem(offerId, userId),
      );
    } catch (err) {
      if (err instanceof LockBusyError) {
        throw new ConflictException('Offer is being redeemed by another user, try again in a second');
      }
      throw err;
    }
  }

  private async executeRedeem(offerId: string, userId: string) {
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

    await this.invalidate();
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
