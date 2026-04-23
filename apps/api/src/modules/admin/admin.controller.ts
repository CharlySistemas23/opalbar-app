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
  processExport(@Param('id') id: string, @Body('action') action: 'APPROVE' | 'REJECT') {
    return this.adminService.processExportRequest(id, action);
  }

  @Patch('gdpr/deletion/:id') @ApiOperation({ summary: 'Process / approve deletion request' })
  processDeletion(@Param('id') id: string, @Body('action') action: 'APPROVE' | 'REJECT') {
    return this.adminService.processDeletionRequest(id, action);
  }

  @Post('notifications/broadcast')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
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

  @Delete('users/:id') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Delete user account (SuperAdmin only). Frees email/phone so they can re-register.' })
  deleteUser(@CurrentUser() admin: User, @Param('id') id: string) {
    return this.adminService.deleteUserDirect(admin.id, id);
  }

  @Post('users/:id/points') @ApiOperation({ summary: 'Manually adjust points (+/-) with reason' })
  adjustPoints(
    @CurrentUser() admin: User,
    @Param('id') id: string,
    @Body() body: { delta: number; reason: string },
  ) {
    return this.adminService.adjustUserPoints(admin.id, id, body.delta, body.reason);
  }

  @Patch('users/:id/ban') @ApiOperation({ summary: 'Ban a user' })
  banUser(@CurrentUser() user: User, @Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.banUser(user.id, id, reason);
  }

  @Patch('users/:id/unban') @ApiOperation({ summary: 'Unban a user' })
  unbanUser(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adminService.unbanUser(user.id, id);
  }

  @Patch('users/:id/role') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Update user role (SuperAdmin only)' })
  updateRole(@CurrentUser() admin: User, @Param('id') id: string, @Body('role') role: UserRole) {
    return this.adminService.updateUserRole(admin.id, id, role);
  }

  @Patch('users/:id/note') @ApiOperation({ summary: 'Create/update internal admin note on user profile' })
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

  @Patch('posts/:id/approve') @ApiOperation({ summary: 'Approve a post' })
  approvePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adminService.moderatePost(user.id, id, 'approve');
  }

  @Patch('posts/:id/reject') @ApiOperation({ summary: 'Reject a post' })
  rejectPost(@CurrentUser() user: User, @Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.moderatePost(user.id, id, 'reject', reason);
  }

  @Post('posts/bulk/approve') @ApiOperation({ summary: 'Approve multiple posts at once (max 100)' })
  bulkApprovePosts(@CurrentUser() user: User, @Body('ids') ids: string[]) {
    return this.adminService.bulkModeratePosts(user.id, ids ?? [], 'approve');
  }

  @Post('posts/bulk/reject') @ApiOperation({ summary: 'Reject multiple posts at once (max 100)' })
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

  @Patch('reports/:id/resolve') @ApiOperation({ summary: 'Resolve a report' })
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

  @Patch('flags/:key') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Toggle feature flag' })
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

  @Patch('reviews/:id/moderate') @ApiOperation({ summary: 'Approve or reject a review' })
  moderateReview(@Param('id') id: string, @Body() dto: ModerationReviewDto) {
    return this.reviewsService.moderate(id, dto);
  }
}
