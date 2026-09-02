// ─────────────────────────────────────────────
//  AuthService — registro, login, tokens, logout, refresh
// ─────────────────────────────────────────────
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpType, User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { OtpService } from '../otp/otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: Partial<User>;
  tokens: AuthTokens;
}

export interface TwoFactorChallenge {
  requires2FA?: true;
  requiresEmailVerification?: true;
  identifier: string;
  expiresIn: number;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => OtpService))
    private readonly otpService: OtpService,
  ) {}

  // ─────────────────────────────────────────
  //  REGISTER
  // ─────────────────────────────────────────

  async register(
    dto: RegisterDto,
    ipAddress?: string,
  ): Promise<{ message: string; email: string; expiresIn: number }> {
    // Email is required for verification
    if (!dto.email) {
      throw new BadRequestException('Email is required');
    }

    // Check uniqueness
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('An account with this phone number already exists');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const birthDate = dto.birthDate ? new Date(dto.birthDate) : undefined;

    // Create user + profile + consent in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              language: dto.language || 'es',
              birthDate,
              city: dto.city,
              gender: dto.gender,
              occupation: dto.occupation,
              discoverySource: dto.discoverySource,
            },
          },
          consent: {
            create: {
              termsAccepted: true,
              privacyAccepted: true,
              termsVersion: '1.0',
              privacyVersion: '1.0',
            },
          },
        },
      });

      if (dto.interestCategoryIds && dto.interestCategoryIds.length) {
        const validCategories = await tx.eventCategory.findMany({
          where: { id: { in: dto.interestCategoryIds }, isActive: true },
          select: { id: true },
        });
        if (validCategories.length) {
          await tx.userInterest.createMany({
            data: validCategories.map((c) => ({
              userId: newUser.id,
              categoryId: c.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Log login attempt
      await tx.loginAttempt.create({
        data: {
          userId: newUser.id,
          email: dto.email,
          phone: dto.phone,
          ipAddress: ipAddress || 'unknown',
          success: true,
          reason: 'REGISTRATION',
        },
      });

      return newUser;
    });

    this.logger.log(`New user registered: ${user.id}`);

    // Auto-send EMAIL_VERIFICATION OTP so the user lands on the verify screen
    let expiresIn = 600;
    try {
      const otp = await this.otpService.sendOtp({
        email: dto.email,
        type: OtpType.EMAIL_VERIFICATION,
      });
      expiresIn = otp.expiresIn;
    } catch (err: any) {
      // Don't block registration if OTP send fails — user can resend from the verify screen
      this.logger.error(`Failed to auto-send OTP to ${dto.email}: ${err?.message ?? err}`);
    }

    return {
      message: 'Account created. We sent a verification code to your email.',
      email: dto.email,
      expiresIn,
    };
  }

  // ─────────────────────────────────────────
  //  LOGIN
  // ─────────────────────────────────────────

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse | TwoFactorChallenge> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone number is required');
    }

    // Find user
    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
      include: { profile: true },
    });

    // Log attempt regardless of outcome
    const logAttempt = async (success: boolean, reason?: string) => {
      await this.prisma.loginAttempt.create({
        data: {
          userId: user?.id,
          email: dto.email,
          phone: dto.phone,
          ipAddress: ipAddress || 'unknown',
          success,
          reason,
        },
      });
    };

    if (!user || !user.passwordHash) {
      await logAttempt(false, 'USER_NOT_FOUND');
      // Generic message to prevent user enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await logAttempt(false, 'INVALID_PASSWORD');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check status
    if (user.status === UserStatus.BANNED) {
      await logAttempt(false, 'ACCOUNT_BANNED');
      throw new UnauthorizedException('Your account has been suspended. Contact support.');
    }

    if (user.status === UserStatus.DELETED) {
      await logAttempt(false, 'ACCOUNT_DELETED');
      // Password already validated above → safe to tell the owner why.
      throw new UnauthorizedException(this.deletedAccountMessage(user));
    }

    // ── Verificación obligatoria (email O telefono) ──
    // Antes podías registrarte, NO confirmar el código y aun así entrar
    // con email + password. El check anterior solo bloqueaba si el user
    // tenia email — los registrados con phone bypassean. Ahora se aplica
    // a ambos canales: email → reenvia OTP email, phone → SMS.
    if (!user.isVerified) {
      await logAttempt(false, 'NOT_VERIFIED');
      const channel: 'email' | 'phone' = user.email ? 'email' : 'phone';
      const identifier = user.email ?? user.phone;
      if (!identifier) {
        // No tiene ni email ni phone — caso raro (cuenta corrupta). Bloquear.
        throw new UnauthorizedException('Account requires verification but no contact channel');
      }
      try {
        await this.otpService.sendOtp({
          ...(channel === 'email' ? { email: user.email! } : { phone: user.phone! }),
          type: channel === 'email' ? OtpType.EMAIL_VERIFICATION : OtpType.PHONE_VERIFICATION,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to auto-resend verification OTP to ${identifier}: ${msg}`);
      }
      return {
        requiresEmailVerification: true,
        identifier,
        expiresIn: 600,
      } as TwoFactorChallenge;
    }

    // ── 2FA gate for SUPER_ADMIN ──
    // Password is correct, but we don't issue tokens yet — send OTP and require
    // the caller to complete /auth/login/2fa with the code. Mobile users (USER
    // role) flow through normally below.
    if (user.role === UserRole.SUPER_ADMIN && user.email) {
      await logAttempt(true, '2FA_REQUIRED');
      try {
        const otp = await this.otpService.sendOtp({
          email: user.email,
          type: OtpType.LOGIN_2FA,
        });
        return {
          requires2FA: true,
          identifier: user.email,
          expiresIn: otp.expiresIn,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to send 2FA OTP to ${user.email}: ${msg}`);
        throw new UnauthorizedException('Could not send 2FA code. Try again.');
      }
    }

    await logAttempt(true);

    // Generate tokens & create session
    const tokens = await this.createSession(user, {
      deviceToken: dto.deviceToken,
      deviceName: dto.deviceName,
      deviceOs: dto.deviceOs,
      ipAddress,
      userAgent,
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // ─────────────────────────────────────────
  //  LOGIN — 2FA second step (SUPER_ADMIN only)
  //  Caller has already passed password check; this verifies the OTP
  //  and issues tokens.
  // ─────────────────────────────────────────

  async loginVerify2FA(
    identifier: string,
    code: string,
    meta: { deviceToken?: string; deviceName?: string; deviceOs?: string; ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: identifier },
      include: { profile: true },
    });

    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedException(this.deletedAccountMessage(user));
    }

    // Verify the OTP — throws BadRequest on mismatch / expiry.
    await this.otpService.verifyOtp({
      identifier,
      code,
      type: OtpType.LOGIN_2FA,
    });

    await this.prisma.loginAttempt.create({
      data: {
        userId: user.id,
        email: identifier,
        ipAddress: meta.ipAddress || 'unknown',
        success: true,
        reason: '2FA_SUCCESS',
      },
    });

    const tokens = await this.createSession(user, meta);
    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // ─────────────────────────────────────────
  //  LOGIN / SIGN-UP WITH VERIFIED OTP
  //  Called after OTP verify succeeds. Creates user if missing.
  // ─────────────────────────────────────────

  async loginWithOtp(
    identifier: string,
    meta: { deviceToken?: string; deviceName?: string; deviceOs?: string; ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponse & { isNewUser: boolean }> {
    const isEmail = identifier.includes('@');
    const where = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };

    let user = await this.prisma.user.findFirst({ where, include: { profile: true } });
    const isNewUser = false;

    if (!user) {
      // No passwordless sign-up: OTP login only completes for existing accounts.
      throw new UnauthorizedException('Invalid credentials');
    } else {
      // Mark as verified (first OTP succeeded)
      if (!user.isVerified) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true },
          include: { profile: true },
        });
      }
    }

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Your account has been suspended. Contact support.');
    }
    if (user.status === UserStatus.DELETED) {
      // OTP already verified ownership of the channel → safe to explain.
      throw new UnauthorizedException(this.deletedAccountMessage(user));
    }

    const tokens = await this.createSession(user, meta);

    return {
      user: this.sanitizeUser(user),
      tokens,
      isNewUser,
    };
  }

  // ─────────────────────────────────────────
  //  REFRESH TOKEN
  // ─────────────────────────────────────────

  async refreshTokens(
    userId: string,
    sessionId: string,
    oldRefreshToken: string,
  ): Promise<AuthTokens> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, refreshToken: oldRefreshToken, isActive: true },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false },
      });
      throw new UnauthorizedException('Refresh token expired. Please log in again.');
    }

    // Rotate refresh token (one-time use)
    const newJti = uuidv4();
    const newRefreshToken = await this.generateRefreshToken(userId, sessionId, newJti);
    const newAccessToken = this.generateAccessToken(session.user, newJti, sessionId);

    const refreshExpiresIn = this.getRefreshExpiresMs();

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + refreshExpiresIn),
        updatedAt: new Date(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.getAccessExpiresSeconds(),
    };
  }

  // ─────────────────────────────────────────
  //  LOGOUT
  // ─────────────────────────────────────────

  async logout(userId: string, sessionId: string, jti: string): Promise<void> {
    // Blocklist the JWT
    const ttl = this.getAccessExpiresSeconds();
    await this.redis.set(RedisService.sessionBlocklistKey(jti), '1', ttl);

    // Deactivate session
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { isActive: false },
    });

    // Remove from user sessions set
    await this.redis.srem(RedisService.userSessionsKey(userId), sessionId);

    this.logger.log(`User ${userId} logged out (session: ${sessionId})`);
  }

  /**
   * Revoke every active session of the user. When `exceptSessionId` is given
   * (e.g. "log out everywhere else" / password change) the caller's own
   * session survives. Access tokens of revoked sessions are blocklisted in
   * Redis so they die immediately instead of at expiry.
   */
  async logoutAllSessions(userId: string, exceptSessionId?: string): Promise<{ revoked: number }> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      select: { id: true, refreshToken: true },
    });

    if (!sessions.length) return { revoked: 0 };

    await this.prisma.session.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { isActive: false },
    });

    await Promise.all(
      sessions.map(async (s) => {
        const jti = this.jtiFromToken(s.refreshToken);
        if (jti) await this.blocklistJti(jti);
        await this.redis
          .srem(RedisService.userSessionsKey(userId), s.id)
          .catch((err) => this.logger.warn(`[AUTH] redis.srem failed: ${err?.message ?? err}`));
      }),
    );

    if (!exceptSessionId) {
      await this.redis
        .del(RedisService.userSessionsKey(userId))
        .catch((err) => this.logger.warn(`[AUTH] redis.del failed: ${err?.message ?? err}`));
    }

    this.logger.log(
      `${sessions.length} session(s) revoked for user ${userId}${exceptSessionId ? ` (kept ${exceptSessionId})` : ''}`,
    );
    return { revoked: sessions.length };
  }

  // ─────────────────────────────────────────
  //  CHANGE PASSWORD
  // ─────────────────────────────────────────

  /**
   * Changes the password and revokes every OTHER session; the session that
   * performed the change stays alive so the app doesn't kick the user out.
   */
  async changePassword(userId: string, dto: ChangePasswordDto, currentSessionId?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new BadRequestException('Cannot change password for this account');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke every other session (current device stays logged in)
    await this.logoutAllSessions(userId, currentSessionId);

    this.logger.log(`Password changed for user ${userId}`);
  }

  // ─────────────────────────────────────────
  //  RESET PASSWORD (via OTP)
  // ─────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const identifier = dto.identifier.includes('@')
      ? dto.identifier.toLowerCase()
      : dto.identifier;

    // The code must have been verified: either the app pre-verified it via
    // /otp/verify (which leaves a reset ticket) or we verify it right now.
    const ticketOk = await this.otpService.consumeResetTicket(identifier, dto.otpCode);
    if (!ticketOk) {
      await this.otpService.verifyOtp({
        identifier,
        code: dto.otpCode,
        type: OtpType.PASSWORD_RESET,
      });
      await this.otpService.consumeResetTicket(identifier, dto.otpCode);
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        status: user.status === UserStatus.PENDING_VERIFICATION
          ? UserStatus.ACTIVE
          : user.status,
      },
    });

    await this.logoutAllSessions(user.id);

    this.logger.log(`Password reset for user ${user.id}`);
  }

  // ─────────────────────────────────────────
  //  ACTIVE SESSIONS
  // ─────────────────────────────────────────

  async getActiveSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceName: true,
        deviceOs: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Current device first, then most recently active.
    return sessions
      .map((s) => ({
        ...s,
        lastActiveAt: s.updatedAt,
        isCurrent: !!currentSessionId && s.id === currentSessionId,
      }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, refreshToken: true, isActive: true },
    });
    if (!session) {
      throw new BadRequestException('Session not found');
    }
    if (session.isActive) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false },
      });
    }
    // Kill the access token that belongs to that session right away.
    const jti = this.jtiFromToken(session.refreshToken);
    if (jti) await this.blocklistJti(jti);
    await this.redis
      .srem(RedisService.userSessionsKey(userId), sessionId)
      .catch((err) => this.logger.warn(`[AUTH] redis.srem failed: ${err?.message ?? err}`));

    this.logger.log(`Session ${sessionId} revoked for user ${userId}`);
  }

  // ─────────────────────────────────────────
  //  HELPERS (private)
  // ─────────────────────────────────────────

  /**
   * Message shown when the owner of a soft-deleted account tries to log in.
   * Only used AFTER the credentials/OTP were validated (no enumeration).
   */
  private deletedAccountMessage(user: Pick<User, 'deletedAt'>): string {
    return user.deletedAt
      ? 'Account scheduled for deletion'
      : 'Invalid credentials';
  }

  /**
   * Access + refresh tokens of a session share the same `jti`, so decoding
   * the stored refresh token gives the jti to blocklist. Never throws.
   */
  private jtiFromToken(token: string | null | undefined): string | null {
    if (!token || token === 'pending') return null;
    try {
      const decoded = this.jwtService.decode(token) as { jti?: string } | null;
      return decoded?.jti ?? null;
    } catch {
      return null;
    }
  }

  private async blocklistJti(jti: string): Promise<void> {
    const ttl = this.getAccessExpiresSeconds();
    await this.redis
      .set(RedisService.sessionBlocklistKey(jti), '1', ttl)
      .catch((err) => this.logger.warn(`[AUTH] redis blocklist failed: ${err?.message ?? err}`));
  }

  private async createSession(
    user: User,
    meta: {
      deviceToken?: string;
      deviceName?: string;
      deviceOs?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthTokens> {
    const jti = uuidv4();
    const refreshExpiresMs = this.getRefreshExpiresMs();

    // Create DB session first to get sessionId
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: 'pending', // placeholder
        deviceName: meta.deviceName,
        deviceOs: meta.deviceOs,
        deviceToken: meta.deviceToken,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        isActive: true,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    const accessToken = this.generateAccessToken(user, jti, session.id);
    const refreshToken = await this.generateRefreshToken(user.id, session.id, jti);

    // Update session with real refresh token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken },
    });

    // Track in Redis (fire-and-forget — never block login on Redis outage)
    this.redis
      .sadd(RedisService.userSessionsKey(user.id), session.id)
      .catch((err) => this.logger.warn(`[AUTH] redis.sadd failed: ${err?.message ?? err}`));

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getAccessExpiresSeconds(),
    };
  }

  private generateAccessToken(user: User, jti: string, sessionId: string): string {
    // `sessionId` in the access payload lets /auth/logout, /auth/sessions
    // (isCurrent) and /auth/change-password know which device is calling.
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      jti,
      sessionId,
    };
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      // jsonwebtoken v9 types `expiresIn` as a StringValue template literal;
      // the config value is a plain string ("15m").
      expiresIn: this.config.get<string>('jwt.accessExpiresIn', '15m') as any,
    });
  }

  private async generateRefreshToken(
    userId: string,
    sessionId: string,
    jti: string,
  ): Promise<string> {
    const payload = { sub: userId, sessionId, jti };
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn', '30d') as any,
    });
  }

  private getAccessExpiresSeconds(): number {
    const str = this.config.get<string>('jwt.accessExpiresIn', '15m');
    if (str.endsWith('m')) return parseInt(str) * 60;
    if (str.endsWith('h')) return parseInt(str) * 3600;
    if (str.endsWith('d')) return parseInt(str) * 86400;
    return 900;
  }

  private getRefreshExpiresMs(): number {
    const str = this.config.get<string>('jwt.refreshExpiresIn', '30d');
    if (str.endsWith('d')) return parseInt(str) * 86400 * 1000;
    if (str.endsWith('h')) return parseInt(str) * 3600 * 1000;
    return 30 * 86400 * 1000;
  }

  sanitizeUser(user: User): Partial<User> {
    const { passwordHash: _, ...safe } = user as any;
    return safe;
  }

  /**
   * Decodes (without verifying — the guard already did) the bearer token of
   * the current request to learn which session/jti is calling.
   */
  decodeBearer(authorization?: string): { sessionId?: string; jti?: string } {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization;
    if (!token) return {};
    try {
      const decoded = this.jwtService.decode(token) as { sessionId?: string; jti?: string } | null;
      return { sessionId: decoded?.sessionId, jti: decoded?.jti };
    } catch {
      return {};
    }
  }
}
