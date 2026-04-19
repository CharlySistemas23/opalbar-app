import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportStatus, UserRole, UserStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { User } from '@prisma/client';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats') @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Dashboard stats' })
  getDashboard() { return this.adminService.getDashboardStats(); }

  @Get('users') @ApiOperation({ summary: 'List all users' })
  listUsers(@Query() pagination: PaginationDto & { search?: string; status?: UserStatus; role?: UserRole }) {
    return this.adminService.listUsers(pagination);
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
  updateRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.adminService.updateUserRole(id, role);
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

  @Get('reports') @ApiOperation({ summary: 'Get pending content reports' })
  getReports(@Query() pagination: PaginationDto) { return this.adminService.getReports(pagination); }

  @Patch('reports/:id/resolve') @ApiOperation({ summary: 'Resolve a report' })
  resolveReport(@CurrentUser() user: User, @Param('id') id: string, @Body('status') status: ReportStatus) {
    return this.adminService.resolveReport(id, user.id, status);
  }

  @Post('loyalty-levels') @Roles(UserRole.SUPER_ADMIN) @ApiOperation({ summary: 'Create loyalty level' })
  createLoyaltyLevel(@Body() data: any) { return this.adminService.createLoyaltyLevel(data); }
}
