// ─────────────────────────────────────────────
//  AuditInterceptor — reads @Audit() metadata and records to AuditLog
//  on successful execution. Skips on errors and on requests without an
//  authenticated user.
// ─────────────────────────────────────────────
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { AUDIT_KEY, AuditOptions } from './audit.decorator';
import { redact } from '../../common/utils/redact';

interface AuthedRequest extends Request {
  user?: { id?: string; role?: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.get<AuditOptions | undefined>(AUDIT_KEY, context.getHandler());
    if (!opts) return next.handle();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = req.user;
    if (!user?.id) return next.handle();

    const idParam = opts.targetIdParam || 'id';
    const targetId =
      (req.params as Record<string, string> | undefined)?.[idParam] ||
      (req.body as Record<string, string> | undefined)?.[idParam] ||
      null;

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const ua = (req.headers['user-agent'] as string) || null;

    return next.handle().pipe(
      tap(() => {
        const metadata: Record<string, unknown> = {};
        if (req.body && Object.keys(req.body as object).length > 0) {
          metadata['body'] = redact(req.body);
        }
        if (req.query && Object.keys(req.query as object).length > 0) {
          metadata['query'] = req.query;
        }

        void this.audit.record({
          actorId: user.id!,
          actorRole: user.role || 'UNKNOWN',
          action: opts.action,
          targetType: opts.targetType ?? null,
          targetId,
          ipAddress: ip,
          userAgent: ua,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }),
    );
  }
}
