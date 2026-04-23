import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { CreateReviewDto, ModerationReviewDto, ReviewFilterDto, UpdateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Recalculate denormalized rating stats on the Venue record.
   * Called after any change that may alter visible reviews:
   * create (moderation may push to PUBLISHED later), update (back to PENDING),
   * moderate (status toggle), soft-delete.
   * Also invalidates venue cache so the new numbers are visible immediately.
   */
  private async syncVenueRating(venueId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { venueId, status: ReviewStatus.PUBLISHED, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await this.prisma.venue.update({
      where: { id: venueId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });
    await this.redis.cacheDelPattern(`cache:venues:*`);
  }

  async create(dto: CreateReviewDto, userId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: dto.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');

    const existing = await this.prisma.review.findUnique({
      where: { userId_venueId: { userId, venueId: dto.venueId } },
    });
    if (existing) throw new ConflictException('You already reviewed this venue');

    const created = await this.prisma.review.create({
      data: {
        userId,
        venueId: dto.venueId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        pros: dto.pros,
        cons: dto.cons,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
        status: ReviewStatus.PENDING_REVIEW,
      },
    });
    // Starts as PENDING — no visible change yet, but sync keeps the venue row fresh
    // in case seed data had stale values.
    await this.syncVenueRating(dto.venueId);
    return created;
  }

  async findByVenue(venueId: string, filter: ReviewFilterDto) {
    const { page = 1, limit = 20, minRating } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = {
      venueId,
      status: ReviewStatus.PUBLISHED,
      deletedAt: null,
      ...(minRating && { rating: { gte: minRating } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findMine(userId: string) {
    return this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      include: { venue: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateReviewDto, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        ...(dto.rating && { rating: dto.rating }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.pros !== undefined && { pros: dto.pros }),
        ...(dto.cons !== undefined && { cons: dto.cons }),
        ...(dto.visitDate && { visitDate: new Date(dto.visitDate) }),
        status: ReviewStatus.PENDING_REVIEW,
      },
    });
    // Edit sends it back to PENDING — previously published stats change.
    await this.syncVenueRating(review.venueId);
    return updated;
  }

  async remove(id: string, userId: string, role: UserRole) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId && role === UserRole.USER) throw new ForbiddenException('Access denied');

    const removed = await this.prisma.review.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.syncVenueRating(review.venueId);
    return removed;
  }

  async getVenueRatingSummary(venueId: string) {
    const result = await this.prisma.review.aggregate({
      where: { venueId, status: ReviewStatus.PUBLISHED, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const distribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { venueId, status: ReviewStatus.PUBLISHED, deletedAt: null },
      _count: { rating: true },
    });

    return {
      average: result._avg.rating ?? 0,
      total: result._count.rating,
      distribution: distribution.map((d) => ({ rating: d.rating, count: d._count.rating })),
    };
  }

  // ── Admin moderation ──────────────────────

  async findAll(filter: ReviewFilterDto) {
    const { page = 1, limit = 20, status, venueId, minRating } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = {
      deletedAt: null,
      ...(status && { status }),
      ...(venueId && { venueId }),
      ...(minRating && { rating: { gte: minRating } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          venue: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async moderate(id: string, dto: ModerationReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    const moderated = await this.prisma.review.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.rejectionReason && { rejectionReason: dto.rejectionReason }),
      },
    });
    // Only PUBLISHED rows count in the aggregation; toggling status changes visible stats.
    await this.syncVenueRating(review.venueId);
    return moderated;
  }
}
