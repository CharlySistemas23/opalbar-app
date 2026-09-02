import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostStatus, UserRole } from '@prisma/client';
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
import {
  AdjustPointsDto,
  AdminPostsFilterDto,
  AdminReportsFilterDto,
  BanUserDto,
  BroadcastPushDto,
  BulkPostIdsDto,
  BulkReviewIdsDto,
  CreateFeatureFlagDto,
  CreateLoyaltyLevelDto,
  CreateManualReservationDto,
  CreateTicketForUserDto,
  CreateUserManuallyDto,
  GdprProcessDto,
  PinPostDto,
  RejectPostDto,
  ResolveReportDto,
  SendMessageAsAdminDto,
  UpdateFeatureFlagDto,
  UpdateLoyaltyLevelDto,
  UpdatePostStatusDto,
  VenueBlockDto,
} from './dto/admin-actions.dto';
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
  processExport(@Param('id') id: string, @Body() dto: GdprProcessDto) {
    return this.adminService.processExportRequest(id, dto.action);
  }

  @Patch('gdpr/deletion/:id') @ApiOperation({ summary: 'Process / approve deletion request' })
  @Audit('gdpr.deletion.process', { targetType: 'GDPR_DELETION' })
  processDeletion(@Param('id') id: string, @Body() dto: GdprProcessDto) {
    return this.adminService.processDeletionRequest(id, dto.action);
  }

  @Post('notifications/broadcast')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Audit('push.broadcast')
  @ApiOperation({ summary: 'Send a push notification to all users' })
  broadcast(@CurrentUser() admin: User, @Body() dto: BroadcastPushDto) {
    return this.adminService.broadcastPush(dto.title, dto.body, dto.audience ?? 'ALL', admin.id);
  }

  @Get('users') @ApiOperation({ summary: 'List all users' })
  listUsers(@Query() pagination: AdminListUsersDto) {
    return this.adminService.listUsers(pagination);
  }

  @Post('users') @Roles(UserRole.SUPER_ADMIN)
  @Audit('user.create_admin', { targetType: 'USER' })
  @ApiOperation({ summary: 'Create a user manually (staff onboarding, VIP). Returns temp password.' })
  createUser(@CurrentUser() admin: User, @Body() dto: CreateUserManuallyDto) {
    return this.adminService.createUserManually(admin.id, dto);
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

  @Post('users/:id/mark-verified') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Audit('user.mark_verified', { targetType: 'USER', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Mark the account as verified without the OTP round-trip (admin override)' })
  markUserVerified(@CurrentUser() admin: User, @Param('id') id: string) {
    return this.adminService.markUserVerified(admin.id, id);
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
  adjustPoints(@CurrentUser() admin: User, @Param('id') id: string, @Body() dto: AdjustPointsDto) {
    return this.adminService.adjustUserPoints(admin.id, id, dto.delta, dto.reason);
  }

  @Patch('users/:id/ban')
  @Audit('user.ban', { targetType: 'USER' })
  @ApiOperation({ summary: 'Ban a user' })
  banUser(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: BanUserDto) {
    return this.adminService.banUser(user.id, id, dto.reason ?? '');
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

  // ── Community moderation feed ─────────────
  // Posts publish immediately; admins verify afterwards. The feed lists every
  // status by default — filter with ?status=… or ?reported=1.

  @Get('community/posts') @ApiOperation({ summary: 'Moderation feed — all posts, filter by status / reported / search' })
  getPosts(@Query() filter: AdminPostsFilterDto) { return this.adminService.getPosts(filter); }

  @Get('posts/pending') @ApiOperation({ summary: '(legacy) Posts pending moderation' })
  getPendingPosts(@Query() pagination: PaginationDto) {
    return this.adminService.getPosts({ ...pagination, status: PostStatus.PENDING_REVIEW });
  }

  @Get('community/posts/:id') @ApiOperation({ summary: 'Post detail (any status) with author email, reports and moderation log' })
  getPostDetail(@Param('id') id: string) { return this.adminService.getPostDetail(id); }

  @Patch('community/posts/:id/status')
  @Audit('post.status', { targetType: 'POST', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Set post status: PUBLISHED (verify) / HIDDEN / REJECTED (+reason). Notifies the author.' })
  setPostStatus(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdatePostStatusDto) {
    return this.adminService.setPostStatus(user.id, id, dto.status, dto.reason);
  }

  @Delete('community/posts/:id') @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('post.delete', { targetType: 'POST', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Soft-delete a post from the moderation panel' })
  deletePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adminService.deletePost(user.id, id, user.role);
  }

  @Patch('posts/:id/approve')
  @Audit('post.approve', { targetType: 'POST' })
  @ApiOperation({ summary: 'Approve a post' })
  approvePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adminService.moderatePost(user.id, id, 'approve');
  }

  @Patch('posts/:id/reject')
  @Audit('post.reject', { targetType: 'POST' })
  @ApiOperation({ summary: 'Reject a post' })
  rejectPost(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RejectPostDto) {
    return this.adminService.moderatePost(user.id, id, 'reject', dto.reason);
  }

  @Patch('posts/:id/pin') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Audit('post.pin', { targetType: 'POST', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Toggle pinned state of a post (anuncio fijo en el feed)' })
  togglePinPost(@Param('id') id: string, @Body() dto: PinPostDto) {
    return this.adminService.togglePinPost(id, !!dto.pinned);
  }

  @Post('posts/bulk/approve')
  @Audit('post.bulk.approve')
  @ApiOperation({ summary: 'Approve multiple posts at once (max 100)' })
  bulkApprovePosts(@CurrentUser() user: User, @Body() dto: BulkPostIdsDto) {
    return this.adminService.bulkModeratePosts(user.id, dto.ids ?? [], 'approve');
  }

  @Post('posts/bulk/reject')
  @Audit('post.bulk.reject')
  @ApiOperation({ summary: 'Reject multiple posts at once (max 100)' })
  bulkRejectPosts(@CurrentUser() user: User, @Body() dto: BulkPostIdsDto) {
    return this.adminService.bulkModeratePosts(user.id, dto.ids ?? [], 'reject', dto.reason);
  }

  @Get('reports') @ApiOperation({ summary: 'Content reports — status defaults to PENDING (use status=ALL for everything), search by reporter/target' })
  getReports(@Query() filter: AdminReportsFilterDto) { return this.adminService.getReports(filter); }

  @Get('reports/:id') @ApiOperation({ summary: 'Get report detail with target content + all reporters' })
  getReportDetail(@Param('id') id: string) { return this.adminService.getReportDetail(id); }

  @Patch('reports/:id/resolve')
  @Audit('report.resolve', { targetType: 'REPORT' })
  @ApiOperation({ summary: 'Resolve a report' })
  resolveReport(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.adminService.resolveReport(id, user.id, dto.status);
  }

  @Get('loyalty/levels') @ApiOperation({ summary: 'All loyalty levels incl. inactive (admin view)' })
  listLoyaltyLevels() { return this.adminService.listLoyaltyLevels(); }

  @Post('loyalty-levels') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Create loyalty level' })
  createLoyaltyLevel(@Body() dto: CreateLoyaltyLevelDto) { return this.adminService.createLoyaltyLevel(dto); }

  @Patch('loyalty-levels/:id') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Update loyalty level' })
  updateLoyaltyLevel(@Param('id') id: string, @Body() dto: UpdateLoyaltyLevelDto) {
    return this.adminService.updateLoyaltyLevel(id, dto);
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
  createFlag(@Body() dto: CreateFeatureFlagDto) {
    return this.adminService.createFeatureFlag(dto.key, dto.description, dto.enabled);
  }

  @Patch('flags/:key') @Roles(UserRole.SUPER_ADMIN)
  @Audit('feature_flag.update', { targetType: 'FEATURE_FLAG', targetIdParam: 'key' })
  @ApiOperation({ summary: 'Update feature flag (toggle and/or description)' })
  toggleFlag(@Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.adminService.updateFeatureFlag(key, dto);
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
  createTicketForUser(@CurrentUser() admin: User, @Body() dto: CreateTicketForUserDto) {
    return this.adminService.createTicketForUser(admin.id, dto);
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
  sendMessageAsAdmin(@CurrentUser() admin: User, @Body() dto: SendMessageAsAdminDto) {
    return this.adminService.sendMessageAsAdmin(admin.id, dto.userId, dto.content);
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
  bulkDeleteReviews(@Body() dto: BulkReviewIdsDto) {
    return this.adminService.bulkDeleteReviews(dto.ids ?? []);
  }

  @Get('venues') @ApiOperation({ summary: 'Todos los venues, activos e inactivos (pickers del admin)' })
  listVenues() {
    return this.adminService.listVenues();
  }

  @Get('venues/:id/blocks') @ApiOperation({ summary: 'Listar bloqueos de horarios de un venue' })
  listVenueBlocks(@Param('id') id: string) {
    return this.adminService.listVenueBlocks(id);
  }

  @Post('venues/:id/blocks') @ApiOperation({ summary: 'Crear bloqueo de horario (privado, mantenimiento)' })
  @Audit('venue.create_block', { targetType: 'VENUE', targetIdParam: 'id' })
  createVenueBlock(@CurrentUser() admin: User, @Param('id') id: string, @Body() dto: VenueBlockDto) {
    return this.adminService.createVenueBlock(admin.id, id, dto);
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
  createManualReservation(@CurrentUser() admin: User, @Body() dto: CreateManualReservationDto) {
    return this.adminService.createManualReservation(admin.id, dto);
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

  @Get('support/tickets/:id') @ApiOperation({ summary: 'Ticket detail with user, agent and full message thread' })
  getTicket(@Param('id') id: string) {
    return this.adminService.getTicketDetail(id);
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
