// ─────────────────────────────────────────────
//  JWT Access Token Strategy
// ─────────────────────────────────────────────
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';

export interface JwtPayload {
  sub: string;         // userId
  email?: string;
  phone?: string;
  role: string;
  jti: string;         // JWT ID for blocklist
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Check if token is blocklisted (logged out)
    const isBlocked = await this.redis.exists(
      RedisService.sessionBlocklistKey(payload.jti),
    );
    if (isBlocked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    if (!user || user.status === 'DELETED') {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Account has been suspended');
    }

    return user;
  }
}
