// ─────────────────────────────────────────────
//  AuditService — write entries to AuditLog
//  Use directly from services for fine-grained context, or rely on the
//  AuditInterceptor + @Audit() decorator for the common case.
// ─────────────────────────────────────────────
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { redact } from '../../common/utils/redact';

export interface AuditEntry {
  actorId: string;
  actorRole: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          actorRole: entry.actorRole,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent?.slice(0, 300) ?? null,
          metadata: entry.metadata ? (redact(entry.metadata) as object) : undefined,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[AUDIT] failed to record ${entry.action}: ${msg}`);
    }
  }
}
