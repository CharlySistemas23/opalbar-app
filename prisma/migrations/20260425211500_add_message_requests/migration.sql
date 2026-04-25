-- DM policy + thread status for message-request gating (IG/FB hybrid)

-- Enums (idempotent for redeploys)
DO $$ BEGIN
  CREATE TYPE "DmPolicy" AS ENUM ('EVERYONE', 'FOLLOWING', 'NONE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MessageThreadStatus" AS ENUM ('ACCEPTED', 'PENDING', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- New notification types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MESSAGE_NEW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MESSAGE_REQUEST';

-- User.dmPolicy
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dmPolicy" "DmPolicy" NOT NULL DEFAULT 'EVERYONE';

-- MessageThread.status + requestedById
ALTER TABLE "MessageThread"
  ADD COLUMN IF NOT EXISTS "status" "MessageThreadStatus" NOT NULL DEFAULT 'ACCEPTED',
  ADD COLUMN IF NOT EXISTS "requestedById" TEXT;

CREATE INDEX IF NOT EXISTS "MessageThread_status_idx" ON "MessageThread"("status");
