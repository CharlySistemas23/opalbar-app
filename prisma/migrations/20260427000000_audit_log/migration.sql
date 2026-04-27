-- ─────────────────────────────────────────────
--  AuditLog — generic audit trail for privileged actions
-- ─────────────────────────────────────────────

CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "actorId"    TEXT NOT NULL,
    "actorRole"  VARCHAR(20) NOT NULL,
    "action"     VARCHAR(60) NOT NULL,
    "targetType" VARCHAR(40),
    "targetId"   TEXT,
    "ipAddress"  VARCHAR(45),
    "userAgent"  VARCHAR(300),
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_createdAt_idx"     ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx"      ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_targetType_targetId_idx"   ON "AuditLog"("targetType", "targetId");
CREATE INDEX "AuditLog_createdAt_idx"             ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
