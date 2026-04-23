import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';

// Venues change rarely (name/address/hours), so we cache aggressively.
// Ratings live in denormalized ratingAvg/ratingCount, updated by ReviewsService
// which invalidates this namespace.
const CACHE_TTL_LIST = 120;
const CACHE_TTL_ONE = 120;

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private static hashFilter(obj: unknown): string {
    return createHash('md5').update(JSON.stringify(obj ?? {})).digest('hex').slice(0, 12);
  }

  private async invalidate(): Promise<void> {
    await this.redis.cacheDelPattern('cache:venues:*');
  }

  async findAll(params: { page?: number; limit?: number; search?: string; city?: string }) {
    const key = RedisService.cacheKey('venues', 'list', VenuesService.hashFilter(params));
    return this.redis.cacheWrap(key, CACHE_TTL_LIST, async () => {
      const page = Number(params.page) || 1;
      const limit = Number(params.limit) || 20;
      const skip = getPaginationOffset(page, limit);

      const where: any = {
        isActive: true,
        ...(params.city && { city: { contains: params.city, mode: 'insensitive' } }),
        ...(params.search && {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } },
            { city: { contains: params.search, mode: 'insensitive' } },
          ],
        }),
      };

      const [data, total] = await Promise.all([
        this.prisma.venue.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        this.prisma.venue.count({ where }),
      ]);

      return paginate(data, total, page, limit);
    });
  }

  async findOne(id: string) {
    const key = RedisService.cacheKey('venues', 'one', id);
    return this.redis.cacheWrap(key, CACHE_TTL_ONE, async () => {
      const venue = await this.prisma.venue.findUnique({ where: { id } });
      if (!venue) throw new NotFoundException('Venue not found');
      return venue;
    });
  }

  async updateConfig(id: string, data: {
    openTime?: string;
    closeTime?: string;
    reservationCapacity?: number;
    reservationsEnabled?: boolean;
    slotMinutes?: number;
  }) {
    const existing = await this.prisma.venue.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Venue not found');
    const updated = await this.prisma.venue.update({
      where: { id },
      data,
    });
    await this.invalidate();
    return updated;
  }

  async update(id: string, data: Record<string, any>) {
    const existing = await this.prisma.venue.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Venue not found');
    // Prisma expects Decimal-compatible values for lat/lng — String() works for @db.Decimal
    const patch: any = { ...data };
    if (patch.lat != null) patch.lat = String(patch.lat);
    if (patch.lng != null) patch.lng = String(patch.lng);
    const updated = await this.prisma.venue.update({
      where: { id },
      data: patch,
    });
    await this.invalidate();
    return updated;
  }
}
