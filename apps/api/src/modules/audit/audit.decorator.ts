// ─────────────────────────────────────────────
//  @Audit() — mark a controller handler as auditable.
//  AuditInterceptor reads this metadata and writes a row to AuditLog
//  on successful execution (does not run on thrown errors).
// ─────────────────────────────────────────────
import { SetMetadata } from '@nestjs/common';

export interface AuditOptions {
  action: string;                                      // e.g. "user.ban"
  targetType?: string;                                 // e.g. "USER"
  targetIdParam?: string;                              // route param name holding the targetId (default: "id")
}

export const AUDIT_KEY = 'opalbar:audit';

export const Audit = (action: string, opts: Omit<AuditOptions, 'action'> = {}) =>
  SetMetadata(AUDIT_KEY, { action, ...opts });
