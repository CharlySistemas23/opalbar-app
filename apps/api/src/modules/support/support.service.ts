import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageSender, NotificationType, TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate, getPaginationOffset } from '../../common/dto/pagination.dto';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTicketDto, CreateQuickReplyDto, SendMessageDto, TicketFilterDto, UpdateQuickReplyDto, UpdateTicketDto } from './dto/support.dto';

/** Statuses in which the ticket no longer accepts user messages. */
const TERMINAL_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Tickets (user) ───────────────────────

  async createTicket(dto: CreateTicketDto, userId: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        category: dto.category,
        subject: dto.subject,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            senderId: userId,
            sender: MessageSender.USER,
            content: dto.initialMessage,
          },
        },
      },
      include: { messages: true },
    });

    // Notify admins/moderators so urgent tickets don't sleep in the queue.
    // Priority defaults to MEDIUM at creation; moderators can bump later.
    this.push.sendToRoles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR], {
      title: 'Nuevo ticket de soporte',
      body: ticket.subject,
      data: { type: 'SUPPORT_TICKET_NEW', ticketId: ticket.id, deepLink: `/(admin)/manage/support/${ticket.id}` },
    }).catch(() => {});

    this.realtime.toUserAndStaff(userId, 'ticket', 'created', { id: ticket.id, data: ticket });
    return ticket;
  }

  async getMyTickets(userId: string, filter: TicketFilterDto) {
    const { page = 1, limit = 20, status } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = { userId, ...(status && { status }) };

    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /** Single ticket (owner or staff). Includes assigned agent's display info. */
  async getTicket(ticketId: string, userId: string, role: UserRole) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        assignedTo: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        _count: { select: { messages: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId && role === UserRole.USER) throw new ForbiddenException('Access denied');
    return ticket;
  }

  /** User closes their own ticket. Idempotent on already-terminal tickets. */
  async closeTicket(ticketId: string, userId: string, role: UserRole) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId && role === UserRole.USER) throw new ForbiddenException('Access denied');
    if (TERMINAL_STATUSES.includes(ticket.status)) return ticket;

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.CLOSED, closedAt: now },
      }),
      this.prisma.supportMessage.create({
        data: {
          ticketId,
          senderId: userId,
          sender: MessageSender.SYSTEM,
          content: 'El usuario cerró el ticket.',
        },
      }),
    ]);
    this.realtime.toUserAndStaff(ticket.userId, 'ticket', 'updated', { id: ticketId, data: updated });
    return updated;
  }

  async getTicketMessages(ticketId: string, userId: string, role: UserRole) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId && role === UserRole.USER) throw new ForbiddenException('Access denied');

    // Opening the thread = reading the agent's replies.
    if (ticket.userId === userId) {
      await this.prisma.supportMessage
        .updateMany({
          where: { ticketId, isRead: false, sender: { not: MessageSender.USER } },
          data: { isRead: true },
        })
        .catch(() => undefined);
    }

    return this.prisma.supportMessage.findMany({
      where: { ticketId },
      include: {
        senderUser: { select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(ticketId: string, dto: SendMessageDto, userId: string, role: UserRole) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isAgent = role !== UserRole.USER;
    if (!isAgent && ticket.userId !== userId) throw new ForbiddenException('Access denied');
    if (!isAgent && TERMINAL_STATUSES.includes(ticket.status)) {
      throw new BadRequestException('Ticket closed');
    }

    const sender = isAgent ? MessageSender.AGENT : MessageSender.USER;

    const [message] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: { ticketId, senderId: userId, sender, content: dto.content, attachments: dto.attachments || [] },
        include: {
          senderUser: { select: { id: true, role: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          updatedAt: new Date(),
          status: sender === MessageSender.AGENT ? TicketStatus.WAITING_USER : TicketStatus.IN_REVIEW,
        },
      }),
    ]);

    this.realtime.toUserAndStaff(ticket.userId, 'ticket', 'updated', {
      id: ticketId,
      data: { messageId: message.id, sender, message, status: sender === MessageSender.AGENT ? TicketStatus.WAITING_USER : TicketStatus.IN_REVIEW },
    });

    // Agent reply → persistent inbox row + push for the ticket owner. The
    // deepLink lands the user directly in the ticket chat.
    if (isAgent && ticket.userId !== userId) {
      await this.notifications
        .createNotification({
          userId: ticket.userId,
          type: NotificationType.SYSTEM,
          title: 'Soporte respondió tu ticket',
          titleEn: 'Support replied to your ticket',
          body: `${ticket.subject}: ${dto.content.slice(0, 120)}`,
          data: {
            ticketId,
            messageId: message.id,
            deepLink: `/(app)/support/chat/${ticketId}`,
            kind: 'SUPPORT_REPLY',
          },
        })
        .catch(() => undefined);
    }
    return message;
  }

  // ── Admin ─────────────────────────────────

  async findAllTickets(filter: TicketFilterDto) {
    const { page = 1, limit = 20, status, priority, category } = filter;
    const skip = getPaginationOffset(page, limit);
    const where: any = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(category && { category }),
    };

    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          assignedTo: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async updateTicket(id: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const timestamps: any = {};
    if (dto.status === TicketStatus.RESOLVED) timestamps.resolvedAt = new Date();
    if (dto.status === TicketStatus.CLOSED) timestamps.closedAt = new Date();

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...timestamps,
      },
    });
    this.realtime.toUserAndStaff(ticket.userId, 'ticket', 'updated', { id, data: updated });
    return updated;
  }

  // ── Quick Replies ─────────────────────────

  async getQuickReplies() {
    return this.prisma.supportQuickReply.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createQuickReply(dto: CreateQuickReplyDto) {
    return this.prisma.supportQuickReply.create({ data: dto });
  }

  async updateQuickReply(id: string, dto: UpdateQuickReplyDto) {
    return this.prisma.supportQuickReply.update({ where: { id }, data: dto });
  }

  async deleteQuickReply(id: string) {
    return this.prisma.supportQuickReply.update({ where: { id }, data: { isActive: false } });
  }
}
