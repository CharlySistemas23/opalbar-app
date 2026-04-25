// ─────────────────────────────────────────────
//  JwtAuthGuard — protects routes with JWT, respects @Public()
// ─────────────────────────────────────────────
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  private isPublic(context: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  override async canActivate(context: ExecutionContext) {
    // For @Public() routes, still attempt JWT validation so @CurrentUser()
    // is populated when a token is present (needed for per-user data like
    // hasReacted on community posts). Never throw: if no/invalid token,
    // continue as anonymous.
    if (this.isPublic(context)) {
      try {
        await (super.canActivate(context) as Promise<boolean>);
      } catch {
        // ignore — public route, anonymous access allowed
      }
      return true;
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  override handleRequest<TUser = unknown>(err: Error, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    if (this.isPublic(context)) {
      // On public routes, return whatever passport produced (may be falsy).
      // Do not throw — anonymous access is allowed.
      return (user || (undefined as unknown as TUser));
    }
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
