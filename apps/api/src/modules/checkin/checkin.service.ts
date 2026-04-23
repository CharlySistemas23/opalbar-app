import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async checkinReservation(code: string, staffId: string) {
    if (!code) throw new BadRequestException('Code is required');

    const reservation = await this.prisma.reservation.findUnique({
      where: { confirmCode: code },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        venue: { select: { id: true, name: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.status === ReservationStatus.COMPLETED) {
      throw new BadRequestException('Reservation already completed');
    }
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('Reservation was cancelled');
    }
    if (reservation.seatedAt) {
      return { alreadySeated: true, reservation };
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        seatedAt: new Date(),
        confirmedAt: reservation.confirmedAt ?? new Date(),
        internalNotes: reservation.internalNotes
          ? `${reservation.internalNotes}\nSeated by staff ${staffId}`
          : `Seated by staff ${staffId}`,
      },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        venue: { select: { id: true, name: true } },
      },
    });

    this.push.sendToUser(reservation.userId, {
      title: 'Entrada confirmada',
      body: `Bienvenido a ${updated.venue.name}. ¡Disfruta tu visita!`,
      data: { type: 'RESERVATION_SEATED', reservationId: reservation.id },
    }).catch(() => {});

    return { alreadySeated: false, reservation: updated };
  }

  async checkinRedemption(code: string, staffId: string) {
    if (!code) throw new BadRequestException('Code is required');

    const redemption = await this.prisma.offerRedemption.findUnique({
      where: { code },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        offer: { select: { id: true, title: true, titleEn: true, venue: { select: { id: true, name: true } } } },
      },
    });
    if (!redemption) throw new NotFoundException('Redemption not found');

    if (redemption.isUsed) {
      return { alreadyUsed: true, redemption };
    }
    if (redemption.expiresAt && redemption.expiresAt < new Date()) {
      throw new BadRequestException('Redemption expired');
    }

    const updated = await this.prisma.offerRedemption.update({
      where: { id: redemption.id },
      data: { isUsed: true, usedAt: new Date() },
      include: {
        user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        offer: { select: { id: true, title: true, titleEn: true, venue: { select: { id: true, name: true } } } },
      },
    });

    this.push.sendToUser(redemption.userId, {
      title: 'Oferta canjeada',
      body: `Disfruta tu ${updated.offer.title} en ${updated.offer.venue?.name ?? 'OPALBAR'}.`,
      data: { type: 'REDEMPTION_USED', redemptionId: redemption.id },
    }).catch(() => {});

    return { alreadyUsed: false, redemption: updated, staffId };
  }

  async lookupReservation(code: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { confirmCode: code },
      include: {
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        venue: { select: { id: true, name: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async lookupRedemption(code: string) {
    const redemption = await this.prisma.offerRedemption.findUnique({
      where: { code },
      include: {
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        offer: { select: { id: true, title: true, titleEn: true, venue: { select: { id: true, name: true } } } },
      },
    });
    if (!redemption) throw new NotFoundException('Redemption not found');
    return redemption;
  }
}
