import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdateInterestsDto } from './dto/update-profile.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get full profile of current user' })
  getMe(@CurrentUser() user: User) {
    return this.usersService.findById(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update user profile' })
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/interests')
  @ApiOperation({ summary: 'Update user interests (categories)' })
  updateInterests(@CurrentUser() user: User, @Body() dto: UpdateInterestsDto) {
    return this.usersService.updateInterests(user.id, dto);
  }

  @Patch('me/notifications')
  @ApiOperation({ summary: 'Update notification settings' })
  updateNotifications(@CurrentUser() user: User, @Body() settings: Record<string, boolean>) {
    return this.usersService.updateNotificationSettings(user.id, settings);
  }

  @Patch('me/consent')
  @ApiOperation({ summary: 'Update GDPR consent settings' })
  updateConsent(@CurrentUser() user: User, @Body() consent: Record<string, boolean>) {
    return this.usersService.updateConsent(user.id, consent);
  }

  @Post('me/export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request personal data export (GDPR)' })
  requestExport(@CurrentUser() user: User) {
    return this.usersService.requestDataExport(user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request account deletion (GDPR - 30 day delay)' })
  requestDeletion(@CurrentUser() user: User, @Body('reason') reason?: string) {
    return this.usersService.requestAccountDeletion(user.id, reason);
  }

  // ── SEARCH / DIRECTORY ────────────────────────

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search users by name/handle' })
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.usersService.search(q || '', parseInt(limit || '20', 10));
  }

  @Get('me/saved')
  @ApiOperation({ summary: 'List my saved items (posts/events/offers)' })
  listSaved(@CurrentUser() user: User, @Query('type') type?: string) {
    return this.usersService.listSaved(user.id, type);
  }

  @Post('me/saved')
  @ApiOperation({ summary: 'Toggle save of a target' })
  toggleSave(@CurrentUser() user: User, @Body() dto: { type: string; targetId: string }) {
    return this.usersService.toggleSave(user.id, dto.type, dto.targetId);
  }

  // ── FOLLOW / FOLLOWERS ────────────────────────

  @Get(':id/followers')
  @Public()
  @ApiOperation({ summary: 'List followers of user' })
  getFollowers(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.usersService.listFollowers(id, parseInt(limit || '30', 10));
  }

  @Get(':id/following')
  @Public()
  @ApiOperation({ summary: 'List users that :id is following' })
  getFollowing(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.usersService.listFollowing(id, parseInt(limit || '30', 10));
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  follow(@CurrentUser() me: User, @Param('id') id: string) {
    return this.usersService.follow(me.id, id);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@CurrentUser() me: User, @Param('id') id: string) {
    return this.usersService.unfollow(me.id, id);
  }

  // ── PUBLIC PROFILE ────────────────────────────

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get public profile of any user' })
  getUser(@Param('id') id: string, @CurrentUser() me?: User) {
    return this.usersService.getPublicProfile(id, me?.id);
  }
}
