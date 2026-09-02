import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, ReservationStatus, WalletReferenceType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WalletService } from '../wallet/wallet.service';
import { slotInstant, toDateOnly, todayMx } from '../reservations/mx-time';

/** Points earned for showing up to a plain (non-event) table reservation. */
const RESERVATION_VISIT_POINTS = 25;

/** Manual entry: staff types the last characters of the code. */
const SHORT_CODE_MAX = 8;

const RESERVATION_INCLUDE = {
  user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
  venue: { select: { id: true, name: true, openTime: true, closeTime: true } },
  event: { select: { id: true, title: true, titleEn: true, startDate: true, pointsReward: true } },
} as const;

const REDEMPTION_INCLUDE = {
  user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
  offer: { select: { id: true, title: true, titleEn: true, imageUrl: true, venue: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
    private readonly wallet: WalletService,
  ) {}

  // ── Lookups ───────────────────────────────

  private normalizeCode(code: string): string {
    const trimmed = (code ?? '').trim();
    if (!trimmed) throw new BadRequestException('Code is required');
    return trimmed;
  }

  private async findReservationByCode(rawCode: string) {
    const code = this.normalizeCode(rawCode);
    // Full code from a QR scan → exact match. Short suffix typed by staff →
    // suffix match (cuids are lowercase; be lenient on case).
    const reservation =
      code.length > SHORT_CODE_MAX
        ? await this.prisma.reservation.findUnique({ where: { confirmCode: code }, include: RESERVATION_INCLUDE })
        : await this.prisma.reservation.findFirst({
            where: { confirmCode: { endsWith: code.toLowerCase(), mode: 'insensitive' } },
            include: RESERVATION_INCLUDE,
            orderBy: { createdAt: 'desc' },
          });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  private async findRedemptionByCode(rawCode: string) {
    const code = this.normalizeCode(rawCode);
    const redemption =
      code.length > SHORT_CODE_MAX
        ? await this.prisma.offerRedemption.findUnique({ where: { code }, include: REDEMPTION_INCLUDE })
        : await this.prisma.offerRedemption.findFirst({
            where: { code: { endsWith: code.toLowerCase(), mode: 'insensitive' } },
            include: REDEMPTION_INCLUDE,
            orderBy: { createdAt: 'desc' },
          });
    if (!redemption) throw new NotFoundException('Redemption not found');
    return redemption;
  }

  /**
   * Whether the reservation can be seated right now (venue-local day). A
   * reservation for an overnight slot (e.g. 01:00) is valid on the calendar
   * day after its service date.
   */
  private seatingEligibility(reservation: {
    status: ReservationStatus;
    seatedAt: Date | null;
    date: Date;
    timeSlot: string;
    venue: { openTime: string | null; closeTime: string | null };
  }): { canSeat: boolean; reason?: string } {
    if (reservation.status === ReservationStatus.CANCELLED) return { canSeat: false, reason: 'Reservation was cancelled' };
    if (reservation.status === ReservationStatus.COMPLETED) return { canSeat: false, reason: 'Reservation already completed' };
    if (reservation.status === ReservationStatus.NO_SHOW) return { canSeat: false, reason: 'Reservation was marked as no-show' };
    if (reservation.seatedAt || reservation.status === ReservationStatus.SEATED) return { canSeat: false, reason: 'Reservation already seated' };

    const serviceDate = toDateOnly(reservation.date);
    const today = todayMx();
    const slotDay = todayMx(slotInstant(serviceDate, reservation.timeSlot, reservation.venue.openTime, reservation.venue.closeTime));
    if (serviceDate === today || slotDay === today) return { canSeat: true };
    if (serviceDate < today) return { canSeat: false, reason: 'Reservation date has passed' };
    return { canSeat: false, reason: 'Reservation is not for today' };
  }

  async lookupReservation(code: string) {
    const reservation = await this.findReservationByCode(code);
    const eligibility = this.seatingEligibility(reservation);
    return { ...reservation, canSeat: eligibility.canSeat, seatBlockedReason: eligibility.reason ?? null };
  }

  async lookupRedemption(code: string) {
    const redemption = await this.findRedemptionByCode(code);
    const expired = !!redemption.expiresAt && redemption.expiresAt < new Date();
    return { ...redemption, canUse: !redemption.isUsed && !expired, expired };
  }

  // ── Check-in ──────────────────────────────

  async checkinReservation(code: string, staffId: string) {
    const reservation = await this.findReservationByCode(code);

    if (reservation.seatedAt || reservation.status === ReservationStatus.SEATED) {
      return { alreadySeated: true, reservation };
    }
    const eligibility = this.seatingEligibility(reservation);
    if (!eligibility.canSeat) throw new BadRequestException(eligibility.reason ?? 'Reservation cannot be seated');

    // Claim the seating atomically. Two concurrent scans (staff double-tap, a
    // client retry after a timeout) would both clear the guard above and each
    // award the event points; this conditional write lets exactly one win.
    const claimed = await this.prisma.reservation.updateMany({
      where: { id: reservation.id, status: { not: ReservationStatus.SEATED }, seatedAt: null },
      data: { status: ReservationStatus.SEATED, seatedAt: new Date() },
    });
    if (claimed.count === 0) {
      const current = await this.findReservationByCode(code);
      return { alreadySeated: true, reservation: current };
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        // Audit fix: el flow oficial usa SEATED para reservas con cliente
        // dentro del local. Antes se grababa CONFIRMED y la query del staff
        // dashboard "reservas activas hoy" filtra por SEATED → la entrada
        // via QR no aparecia en el panel y staff no veia la mesa ocupada.
        status: ReservationStatus.SEATED,
        seatedAt: new Date(),
        confirmedAt: reservation.confirmedAt ?? new Date(),
        internalNotes: reservation.internalNotes
          ? `${reservation.internalNotes}\nSeated by staff ${staffId}`
          : `Seated by staff ${staffId}`,
      },
      include: RESERVATION_INCLUDE,
    });

    // Points — event reservations earn the event reward (once, via the
    // attendee row); plain visits earn a flat bonus. All through
    // WalletService so balance + loyalty tier stay consistent.
    let pointsAwarded = 0;
    try {
      if (reservation.eventId && reservation.event) {
        const attendee = await this.prisma.eventAttendee.findUnique({
          where: { userId_eventId: { userId: reservation.userId, eventId: reservation.eventId } },
          select: { id: true, pointsAwarded: true, status: true },
        });
        if (attendee) {
          await this.prisma.eventAttendee.update({
            where: { id: attendee.id },
            data: {
              status: AttendanceStatus.ATTENDED,
              checkedInAt: new Date(),
              ...(!attendee.pointsAwarded && reservation.event.pointsReward > 0 && { pointsAwarded: true }),
            },
          });
          if (!attendee.pointsAwarded && reservation.event.pointsReward > 0) {
            await this.wallet.addPoints(
              reservation.userId,
              reservation.event.pointsReward,
              `Asistencia: ${reservation.event.title}`,
              reservation.eventId,
              WalletReferenceType.EVENT_ATTENDANCE,
              `Attendance: ${reservation.event.titleEn ?? reservation.event.title}`,
            );
            pointsAwarded = reservation.event.pointsReward;
          }
        } else {
          await this.prisma.eventAttendee.create({
            data: {
              userId: reservation.userId,
              eventId: reservation.eventId,
              status: AttendanceStatus.ATTENDED,
              checkedInAt: new Date(),
              pointsAwarded: reservation.event.pointsReward > 0,
            },
          });
          if (reservation.event.pointsReward > 0) {
            await this.wallet.addPoints(
              reservation.userId,
              reservation.event.pointsReward,
              `Asistencia: ${reservation.event.title}`,
              reservation.eventId,
              WalletReferenceType.EVENT_ATTENDANCE,
              `Attendance: ${reservation.event.titleEn ?? reservation.event.title}`,
            );
            pointsAwarded = reservation.event.pointsReward;
          }
        }
      } else {
        await this.wallet.addPoints(
          reservation.userId,
          RESERVATION_VISIT_POINTS,
          `Visita: ${updated.venue.name}`,
          reservation.id,
          undefined,
          `Visit: ${updated.venue.name}`,
        );
        pointsAwarded = RESERVATION_VISIT_POINTS;
      }
    } catch {
      // Points must never block seating the guest; the tier sync can be
      // re-run later via WalletService.recomputeLoyaltyLevel.
      pointsAwarded = 0;
    }

    this.push.sendToUser(reservation.userId, {
      title: 'Entrada confirmada',
      body: pointsAwarded > 0
        ? `Bienvenido a ${updated.venue.name}. Ganaste +${pointsAwarded} puntos.`
        : `Bienvenido a ${updated.venue.name}. ¡Disfruta tu visita!`,
      data: { type: 'RESERVATION_SEATED', reservationId: reservation.id },
    }).catch(() => {});

    this.realtime.toUserAndStaff(reservation.userId, 'checkin', 'created', { id: reservation.id, data: { kind: 'reservation', staffId } });
    this.realtime.toUserAndStaff(reservation.userId, 'reservation', 'status_changed', { id: reservation.id, data: { seated: true, status: ReservationStatus.SEATED } });
    return { alreadySeated: false, reservation: updated, pointsAwarded };
  }

  async checkinRedemption(code: string, staffId: string) {
    const redemption = await this.findRedemptionByCode(code);

    if (redemption.isUsed) {
      return { alreadyUsed: true, redemption };
    }
    if (redemption.expiresAt && redemption.expiresAt < new Date()) {
      throw new BadRequestException('Redemption expired');
    }

    const updated = await this.prisma.offerRedemption.update({
      where: { id: redemption.id },
      data: { isUsed: true, usedAt: new Date() },
      include: REDEMPTION_INCLUDE,
    });

    this.push.sendToUser(redemption.userId, {
      title: 'Oferta canjeada',
      body: `Disfruta tu ${updated.offer.title} en ${updated.offer.venue?.name ?? 'OPALBAR'}.`,
      data: { type: 'REDEMPTION_USED', redemptionId: redemption.id },
    }).catch(() => {});

    this.realtime.toUserAndStaff(redemption.userId, 'checkin', 'created', { id: redemption.id, data: { kind: 'redemption', staffId } });
    return { alreadyUsed: false, redemption: updated, staffId };
  }
}
