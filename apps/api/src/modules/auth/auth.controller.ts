// ─────────────────────────────────────────────
//  AuthController — /api/v1/auth/*
// ─────────────────────────────────────────────
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Headers,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ThrottleAuth } from '../../common/decorators/throttle-custom.decorator';
import { User } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Register ──────────────────────────────

  @Post('register')
  @Public()
  @ThrottleAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'Account created, OTP sent' })
  @ApiResponse({ status: 409, description: 'Email or phone already in use' })
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
  ) {
    return this.authService.register(dto, ip);
  }

  // ── Login ─────────────────────────────────

  @Post('login')
  @Public()
  @ThrottleAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/phone and password' })
  @ApiResponse({ status: 200, description: 'Returns access + refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, ip, userAgent);
  }

  // ── Refresh Token ─────────────────────────

  @Post('refresh')
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get new access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  async refresh(@CurrentUser() user: User & { sessionId: string }) {
    return this.authService.refreshTokens(
      user.id,
      user.sessionId,
      // The raw refreshToken is validated inside the strategy
      '',
    );
  }

  // ── Logout ────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  async logout(
    @CurrentUser() user: User,
    @Headers('authorization') auth: string,
  ) {
    // Extract jti from current token
    const token = auth?.replace('Bearer ', '');
    const decoded = this.authService['jwtService'].decode(token) as any;
    await this.authService.logout(user.id, decoded?.sessionId || '', decoded?.jti || '');
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all active sessions' })
  async logoutAll(@CurrentUser() user: User) {
    await this.authService.logoutAllSessions(user.id);
  }

  // ── Password ──────────────────────────────

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (requires current password)' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password using OTP code' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
  }

  // ── Sessions ──────────────────────────────

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions' })
  async getSessions(@CurrentUser() user: User) {
    return this.authService.getActiveSessions(user.id);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @CurrentUser() user: User,
    @Param('sessionId') sessionId: string,
  ) {
    await this.authService.revokeSession(user.id, sessionId);
  }

  // ── Me ────────────────────────────────────

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@CurrentUser() user: User) {
    return this.authService.sanitizeUser(user);
  }
}
