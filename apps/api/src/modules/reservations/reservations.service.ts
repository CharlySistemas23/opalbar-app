import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, EventStatus, Prisma, ReservationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService, LockBusyError } from '../../database/redis.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AvailabilityQueryDto,
  CreateReservationDto,
  ReservationFilterDto,
  UpdateReservationDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto';
import {
  buildSlots,
  dateOnlyToUtc,
  isValidDateOnly,
  slotInstant,
  toDateOnly,
  todayMx,
} from './mx-time';

// Allowed reservation status transitions. Terminal states (COMPLETED, CANCELLED,
// NO_SHOW) cannot transition further — prevents resurrecting a closed reservation
// from admin UI which would corrupt event capacity counters and audit logs.
const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED],
  CONFIRMED: [ReservationStatus.SEATED, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
  SEATED: [ReservationStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Statuses that hold seats for a slot. */
const OCCUPYING: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.SEATED,
];

/** Statuses that are closed — never "upcoming", never cancellable. */
const CLOSED: ReservationStatus[] = [
  ReservationStatus.COMPLETED,
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
];

const STAFF_ROLES: UserRole[] = [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

const DEFAULT_CAPACITY = 80;
const DEFAULT_SLOT_MINUTES = 30;

type VenueHours = {
  id: string;
  name: string;
  openTime: string | null;
  closeTime: string | null;
  slotMinutes: number | null;
  reservationCapacity: number | null;
  reservationsEnabled: boolean;
};

export interface AvailabilitySlot {
  time: string;
  remaining: number;
  available: boolean;
  /** Why the slot is unavailable (absent when available). */
  reason?: 'past' | 'full' | 'blocked';
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
  ) {}

  // ── Availability ──────────────────────────

  /**
   * Slot grid for a venue day: capacity minus seats held by PENDING /
   * CONFIRMED / SEATED reservations, minus ReservationBlock windows, minus
   * slots already in the past (Mexico City time).
   */
  async availability(query: AvailabilityQueryDto) {
    const date = toDateOnly(query.date);
    if (!isValidDateOnly(date)) throw new BadRequestException('Invalid date');

    const venue = await this.prisma.venue.findUnique({
      where: { id: query.venueId },
      select: {
        id: true, name: true, isActive: true, openTime: true, closeTime: true,
        slotMinutes: true, reservationCapacity: true, reservationsEnabled: true,
      },
    });
    if (!venue || !venue.isActive) throw new NotFoundException('Venue not found');

    const slots = await this.computeSlots(venue, date, query.excludeReservationId);
    const capacity = venue.reservationCapacity ?? DEFAULT_CAPACITY;
    return {
      venueId: venue.id,
      date,
      today: todayMx(),
      reservationsEnabled: venue.reservationsEnabled,
      openTime: venue.openTime,
      closeTime: venue.closeTime,
      slotMinutes: venue.slotMinutes ?? DEFAULT_SLOT_MINUTES,
      capacity,
      slots,
    };
  }

  private async computeSlots(
    venue: VenueHours,
    date: string,
    excludeReservationId?: string,
  ): Promise<AvailabilitySlot[]> {
    const times = buildSlots(venue.openTime, venue.closeTime, venue.slotMinutes ?? DEFAULT_SLOT_MINUTES);
    if (times.length === 0) return [];

    const capacity = venue.reservationCapacity ?? DEFAULT_CAPACITY;
    const now = new Date();

    // Seats held per slot.
    const held = await this.prisma.reservation.groupBy({
      by: ['timeSlot'],
      where: {
        venueId: venue.id,
        date: dateOnlyToUtc(date),
        status: { in: OCCUPYING },
        ...(excludeReservationId && { id: { not: excludeReservationId } }),
      },
      _sum: { partySize: true },
    });
    const usedBySlot = new Map<string, number>();
    for (const row of held) usedBySlot.set(row.timeSlot, row._sum.partySize ?? 0);

    // Blocks overlapping the service window (first slot → last slot + step).
    const first = slotInstant(date, times[0], venue.openTime, venue.closeTime);
    const lastStart = slotInstant(date, times[times.length - 1], venue.openTime, venue.closeTime);
    const windowEnd = new Date(lastStart.getTime() + (venue.slotMinutes ?? DEFAULT_SLOT_MINUTES) * 60000);
    const blocks = await this.prisma.reservationBlock.findMany({
      where: { venueId: venue.id, startsAt: { lt: windowEnd }, endsAt: { gt: first } },
      select: { startsAt: true, endsAt: true },
    });

    return times.map((time) => {
      const at = slotInstant(date, time, venue.openTime, venue.closeTime);
      const used = usedBySlot.get(time) ?? 0;
      const remaining = Math.max(0, capacity - used);
      let reason: AvailabilitySlot['reason'] | undefined;
      if (at.getTime() <= now.getTime()) reason = 'past';
      else if (blocks.some((b) => b.startsAt <= at && b.endsAt > at)) reason = 'blocked';
      else if (remaining <= 0) reason = 'full';
      return reason
        ? { time, remaining, available: false, reason }
        : { time, remaining, available: true };
    });
  }

  /**
   * Throws when the {date, timeSlot} is not bookable for `partySize` seats.
   * Shared by create + modify.
   */
  private async assertSlotBookable(
    venue: VenueHours,
    date: string,
    timeSlot: string,
    partySize: number,
    excludeReservationId?: string,
  ) {
    if (!venue.reservationsEnabled) {
      throw new BadRequestException('Reservations are currently disabled for this venue');
    }
    if (!isValidDateOnly(date)) throw new BadRequestException('Invalid date');
    if (date < todayMx()) throw new BadRequestException('Cannot reserve a past date');

    const times = buildSlots(venue.openTime, venue.closeTime, venue.slotMinutes ?? DEFAULT_SLOT_MINUTES);
    if (times.length > 0 && !times.includes(timeSlot)) {
      throw new BadRequestException('Time slot is outside opening hours');
    }

    const at = slotInstant(date, timeSlot, venue.openTime, venue.closeTime);
    if (at.getTime() <= Date.now()) throw new BadRequestException('This time slot has already passed');

    const blocked = await this.prisma.reservationBlock.findFirst({
      where: { venueId: venue.id, startsAt: { lte: at }, endsAt: { gt: at } },
      select: { id: true },
    });
    if (blocked) throw new ConflictException('This time slot is blocked');

    const capacity = venue.reservationCapacity ?? DEFAULT_CAPACITY;
    const used = await this.prisma.reservation.aggregate({
      where: {
        venueId: venue.id,
        date: dateOnlyToUtc(date),
        timeSlot,
        status: { in: OCCUPYING },
        ...(excludeReservationId && { id: { not: excludeReservationId } }),
      },
      _sum: { partySize: true },
    });
    const taken = used._sum.partySize ?? 0;
    if (taken + partySize > capacity) {
      throw new ConflictException('No availability for this time slot');
    }
  }

  // ── Create ────────────────────────────────

  async create(dto: CreateReservationDto, userId: string) {
    const date = toDateOnly(dto.date);
    // Serialize reservations of the same {venue + date + slot} + {event if any}.
    // Two concurrent users on the last event seat would otherwise both pass the
    // `currentCapacity >= maxCapacity` check and overbook.
    const lockKey = dto.eventId
      ? `event:reserve:${dto.eventId}`
      : `reservation:${dto.venueId}:${date}:${dto.timeSlot}`;
    try {
      return await this.redis.withLock(lockKey, 5, () => this.executeCreate({ ...dto, date }, userId));
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

    await this.assertSlotBookable(venue, dto.date, dto.timeSlot, dto.partySize);

    let eventToAttend: { id: string; venueId: string; maxCapacity: number | null; currentCapacity: number; pointsReward: number; title: string; startDate: Date } | null = null;

    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.venueId !== dto.venueId) {
        throw new BadRequestException('Event venue does not match reservation venue');
      }
      // Same guards EventsService.register() applies — otherwise a cancelled
      // or already-finished event can still be booked through this path.
      if (event.status !== EventStatus.PUBLISHED) {
        throw new BadRequestException('Event is not open for reservations');
      }
      if ((event.endDate ?? event.startDate).getTime() < Date.now()) {
        throw new BadRequestException('Event has already finished');
      }
      if (event.maxCapacity !== null && event.currentCapacity >= event.maxCapacity) {
        throw new ConflictException('Event is at full capacity');
      }
      eventToAttend = event;
    }

    const dateUtc = dateOnlyToUtc(dto.date);
    const existing = await this.prisma.reservation.findFirst({
      where: {
        userId,
        venueId: dto.venueId,
        date: dateUtc,
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
        date: dateUtc,
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
        // Increment capacity by partySize (not 1). Was a bug — decrement
        // side used partySize, so cancellations decremented more than the
        // creation incremented, leaving the counter below zero and
        // permanently misreporting `is at full capacity`.
        // Audit ref: backend audit P0 #9, 2026-05-18.
        await this.prisma.$transaction([
          this.prisma.eventAttendee.create({ data: { userId, eventId: eventToAttend.id } }),
          this.prisma.event.update({
            where: { id: eventToAttend.id },
            data: { currentCapacity: { increment: dto.partySize } },
          }),
        ]);
      }
    }

    this.push.sendToUser(userId, {
      title: 'Reserva pendiente',
      body: `Tu mesa en ${venue.name} está en revisión. Te avisamos al confirmar.`,
      data: { type: 'RESERVATION_CREATED', reservationId: reservation.id },
    }).catch(() => {});

    // Notify staff when a reservation is for TODAY (venue-local) — too late
    // for tomorrow batching.
    if (dto.date === todayMx()) {
      this.push.sendToRoles(STAFF_ROLES, {
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

  // ── Read ──────────────────────────────────

  async findMine(userId: string, filter: ReservationFilterDto) {
    const { page = 1, limit = 20, status, scope } = filter;
    const skip = getPaginationOffset(page, limit);
    const today = dateOnlyToUtc(todayMx());

    const where: Prisma.ReservationWhereInput = { userId };
    if (status) where.status = status;
    if (scope === 'upcoming') {
      where.date = { gte: today };
      where.status = status ?? { notIn: CLOSED };
    } else if (scope === 'past') {
      where.OR = [{ date: { lt: today } }, { status: { in: CLOSED } }];
    }

    const orderBy: Prisma.ReservationOrderByWithRelationInput[] =
      scope === 'upcoming'
        ? [{ date: 'asc' }, { timeSlot: 'asc' }]
        : [{ date: 'desc' }, { timeSlot: 'desc' }];

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        include: {
          venue: { select: { id: true, name: true, address: true } },
          event: { select: { id: true, title: true, titleEn: true, startDate: true, imageUrl: true } },
        },
        orderBy,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        venue: { select: { id: true, name: true, address: true, phone: true, openTime: true, closeTime: true } },
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

  // ── Cancel ────────────────────────────────

  async cancel(id: string, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { venue: { select: { name: true } } },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId && role === UserRole.USER) {
      throw new ForbiddenException('Access denied');
    }
    if (CLOSED.includes(reservation.status) || reservation.status === ReservationStatus.SEATED) {
      throw new BadRequestException('Cannot cancel a reservation in its current state');
    }
    if (toDateOnly(reservation.date) < todayMx()) {
      throw new BadRequestException('Cannot cancel a past reservation');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
      });
      // Release the event seats this reservation was holding (mirrors
      // updateStatus → CANCELLED / NO_SHOW). Capacity is only released when
      // this cancellation actually retires the attendee row: a user with two
      // reservations on the same event holds ONE attendee slot, so
      // decrementing per reservation would drive currentCapacity negative.
      if (reservation.eventId) {
        const retired = await tx.eventAttendee.updateMany({
          where: {
            userId: reservation.userId,
            eventId: reservation.eventId,
            status: AttendanceStatus.REGISTERED,
          },
          data: { status: AttendanceStatus.CANCELLED, cancelledAt: new Date() },
        });
        if (retired.count > 0) {
          await tx.event.update({
            where: { id: reservation.eventId },
            data: { currentCapacity: { decrement: reservation.partySize } },
          });
        }
      }
      return r;
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
    const where: Prisma.ReservationWhereInput = {
      ...(status && { status }),
      ...(venueId && { venueId }),
      ...(date && { date: dateOnlyToUtc(date) }),
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

  // ── Modify ────────────────────────────────

  async modify(id: string, dto: UpdateReservationDto, userId: string, role: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    const isStaff = STAFF_ROLES.includes(role);
    if (reservation.userId !== userId && !isStaff) {
      throw new ForbiddenException('Cannot modify this reservation');
    }
    if (CLOSED.includes(reservation.status) || reservation.status === ReservationStatus.SEATED) {
      throw new ForbiddenException('Reservation cannot be modified in its current state');
    }

    const nextDate = dto.date ? toDateOnly(dto.date) : toDateOnly(reservation.date);
    const nextSlot = dto.timeSlot ?? reservation.timeSlot;
    const nextParty = dto.partySize ?? reservation.partySize;
    const slotChanged =
      nextDate !== toDateOnly(reservation.date) ||
      nextSlot !== reservation.timeSlot ||
      nextParty !== reservation.partySize;

    if (slotChanged) {
      const venue = await this.prisma.venue.findUnique({ where: { id: reservation.venueId } });
      if (!venue || !venue.isActive) throw new NotFoundException('Venue not found');
      const lockKey = `reservation:${venue.id}:${nextDate}:${nextSlot}`;
      try {
        await this.redis.withLock(lockKey, 5, () =>
          this.assertSlotBookable(venue, nextDate, nextSlot, nextParty, reservation.id),
        );
      } catch (err) {
        if (err instanceof LockBusyError) {
          throw new ConflictException('Another reservation is being processed for this slot, try again');
        }
        throw err;
      }
    }

    const data: Prisma.ReservationUpdateInput = {};
    if (dto.date) data.date = dateOnlyToUtc(nextDate);
    if (dto.timeSlot) data.timeSlot = dto.timeSlot;
    if (dto.partySize != null) data.partySize = dto.partySize;
    if (dto.specialRequests !== undefined) data.specialRequests = dto.specialRequests;

    const updated = await this.prisma.reservation.update({
      where: { id },
      data,
      include: {
        venue: { select: { id: true, name: true, address: true } },
        event: { select: { id: true, title: true, titleEn: true, startDate: true, imageUrl: true } },
      },
    });
    this.realtime.toUserAndStaff(reservation.userId, 'reservation', 'updated', { id, data: updated });
    return updated;
  }

  // ── Status (staff) ────────────────────────

  async updateStatus(id: string, dto: UpdateReservationStatusDto) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');

    // Validate transition is allowed (audit fix: previously any->any was accepted).
    const allowed = RESERVATION_TRANSITIONS[reservation.status] ?? [];
    if (reservation.status !== dto.status && !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition reservation from ${reservation.status} to ${dto.status}`,
      );
    }

    const timestamps: any = {};
    if (dto.status === ReservationStatus.CONFIRMED) timestamps.confirmedAt = new Date();
    if (dto.status === ReservationStatus.SEATED) timestamps.seatedAt = new Date();
    if (dto.status === ReservationStatus.COMPLETED) timestamps.completedAt = new Date();
    if (dto.status === ReservationStatus.CANCELLED) timestamps.cancelledAt = new Date();

    // Free event capacity when going to a terminal non-attended state.
    const releasesCapacity =
      reservation.eventId &&
      (dto.status === ReservationStatus.CANCELLED || dto.status === ReservationStatus.NO_SHOW) &&
      reservation.status !== ReservationStatus.CANCELLED &&
      reservation.status !== ReservationStatus.NO_SHOW;

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
          ...(dto.cancelReason && { cancelReason: dto.cancelReason }),
          ...timestamps,
        },
        include: { venue: { select: { name: true } } },
      });
      if (releasesCapacity && reservation.eventId) {
        await tx.event.update({
          where: { id: reservation.eventId },
          data: { currentCapacity: { decrement: reservation.partySize } },
        });
      }
      return r;
    });
    this.realtime.toUserAndStaff(reservation.userId, 'reservation', 'status_changed', { id, data: { status: dto.status } });

    // Audit fix: cuando staff cambia status del lado admin, antes solo
    // emitiamos realtime — si la app del cliente estaba cerrada nunca se
    // enteraba de la confirmacion/cancelacion. Ahora mandamos push tambien.
    if (reservation.status !== dto.status) {
      const venueName = updated.venue?.name ?? 'OPAL BAR';
      let pushTitle: string | null = null;
      let pushBody: string | null = null;
      if (dto.status === ReservationStatus.CONFIRMED) {
        pushTitle = 'Reserva confirmada';
        pushBody = `Tu reserva en ${venueName} fue confirmada.`;
      } else if (dto.status === ReservationStatus.CANCELLED) {
        pushTitle = 'Reserva cancelada';
        pushBody = dto.cancelReason
          ? `Cancelada: ${dto.cancelReason}`
          : `Tu reserva en ${venueName} fue cancelada.`;
      } else if (dto.status === ReservationStatus.COMPLETED) {
        pushTitle = '¡Gracias por tu visita!';
        pushBody = `Esperamos verte pronto en ${venueName}.`;
      }
      if (pushTitle && pushBody) {
        this.push
          .sendToUser(reservation.userId, {
            title: pushTitle,
            body: pushBody,
            data: { type: 'RESERVATION_STATUS', reservationId: id, status: dto.status },
          })
          .catch(() => {});
      }
    }

    return updated;
  }
}
