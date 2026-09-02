import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DmPolicy, SavedItemType, User } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdateInterestsDto } from './dto/update-profile.dto';
import {
  DeleteAccountDto,
  UpdateNotificationSettingsDto,
  UpdatePrivacyDto,
} from './dto/account-settings.dto';

// Backend audit P1 #7 (2026-05-18): policy was a raw string parsed via
// Object.values check at runtime; ValidationPipe with @IsEnum now rejects
// invalid values at the boundary with a structured 400 error.
class UpdateDmPolicyDto {
  @IsEnum(DmPolicy)
  policy: DmPolicy;
}

// Saved items toggle. Inline `{ type, targetId }` skipped ValidationPipe
// entirely (forbidNonWhitelisted only applies to class DTOs).
class SaveDto {
  @IsEnum(SavedItemType)
  type: SavedItemType;

  @IsString()
  targetId: string;
}

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
  @ApiOperation({ summary: 'Update notification settings (partial; unknown keys → 400)' })
  updateNotifications(@CurrentUser() user: User, @Body() settings: UpdateNotificationSettingsDto) {
    return this.usersService.updateNotificationSettings(user.id, settings);
  }

  @Patch('me/dm-policy')
  @ApiOperation({ summary: 'Update who can send me DMs (EVERYONE | FOLLOWING | NONE)' })
  updateDmPolicy(@CurrentUser() user: User, @Body() dto: UpdateDmPolicyDto) {
    return this.usersService.updateDmPolicy(user.id, dto.policy);
  }

  @Patch('me/privacy')
  @ApiOperation({ summary: 'Toggle private account (isPrivate)' })
  updatePrivacy(@CurrentUser() user: User, @Body() dto: UpdatePrivacyDto) {
    return this.usersService.updatePrivacy(user.id, dto.isPrivate);
  }

  @Get('me/data-requests')
  @ApiOperation({ summary: 'My GDPR requests (exports + deletions) with status' })
  listDataRequests(@CurrentUser() user: User) {
    return this.usersService.listDataRequests(user.id);
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
  @ApiOperation({ summary: 'Request account deletion (GDPR): immediate soft-delete + 30-day purge window' })
  requestDeletion(@CurrentUser() user: User, @Body() dto: DeleteAccountDto) {
    return this.usersService.requestAccountDeletion(user.id, {
      reason: dto?.reason,
      password: dto?.password,
    });
  }

  // ── SEARCH / DIRECTORY ────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Search users by name/handle (auth required, anti-scraping)' })
  search(@CurrentUser() me: User, @Query('q') q: string, @Query('limit') limit?: string) {
    return this.usersService.search(q || '', parseInt(limit || '20', 10), me?.id);
  }

  @Get('me/saved')
  @ApiOperation({ summary: 'List my saved items (posts/events/offers)' })
  listSaved(@CurrentUser() user: User, @Query('type') type?: string) {
    return this.usersService.listSaved(user.id, type);
  }

  @Post('me/saved')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle save of a target → { saved: boolean }' })
  toggleSave(@CurrentUser() user: User, @Body() dto: SaveDto) {
    return this.usersService.toggleSave(user.id, dto.type, dto.targetId);
  }

  // ── FOLLOW / FOLLOWERS ────────────────────────

  // Audit fix: bajo @Public, anonimos podian listar followers de cuentas
  // privadas. Ahora exige login Y el service chequea visibilidad por
  // privacidad. JwtAuthGuard ya esta global, asi que basta con quitar @Public.
  @Get(':id/followers')
  @ApiOperation({ summary: 'List followers of user, paginated (respeta isPrivate)' })
  getFollowers(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() me?: User,
  ) {
    return this.usersService.listFollowers(id, parseInt(page || '1', 10), parseInt(limit || '30', 10), me?.id);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'List users that :id is following, paginated (respeta isPrivate)' })
  getFollowing(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() me?: User,
  ) {
    return this.usersService.listFollowing(id, parseInt(page || '1', 10), parseInt(limit || '30', 10), me?.id);
  }

  @Get(':id/friends')
  @ApiOperation({ summary: 'List accepted friends of user, paginated; mutual=1 → friends in common with me' })
  getFriends(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('mutual') mutual?: string,
    @CurrentUser() me?: User,
  ) {
    const wantMutual = mutual === '1' || mutual === 'true';
    return this.usersService.listFriends(id, me?.id, parseInt(page || '1', 10), parseInt(limit || '30', 10), wantMutual);
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

  // Audit fix: removed @Public to prevent anonymous user enumeration.
  // Privacy gating in service still hides fields based on viewer relationship.
  @Get(':id')
  @ApiOperation({ summary: 'Get profile of any user (auth required, respects isPrivate)' })
  getUser(@Param('id') id: string, @CurrentUser() me?: User) {
    return this.usersService.getPublicProfile(id, me?.id);
  }
}
