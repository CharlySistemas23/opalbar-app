import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { AttendanceStatus, EventStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { CreateEventDto, UpdateEventDto, EventFilterDto } from './dto/event.dto';

// Cache TTLs in seconds — public reads only. Tune per hotness.
const CACHE_TTL_LIST = 30;  // list refreshes often enough (new events, attendance)
const CACHE_TTL_ONE = 60;   // event detail changes rarely
const CACHE_TTL_CATEGORIES = 300;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private static hashFilter(obj: unknown): string {
    return createHash('md5').update(JSON.stringify(obj ?? {})).digest('hex').slice(0, 12);
  }

  private async invalidate(): Promise<void> {
    await this.redis.cacheDelPattern('cache:events:*');
  }

  async findAll(filter: EventFilterDto & { includeAll?: boolean }) {
    // Only cache public/default lists (not admin includeAll or custom status queries).
    // Search strings are cached too, they're bounded by rate limit.
    const isPublicList = !filter.includeAll && !filter.status;
    const key = RedisService.cacheKey('events', 'list', EventsService.hashFilter(filter));

    const exec = async () => {
      const { page = 1, limit = 20, search, categoryId, venueId, startDate, endDate, isFree, highlighted, status, includeAll } = filter;
      const skip = getPaginationOffset(page, limit);

      const where: any = {};
      if (status) where.status = status;
      else if (!includeAll) where.status = EventStatus.PUBLISHED;

      Object.assign(where, {
        ...(categoryId && { categoryId }),
        ...(venueId && { venueId }),
        ...(isFree !== undefined && { isFree }),
        ...(highlighted && { isHighlighted: true }),
        ...(startDate && { startDate: { gte: new Date(startDate) } }),
        ...(endDate && { endDate: { lte: new Date(endDate) } }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      });

      const [data, total] = await Promise.all([
        this.prisma.event.findMany({
          where,
          skip,
          take: limit,
          include: {
            venue: { select: { id: true, name: true, city: true } },
            category: { select: { id: true, name: true, icon: true, color: true } },
            _count: { select: { attendees: true } },
          },
          orderBy: [{ isHighlighted: 'desc' }, { startDate: 'asc' }],
        }),
        this.prisma.event.count({ where }),
      ]);

      return paginate(data, total, page, limit);
    };

    if (isPublicList) {
      return this.redis.cacheWrap(key, CACHE_TTL_LIST, exec);
    }
    return exec();
  }

  async findOne(id: string, userId?: string) {
    // Cache the public (userId-less) version. Personalized attendee join bypasses cache.
    const doFetch = async () => {
      const event = await this.prisma.event.findUnique({
        where: { id },
        include: {
          venue: true,
          category: true,
          media: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { attendees: true } },
          attendees: userId
            ? { where: { userId }, select: { status: true } }
            : false,
        },
      });
      if (!event) throw new NotFoundException('Event not found');

      if (!userId) return event;

      const attendeeStatus = event.attendees?.[0]?.status;
      return {
        ...event,
        isAttending: attendeeStatus === AttendanceStatus.REGISTERED,
      };
    };

    if (userId) return doFetch();
    const key = RedisService.cacheKey('events', 'one', id);
    return this.redis.cacheWrap(key, CACHE_TTL_ONE, doFetch);
  }

  async create(dto: CreateEventDto, createdById: string) {
    const created = await this.prisma.event.create({
      data: {
        title: dto.title,
        titleEn: dto.titleEn,
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        imageUrl: dto.imageUrl,
        venueId: dto.venueId,
        categoryId: dto.categoryId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        doorsOpenAt: dto.doorsOpenAt ? new Date(dto.doorsOpenAt) : undefined,
        maxCapacity: dto.maxCapacity,
        price: dto.price,
        isFree: dto.isFree ?? true,
        tags: dto.tags || [],
        pointsReward: dto.pointsReward ?? 50,
        isHighlighted: dto.isHighlighted ?? false,
        createdById,
        status: dto.status ?? EventStatus.PUBLISHED,
      },
    });
    await this.invalidate();
    return created;
  }

  async update(id: string, dto: UpdateEventDto, userId: string, role: UserRole) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== userId && role === UserRole.USER) {
      throw new ForbiddenException('Not authorized to update this event');
    }
    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.titleEn !== undefined && { titleEn: dto.titleEn }),
        ...(dto.description && { description: dto.description }),
        ...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.venueId && { venueId: dto.venueId }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.doorsOpenAt && { doorsOpenAt: new Date(dto.doorsOpenAt) }),
        ...(dto.maxCapacity !== undefined && { maxCapacity: dto.maxCapacity }),
        ...(dto.isFree !== undefined && { isFree: dto.isFree }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.pointsReward !== undefined && { pointsReward: dto.pointsReward }),
        ...(dto.isHighlighted !== undefined && { isHighlighted: dto.isHighlighted }),
        ...(dto.status && { status: dto.status }),
      },
    });
    await this.invalidate();
    return updated;
  }

  async remove(id: string, userId: string, role: UserRole) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== userId && role === UserRole.USER) {
      throw new ForbiddenException('Not authorized');
    }
    // Hard delete — cascade handles attendees, media; reservations get eventId=null
    const deleted = await this.prisma.event.delete({ where: { id } });
    await this.invalidate();
    return deleted;
  }

  async softCancel(id: string) {
    const result = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });
    await this.invalidate();
    return result;
  }

  // ── Attendance ───────────────────────────

  async register(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) throw new BadRequestException('Event is not available for registration');
    if (event.maxCapacity && event.currentCapacity >= event.maxCapacity) {
      throw new ConflictException('Event is at full capacity');
    }

    const existing = await this.prisma.eventAttendee.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    // Re-activate cancelled attendance instead of blocking the user forever.
    if (existing?.status === AttendanceStatus.CANCELLED) {
      const [attendee] = await this.prisma.$transaction([
        this.prisma.eventAttendee.update({
          where: { userId_eventId: { userId, eventId } },
          data: { status: AttendanceStatus.REGISTERED, cancelledAt: null },
        }),
        this.prisma.event.update({ where: { id: eventId }, data: { currentCapacity: { increment: 1 } } }),
      ]);
      await this.invalidate();
      return attendee;
    }

    if (existing?.status === AttendanceStatus.REGISTERED) {
      throw new ConflictException('Already registered for this event');
    }

    const [attendee] = await this.prisma.$transaction([
      this.prisma.eventAttendee.create({ data: { userId, eventId } }),
      this.prisma.event.update({ where: { id: eventId }, data: { currentCapacity: { increment: 1 } } }),
    ]);
    await this.invalidate();
    return attendee;
  }

  async cancelAttendance(eventId: string, userId: string) {
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!attendee) throw new NotFoundException('Registration not found');

    // Idempotent cancel: if already cancelled, do nothing.
    if (attendee.status === AttendanceStatus.CANCELLED) return;

    await this.prisma.$transaction([
      this.prisma.eventAttendee.update({
        where: { userId_eventId: { userId, eventId } },
        data: { status: AttendanceStatus.CANCELLED, cancelledAt: new Date() },
      }),
      this.prisma.event.update({
        where: { id: eventId },
        data: { currentCapacity: { decrement: 1 } },
      }),
    ]);
    await this.invalidate();
  }

  async getMyEvents(userId: string) {
    return this.prisma.eventAttendee.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            venue: { select: { id: true, name: true, city: true } },
            category: { select: { id: true, name: true, icon: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCategories(includeArchived = false) {
    return this.prisma.eventCategory.findMany({
      where: includeArchived ? {} : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async restoreCategory(id: string) {
    const existing = await this.prisma.eventCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    return this.prisma.eventCategory.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deleteCategory(id: string, hard = false) {
    const existing = await this.prisma.eventCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');

    if (!hard) {
      // Soft: hide from picker, keep references intact
      await this.prisma.eventCategory.update({
        where: { id },
        data: { isActive: false },
      });
      return { hardDeleted: false };
    }

    // Hard delete: cascade everything in one transaction
    const [eventsWithCat, interestsWithCat] = await Promise.all([
      this.prisma.event.findMany({ where: { categoryId: id }, select: { id: true } }),
      this.prisma.userInterest.count({ where: { categoryId: id } }),
    ]);
    const eventIds = eventsWithCat.map((e) => e.id);

    await this.prisma.$transaction([
      // Kill user interests pointing to this category
      this.prisma.userInterest.deleteMany({ where: { categoryId: id } }),
      // Delete all events of this category (cascades attendees, media; reservations SetNull)
      ...(eventIds.length
        ? [this.prisma.event.deleteMany({ where: { id: { in: eventIds } } })]
        : []),
      // Finally drop the category
      this.prisma.eventCategory.delete({ where: { id } }),
    ]);

    return {
      hardDeleted: true,
      eventsDeleted: eventIds.length,
      interestsDeleted: interestsWithCat,
    };
  }

  async createCategory(body: { name: string; nameEn?: string; icon?: string; color?: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Nombre requerido');
    const slug = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const count = await this.prisma.eventCategory.count();
    return this.prisma.eventCategory.create({
      data: {
        name,
        nameEn: body.nameEn?.trim() || name,
        slug: `${slug}-${Date.now().toString(36)}`,
        icon: body.icon || 'tag',
        color: body.color || '#F4A340',
        sortOrder: count + 1,
      },
    });
  }

  async listAttendees(eventId: string) {
    const rows = await this.prisma.eventAttendee.findMany({
      where: { eventId, status: { in: ['CONFIRMED', 'ATTENDED'] } },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => r.user);
  }
}
