import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportStatus, UserRole, UserStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
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
  broadcast(@Body() body: { title: string; body: string; audience?: 'ALL' | 'ADMINS' }) {
    return this.adminService.broadcastPush(body.title, body.body, body.audience ?? 'ALL');
  }

  @Get('users') @ApiOperation({ summary: 'List all users' })
  listUsers(@Query() pagination: AdminListUsersDto) {
    return this.adminService.listUsers(pagination);
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
  updateRole(@CurrentUser() admin: User, @Param('id') id: string, @Body('role') role: UserRole) {
    return this.adminService.updateUserRole(admin.id, id, role);
  }

  @Patch('users/:id/note')
  @Audit('user.note.update', { targetType: 'USER' })
  @ApiOperation({ summary: 'Create/update internal admin note on user profile' })
  updateInternalNote(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body('note') note: string | null,
  ) {
    return this.adminService.updateInternalNote(admin.id, id, note);
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

  @Patch('flags/:key') @Roles(UserRole.SUPER_ADMIN)
  @Audit('feature_flag.toggle', { targetType: 'FEATURE_FLAG', targetIdParam: 'key' })
  @ApiOperation({ summary: 'Toggle feature flag' })
  toggleFlag(@Param('key') key: string, @Body('enabled') enabled: boolean) {
    return this.adminService.setFeatureFlag(key, enabled);
  }

  // ── Reservations ──────────────────────────

  @Get('reservations') @ApiOperation({ summary: 'List all reservations' })
  listReservations(@Query() filter: ReservationFilterDto) {
    return this.reservationsService.findAll(filter);
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
