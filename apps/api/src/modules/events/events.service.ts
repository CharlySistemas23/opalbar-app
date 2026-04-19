import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { EventStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { CreateEventDto, UpdateEventDto, EventFilterDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: EventFilterDto) {
    const { page = 1, limit = 20, search, categoryId, venueId, startDate, endDate, isFree, highlighted, status } = filter;
    const skip = getPaginationOffset(page, limit);

    const where: any = {
      status: status || EventStatus.PUBLISHED,
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
    };

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
  }

  async findOne(id: string, userId?: string) {
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
    return event;
  }

  async create(dto: CreateEventDto, createdById: string) {
    return this.prisma.event.create({
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
        status: EventStatus.DRAFT,
      },
    });
  }

  async update(id: string, dto: UpdateEventDto, userId: string, role: UserRole) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== userId && role === UserRole.USER) {
      throw new ForbiddenException('Not authorized to update this event');
    }
    return this.prisma.event.update({
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
  }

  async remove(id: string, userId: string, role: UserRole) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== userId && role === UserRole.USER) {
      throw new ForbiddenException('Not authorized');
    }
    return this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });
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
    if (existing) throw new ConflictException('Already registered for this event');

    const [attendee] = await this.prisma.$transaction([
      this.prisma.eventAttendee.create({ data: { userId, eventId } }),
      this.prisma.event.update({ where: { id: eventId }, data: { currentCapacity: { increment: 1 } } }),
    ]);
    return attendee;
  }

  async cancelAttendance(eventId: string, userId: string) {
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!attendee) throw new NotFoundException('Registration not found');

    await this.prisma.$transaction([
      this.prisma.eventAttendee.update({
        where: { userId_eventId: { userId, eventId } },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      }),
      this.prisma.event.update({
        where: { id: eventId },
        data: { currentCapacity: { decrement: 1 } },
      }),
    ]);
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

  async getCategories() {
    return this.prisma.eventCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
