import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get public profile of any user' })
  getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
