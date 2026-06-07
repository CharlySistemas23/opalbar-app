import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportStatus, UserRole, UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

// Backend audit P1 #6 & #7 (2026-05-18): role + internal note validated
// via DTOs. Previously `@Body('role')` and `@Body('note')` accepted arbitrary
// strings → Prisma would throw at runtime instead of failing at the boundary.
class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

class UpdateInternalNoteDto {
  // null is allowed (clears the note); empty string treated as null in service.
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminListUsersDto } from './dto/admin-list-users.dto';
import { User } from '@prisma/client';
import { AdminService } from './admin.service';
import { ReservationsService } from '../reservations/reservations.service';
import { ReservationFilterDto, UpdateReservationStatusDto } from '../reservations/dto/reservation.dto';
import { SupportService } from '../support/support.service';
import { CreateQuickReplyDto, TicketFilterDto, UpdateQuickReplyDto, UpdateTicketDto } from '../support/dto/support.dto';
import { ReviewsService } from '../reviews/reviews.service';
import { ModerationReviewDto, ReviewFilterDto } from '../reviews/dto/review.dto';
import { Audit } from '../audit/audit.decorator';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
// Admins burst-hit endpoints (inbox counts polling, bulk moderate, dashboard
// boots). Auth + role guards already gate access, so rate limits are redundant
// here. Bots can't reach these endpoints — they hit /auth/* first.
@SkipThrottle()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly reservationsService: ReservationsService,
    private readonly supportService: SupportService,
    private readonly reviewsService: ReviewsService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats') @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Dashboard stats' })
  getDashboard() { return this.adminService.getDashboardStats(); }

  @Get('activity') @ApiOperation({ summary: 'Recent activity feed across signups, reservations, posts, reports' })
  getActivity(@Query('limit') limit?: string) {
    return this.adminService.getRecentActivity(limit ? parseInt(limit, 10) : 50);
  }

  @Get('inbox') @ApiOperation({ summary: 'Unified action inbox — everything pending, ordered by urgency' })
  getInbox(@Query('limit') limit?: string) {
    return this.adminService.getInbox(limit ? parseInt(limit, 10) : 50);
  }

  @Get('inbox/counts') @ApiOperation({ summary: 'Inbox counts only — for tab badges, cheap to poll' })
  getInboxCounts() {
    return this.adminService.getInboxCounts();
  }

  @Get('gdpr/requests') @ApiOperation({ summary: 'List GDPR export + deletion requests' })
  listGdprRequests() { return this.adminService.listGdprRequests(); }

  @Patch('gdpr/export/:id') @ApiOperation({ summary: 'Process / approve export request' })
  @Audit('gdpr.export.process', { targetType: 'GDPR_EXPORT' })
  processExport(@Param('id') id: string, @Body('action') action: 'APPROVE' | 'REJECT') {
    return this.adminService.processExportRequest(id, action);
  }

  @Patch('gdpr/deletion/:id') @ApiOperation({ summary: 'Process / approve deletion request' })
  @Audit('gdpr.deletion.process', { targetType: 'GDPR_DELETION' })
  processDeletion(@Param('id') id: string, @Body('action') action: 'APPROVE' | 'REJECT') {
    return this.adminService.processDeletionRequest(id, action);
  }

  @Post('notifications/broadcast')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Audit('push.broadcast')
  @ApiOperation({ summary: 'Send a push notification to all users' })
  broadcast(
    @CurrentUser() admin: User,
    @Body() body: { title: string; body: string; audience?: 'ALL' | 'ADMINS' },
  ) {
    return this.adminService.broadcastPush(body.title, body.body, body.audience ?? 'ALL', admin.id);
  }

  @Get('users') @ApiOperation({ summary: 'List all users' })
  listUsers(@Query() pagination: AdminListUsersDto) {
    return this.adminService.listUsers(pagination);
  }

  @Post('users') @Roles(UserRole.SUPER_ADMIN)
  @Audit('user.create_admin', { targetType: 'USER' })
  @ApiOperation({ summary: 'Create a user manually (staff onboarding, VIP). Returns temp password.' })
  createUser(
    @CurrentUser() admin: User,
    @Body() body: { email: string; firstName?: string; lastName?: string; role?: UserRole; phone?: string },
  ) {
    return this.adminService.createUserManually(admin.id, body);
  }

  @Post('users/:id/reset-password') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Audit('user.reset_password', { targetType: 'USER', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Reset password — generates temp password and returns it' })
  resetUserPassword(@CurrentUser() admin: User, @Param('id') id: string) {
    return this.adminService.resetUserPassword(admin.id, id);
  }

  @Post('users/:id/resend-verification') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Audit('user.resend_verification', { targetType: 'USER', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Resend the verification email/OTP to this user' })
  resendUserVerification(@Param('id') id: string) {
    return this.adminService.resendVerification(id);
  }

  @Get('users/:id') @ApiOperation({ summary: 'User detail with interests, stats, consent, activity' })
  getUser(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Delete('users/:id') @Roles(UserRole.SUPER_ADMIN)
  @Audit('user.delete', { targetType: 'USER' })
  @ApiOperation({ summary: 'Delete user account (SuperAdmin only). Frees email/phone so they can re-register.' })
  deleteUser(@CurrentUser() admin: User, @Param('id') id: string) {
    return this.adminService.deleteUserDirect(admin.id, id);
  }

  @Post('users/:id/points')
  @Audit('user.points.adjust', { targetType: 'USER' })
  @ApiOperation({ summary: 'Manually adjust points (+/-) with reason' })
  adjustPoints(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body() body: { delta: number; reason: string },
  ) {
    return this.adminService.adjustUserPoints(admin.id, id, body.delta, body.reason);
  }

  @Patch('users/:id/ban')
  @Audit('user.ban', { targetType: 'USER' })
  @ApiOperation({ summary: 'Ban a user' })
  banUser(@CurrentUser() user: User, @Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.banUser(user.id, id, reason);
  }

  @Patch('users/:id/unban')
  @Audit('user.unban', { targetType: 'USER' })
  @ApiOperation({ summary: 'Unban a user' })
  unbanUser(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adminService.unbanUser(user.id, id);
  }

  @Patch('users/:id/role') @Roles(UserRole.SUPER_ADMIN)
  @Audit('user.role.change', { targetType: 'USER' })
  @ApiOperation({ summary: 'Update user role (SuperAdmin only)' })
  updateRole(@CurrentUser() admin: User, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminService.updateUserRole(admin.id, id, dto.role);
  }

  @Patch('users/:id/note')
  @Audit('user.note.update', { targetType: 'USER' })
  @ApiOperation({ summary: 'Create/update internal admin note on user profile' })
  updateInternalNote(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body() dto: UpdateInternalNoteDto,
  ) {
    return this.adminService.updateInternalNote(admin.id, id, dto.note ?? null);
  }

  @Get('users/:id/audit') @ApiOperation({ summary: 'Admin action log for this user (who did what, when)' })
  getUserAudit(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.adminService.getUserAuditLog(id, limit ? parseInt(limit, 10) : 50);
  }

  @Get('insights/audience')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Audience insights — demographics, interests, engagement, cohorts, hours' })
  getAudienceInsights() {
    return this.adminService.getAudienceInsights();
  }

  @Get('posts/pending') @ApiOperation({ summary: 'Get posts pending moderation' })
  getPendingPosts(@Query() pagination: PaginationDto) { return this.adminService.getPendingPosts(pagination); }

  @Patch('posts/:id/approve')
  @Audit('post.approve', { targetType: 'POST' })
  @ApiOperation({ summary: 'Approve a post' })
  approvePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adminService.moderatePost(user.id, id, 'approve');
  }

  @Patch('posts/:id/reject')
  @Audit('post.reject', { targetType: 'POST' })
  @ApiOperation({ summary: 'Reject a post' })
  rejectPost(@CurrentUser() user: User, @Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.moderatePost(user.id, id, 'reject', reason);
  }

  @Patch('posts/:id/pin') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Audit('post.pin', { targetType: 'POST', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Toggle pinned state of a post (anuncio fijo en el feed)' })
  togglePinPost(@Param('id') id: string, @Body() body: { pinned: boolean }) {
    return this.adminService.togglePinPost(id, !!body.pinned);
  }

  @Post('posts/bulk/approve')
  @Audit('post.bulk.approve')
  @ApiOperation({ summary: 'Approve multiple posts at once (max 100)' })
  bulkApprovePosts(@CurrentUser() user: User, @Body('ids') ids: string[]) {
    return this.adminService.bulkModeratePosts(user.id, ids ?? [], 'approve');
  }

  @Post('posts/bulk/reject')
  @Audit('post.bulk.reject')
  @ApiOperation({ summary: 'Reject multiple posts at once (max 100)' })
  bulkRejectPosts(
    @CurrentUser() user: User,
    @Body('ids') ids: string[],
    @Body('reason') reason?: string,
  ) {
    return this.adminService.bulkModeratePosts(user.id, ids ?? [], 'reject', reason);
  }

  @Get('reports') @ApiOperation({ summary: 'Get pending content reports' })
  getReports(@Query() pagination: PaginationDto) { return this.adminService.getReports(pagination); }

  @Get('reports/:id') @ApiOperation({ summary: 'Get report detail with target content + all reporters' })
  getReportDetail(@Param('id') id: string) { return this.adminService.getReportDetail(id); }

  @Patch('reports/:id/resolve')
  @Audit('report.resolve', { targetType: 'REPORT' })
  @ApiOperation({ summary: 'Resolve a report' })
  resolveReport(@CurrentUser() user: User, @Param('id') id: string, @Body('status') status: ReportStatus) {
    return this.adminService.resolveReport(id, user.id, status);
  }

  @Post('loyalty-levels') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Create loyalty level' })
  createLoyaltyLevel(@Body() data: any) { return this.adminService.createLoyaltyLevel(data); }

  @Patch('loyalty-levels/:id') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Update loyalty level' })
  updateLoyaltyLevel(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateLoyaltyLevel(id, data);
  }

  @Delete('loyalty-levels/:id') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Delete loyalty level' })
  deleteLoyaltyLevel(@Param('id') id: string) {
    return this.adminService.deleteLoyaltyLevel(id);
  }

  @Get('flags') @ApiOperation({ summary: 'List feature flags' })
  listFlags() { return this.adminService.listFeatureFlags(); }

  @Post('flags') @Roles(UserRole.SUPER_ADMIN)
  @Audit('feature_flag.create', { targetType: 'FEATURE_FLAG' })
  @ApiOperation({ summary: 'Create a new feature flag' })
  createFlag(
    @Body() body: { key: string; description?: string; enabled?: boolean },
  ) {
    return this.adminService.createFeatureFlag(body.key, body.description, body.enabled);
  }

  @Patch('flags/:key') @Roles(UserRole.SUPER_ADMIN)
  @Audit('feature_flag.update', { targetType: 'FEATURE_FLAG', targetIdParam: 'key' })
  @ApiOperation({ summary: 'Update feature flag (toggle and/or description)' })
  toggleFlag(
    @Param('key') key: string,
    @Body() body: { enabled?: boolean; description?: string },
  ) {
    return this.adminService.updateFeatureFlag(key, body);
  }

  @Delete('flags/:key') @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('feature_flag.delete', { targetType: 'FEATURE_FLAG', targetIdParam: 'key' })
  @ApiOperation({ summary: 'Delete a feature flag' })
  deleteFlag(@Param('key') key: string) {
    return this.adminService.deleteFeatureFlag(key);
  }

  // ── Tanda 2: tickets · reviews · messages · events ──

  @Post('support/tickets')
  @Audit('ticket.create_admin', { targetType: 'TICKET' })
  @ApiOperation({ summary: 'Crear ticket de soporte en nombre de un usuario (telefono, email)' })
  createTicketForUser(
    @CurrentUser() admin: User,
    @Body() body: { userId: string; subject: string; description: string; priority?: string; category?: string },
  ) {
    return this.adminService.createTicketForUser(admin.id, body);
  }

  @Delete('reviews/:id') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('review.hard_delete', { targetType: 'REVIEW', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Eliminar reseña permanentemente (no soft-delete)' })
  hardDeleteReview(@Param('id') id: string) {
    return this.adminService.hardDeleteReview(id);
  }

  @Post('messages/send')
  @Audit('message.send_as_platform', { targetType: 'MESSAGE' })
  @ApiOperation({ summary: 'Enviar mensaje al usuario como plataforma (advertencia, aviso de moderación)' })
  sendMessageAsAdmin(
    @CurrentUser() admin: User,
    @Body() body: { userId: string; content: string },
  ) {
    return this.adminService.sendMessageAsAdmin(admin.id, body.userId, body.content);
  }

  @Post('events/:id/duplicate')
  @Audit('event.duplicate', { targetType: 'EVENT', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Duplicar evento (crea uno nuevo con mismos datos, status DRAFT)' })
  duplicateEvent(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.adminService.duplicateEvent(id, admin.id);
  }

  // ── Tanda 3: sessions · broadcasts history · bulk reviews · venue blocks ──

  @Get('users/:id/sessions') @ApiOperation({ summary: 'Sesiones activas del usuario' })
  listUserSessions(@Param('id') id: string) {
    return this.adminService.listUserSessions(id);
  }

  @Post('users/:id/sessions/:sessionId/revoke') @HttpCode(HttpStatus.OK)
  @Audit('user.revoke_session', { targetType: 'USER', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Revocar una sesión específica del usuario' })
  revokeUserSession(@Param('id') id: string, @Param('sessionId') sessionId: string) {
    return this.adminService.revokeUserSession(id, sessionId);
  }

  @Post('users/:id/sessions/revoke-all') @HttpCode(HttpStatus.OK)
  @Audit('user.revoke_all_sessions', { targetType: 'USER', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Revocar todas las sesiones del usuario' })
  revokeAllUserSessions(@Param('id') id: string) {
    return this.adminService.revokeAllUserSessions(id);
  }

  @Get('notifications/broadcasts') @ApiOperation({ summary: 'Historial de broadcasts push' })
  listBroadcasts() {
    return this.adminService.listBroadcasts();
  }

  @Post('reviews/bulk-delete') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Audit('review.bulk_delete', { targetType: 'REVIEW' })
  @ApiOperation({ summary: 'Eliminar varias reseñas a la vez' })
  bulkDeleteReviews(@Body() body: { ids: string[] }) {
    return this.adminService.bulkDeleteReviews(body.ids ?? []);
  }

  @Get('venues/:id/blocks') @ApiOperation({ summary: 'Listar bloqueos de horarios de un venue' })
  listVenueBlocks(@Param('id') id: string) {
    return this.adminService.listVenueBlocks(id);
  }

  @Post('venues/:id/blocks') @ApiOperation({ summary: 'Crear bloqueo de horario (privado, mantenimiento)' })
  @Audit('venue.create_block', { targetType: 'VENUE', targetIdParam: 'id' })
  createVenueBlock(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body() body: { startsAt: string; endsAt: string; reason?: string },
  ) {
    return this.adminService.createVenueBlock(admin.id, id, body);
  }

  @Delete('venues/:id/blocks/:blockId') @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('venue.delete_block', { targetType: 'VENUE', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Eliminar bloqueo de horario' })
  deleteVenueBlock(@Param('blockId') blockId: string) {
    return this.adminService.deleteVenueBlock(blockId);
  }

  // ── Reservations ──────────────────────────

  @Get('reservations') @ApiOperation({ summary: 'List all reservations' })
  listReservations(@Query() filter: ReservationFilterDto) {
    return this.reservationsService.findAll(filter);
  }

  @Post('reservations') @ApiOperation({ summary: 'Crear reserva manual (walk-in, telefónica, VIP)' })
  @Audit('reservation.create_admin', { targetType: 'RESERVATION' })
  createManualReservation(
    @CurrentUser() admin: User,
    @Body() body: {
      userId: string;
      venueId: string;
      date: string;
      timeSlot: string;
      partySize: number;
      notes?: string;
      internalNotes?: string;
    },
  ) {
    return this.adminService.createManualReservation(admin.id, body);
  }

  @Patch('reservations/:id/status') @ApiOperation({ summary: 'Update reservation status' })
  updateReservationStatus(@Param('id') id: string, @Body() dto: UpdateReservationStatusDto) {
    return this.reservationsService.updateStatus(id, dto);
  }

  // ── Support ────────────────────────────────

  @Get('support/tickets') @ApiOperation({ summary: 'List all support tickets' })
  listTickets(@Query() filter: TicketFilterDto) {
    return this.supportService.findAllTickets(filter);
  }

  @Patch('support/tickets/:id') @ApiOperation({ summary: 'Update ticket (assign / change status)' })
  updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.supportService.updateTicket(id, dto);
  }

  @Get('support/quick-replies') @ApiOperation({ summary: 'List quick replies' })
  listQuickReplies() { return this.supportService.getQuickReplies(); }

  @Post('support/quick-replies') @ApiOperation({ summary: 'Create quick reply' })
  createQuickReply(@Body() dto: CreateQuickReplyDto) {
    return this.supportService.createQuickReply(dto);
  }

  @Patch('support/quick-replies/:id') @ApiOperation({ summary: 'Update quick reply' })
  updateQuickReply(@Param('id') id: string, @Body() dto: UpdateQuickReplyDto) {
    return this.supportService.updateQuickReply(id, dto);
  }

  @Delete('support/quick-replies/:id') @ApiOperation({ summary: 'Delete quick reply' })
  deleteQuickReply(@Param('id') id: string) {
    return this.supportService.deleteQuickReply(id);
  }

  // ── Reviews ────────────────────────────────

  @Get('reviews') @ApiOperation({ summary: 'List all reviews for moderation' })
  listReviews(@Query() filter: ReviewFilterDto) {
    return this.reviewsService.findAll(filter);
  }

  @Patch('reviews/:id/moderate')
  @Audit('review.moderate', { targetType: 'REVIEW' })
  @ApiOperation({ summary: 'Approve or reject a review' })
  moderateReview(@Param('id') id: string, @Body() dto: ModerationReviewDto) {
    return this.reviewsService.moderate(id, dto);
  }

  // ── Audit log (read) ───────────────────────

  @Get('audit')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Read audit log (SuperAdmin only). Filter by action or actorId.' })
  async getAuditLog(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '100', 10) || 100, 500);
    const where: Record<string, unknown> = {};
    if (action) where['action'] = action;
    if (actorId) where['actorId'] = actorId;
    if (targetId) where['targetId'] = targetId;
    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: { select: { id: true, email: true, role: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    return { items, count: items.length };
  }
}
