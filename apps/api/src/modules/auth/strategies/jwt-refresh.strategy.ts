// ─────────────────────────────────────────────
//  JWT Refresh Token Strategy
// ─────────────────────────────────────────────
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  jti: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken = req.body?.refreshToken;

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        refreshToken,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (session.user.status === 'BANNED' || session.user.status === 'DELETED') {
      throw new UnauthorizedException('Account is not active');
    }

    return { ...session.user, sessionId: session.id };
  }
}
