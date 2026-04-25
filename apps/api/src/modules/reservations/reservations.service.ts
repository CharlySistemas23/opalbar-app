import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService, LockBusyError } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateReservationDto, ReservationFilterDto, UpdateReservationDto, UpdateReservationStatusDto } from './dto/reservation.dto';

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(dto: CreateReservationDto, userId: string) {
    // Serialize reservations of the same {venue + date + slot} + {event if any}.
    // Two concurrent users on the last event seat would otherwise both pass the
    // `currentCapacity >= maxCapacity` check and overbook.
    const lockKey = dto.eventId
      ? `event:reserve:${dto.eventId}`
      : `reservation:${dto.venueId}:${dto.date}:${dto.timeSlot}`;
    try {
      return await this.redis.withLock(lockKey, 5, () => this.executeCreate(dto, userId));
    } catch (err) {
      if (err instanceof LockBusyError) {
        throw new ConflictException('Another reservation is being processed for this slot, try again');
      }
      throw err;
    }
  }

  private async executeCreate(dto: CreateReservationDto, userId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: dto.venueId } });
    if (!venue || !venue.isActive) throw new NotFoundException('Venue not found');

    let eventToAttend: { id: string; venueId: string; maxCapacity: number | null; currentCapacity: number; pointsReward: number; title: string; startDate: Date } | null = null;

    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.venueId !== dto.venueId) {
        throw new BadRequestException('Event venue does not match reservation venue');
      }
      if (event.maxCapacity !== null && event.currentCapacity >= event.maxCapacity) {
        throw new ConflictException('Event is at full capacity');
      }
      eventToAttend = event;
    }

    const existing = await this.prisma.reservation.findFirst({
      where: {
        userId,
        venueId: dto.venueId,
        date: new Date(dto.date),
        timeSlot: dto.timeSlot,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      },
    });
    if (existing) throw new ConflictException('You already have a reservation for this time slot');

    const reservation = await this.prisma.reservation.create({
      data: {
        userId,
        venueId: dto.venueId,
        eventId: dto.eventId,
        date: new Date(dto.date),
        timeSlot: dto.timeSlot,
        partySize: dto.partySize,
        specialRequests: dto.specialRequests,
        status: ReservationStatus.PENDING,
      },
      include: {
        venue: { select: { id: true, name: true, address: true } },
        event: { select: { id: true, title: true, titleEn: true, startDate: true, pointsReward: true } },
      },
    });

    if (eventToAttend) {
      const alreadyAttending = await this.prisma.eventAttendee.findUnique({
        where: { userId_eventId: { userId, eventId: eventToAttend.id } },
      });
      if (!alreadyAttending) {
        await this.prisma.$transaction([
          this.prisma.eventAttendee.create({ data: { userId, eventId: eventToAttend.id } }),
          this.prisma.event.update({
            where: { id: eventToAttend.id },
            data: { currentCapacity: { increment: 1 } },
          }),
        ]);
      }
    }

    this.push.sendToUser(userId, {
      title: 'Reserva pendiente',
      body: `Tu mesa en ${venue.name} está en revisión. Te avisamos al confirmar.`,
      data: { type: 'RESERVATION_CREATED', reservationId: reservation.id },
    }).catch(() => {});

    // Notify staff when a reservation is for TODAY — too late for tomorrow batching.
    if (isSameDay(new Date(dto.date), new Date())) {
      this.push.sendToRoles([UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN], {
        title: 'Reserva de hoy',
        body: `${dto.partySize}p · ${dto.timeSlot} · ${venue.name}`,
        data: {
          type: 'RESERVATION_TODAY',
          reservationId: reservation.id,
          deepLink: `/(admin)/manage/reservations/${reservation.id}`,
        },
      }).catch(() => {});
    }

    this.realtime.toUserAndStaff(userId, 'reservation', 'created', { id: reservation.id, data: reservation });
    return reservation;
  }

  async findMine(userId: string, filter: ReservationFilterDto) {
    const { page = 1, limit = 20, status } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = { userId, ...(status && { status }) };

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        include: {
          venue: { select: { id: true, name: true, address: true } },
          event: { select: { id: true, title: true, titleEn: true, startDate: true, imageUrl: true } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        venue: { select: { id: true, name: true, address: true, phone: true } },
        event: { select: { id: true, title: true, titleEn: true, startDate: true, imageUrl: true, pointsReward: true } },
        user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId && role === UserRole.USER) {
      throw new ForbiddenException('Access denied');
    }
    return reservation;
  }

  async cancel(id: string, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { venue: { select: { name: true } } },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId && role === UserRole.USER) {
      throw new ForbiddenException('Access denied');
    }
    if ([ReservationStatus.COMPLETED, ReservationStatus.CANCELLED].includes(reservation.status)) {
      throw new BadRequestException('Cannot cancel a reservation in its current state');
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
    });

    const cancelledByStaff = role !== UserRole.USER && userId !== reservation.userId;
    if (cancelledByStaff) {
      this.push.sendToUser(reservation.userId, {
        title: 'Reserva cancelada',
        body: `Tu reserva en ${reservation.venue.name} fue cancelada por el local.`,
        data: { type: 'RESERVATION_CANCELLED_BY_VENUE', reservationId: reservation.id },
      }).catch(() => {});
    }

    this.realtime.toUserAndStaff(reservation.userId, 'reservation', 'updated', { id, data: { status: ReservationStatus.CANCELLED } });
    return updated;
  }

  // ── Admin ─────────────────────────────────

  async findAll(filter: ReservationFilterDto) {
    const { page = 1, limit = 20, status, venueId, date } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = {
      ...(status && { status }),
      ...(venueId && { venueId }),
      ...(date && { date: new Date(date) }),
    };

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        include: {
          venue: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async modify(
    id: string,
    dto: { date?: string; partySize?: number; notes?: string },
    userId: string,
    role: UserRole,
  ) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    const isStaff = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(role as string);
    if (reservation.userId !== userId && !isStaff) {
      throw new ForbiddenException('Cannot modify this reservation');
    }
    if ([ReservationStatus.CANCELLED, ReservationStatus.COMPLETED, ReservationStatus.SEATED].includes(reservation.status)) {
      throw new ForbiddenException('Reservation cannot be modified in its current state');
    }

    const data: any = {};
    if (dto.date) data.date = new Date(dto.date);
    if (dto.partySize != null) data.partySize = dto.partySize;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.reservation.update({ where: { id }, data });
    this.realtime.toUserAndStaff(reservation.userId, 'reservation', 'updated', { id, data: updated });
    return updated;
  }

  async updateStatus(id: string, dto: UpdateReservationStatusDto) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');

    const timestamps: any = {};
    if (dto.status === ReservationStatus.CONFIRMED) timestamps.confirmedAt = new Date();
    if (dto.status === ReservationStatus.SEATED) timestamps.seatedAt = new Date();
    if (dto.status === ReservationStatus.COMPLETED) timestamps.completedAt = new Date();
    if (dto.status === ReservationStatus.CANCELLED) timestamps.cancelledAt = new Date();

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
        ...(dto.cancelReason && { cancelReason: dto.cancelReason }),
        ...timestamps,
      },
    });
    this.realtime.toUserAndStaff(reservation.userId, 'reservation', 'status_changed', { id, data: { status: dto.status } });
    return updated;
  }
}
