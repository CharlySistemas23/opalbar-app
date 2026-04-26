-- ─────────────────────────────────────────────
--  MENTIONS — polymorphic tagging across posts & stories
--  Idempotent: safe to re-run on Railway redeploys
-- ─────────────────────────────────────────────

-- New enum: MentionPolicy
DO $$
BEGIN
  CREATE TYPE "MentionPolicy" AS ENUM ('EVERYONE', 'FRIENDS_OF_FRIENDS', 'FRIENDS_ONLY', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- New enum: MentionTargetType
DO $$
BEGIN
  CREATE TYPE "MentionTargetType" AS ENUM ('POST', 'STORY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- New enum: MentionStatus
DO $$
BEGIN
  CREATE TYPE "MentionStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend NotificationType with POST_MENTION, STORY_MENTION, MENTION_APPROVAL_NEEDED
DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'POST_MENTION';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STORY_MENTION';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTION_APPROVAL_NEEDED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add mentionPolicy column to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentionPolicy" "MentionPolicy" NOT NULL DEFAULT 'EVERYONE';

-- Mention table
CREATE TABLE IF NOT EXISTS "Mention" (
  "id"           TEXT NOT NULL,
  "targetType"   "MentionTargetType" NOT NULL,
  "targetId"     TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "authorId"     TEXT NOT NULL,
  "status"       "MentionStatus" NOT NULL DEFAULT 'APPROVED',
  "x"            DOUBLE PRECISION,
  "y"            DOUBLE PRECISION,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- Unique: one mention per (targetType, targetId, targetUserId)
CREATE UNIQUE INDEX IF NOT EXISTS "Mention_targetType_targetId_targetUserId_key"
  ON "Mention"("targetType", "targetId", "targetUserId");

CREATE INDEX IF NOT EXISTS "Mention_targetUserId_status_idx"
  ON "Mention"("targetUserId", "status");

CREATE INDEX IF NOT EXISTS "Mention_targetType_targetId_idx"
  ON "Mention"("targetType", "targetId");

CREATE INDEX IF NOT EXISTS "Mention_authorId_idx" ON "Mention"("authorId");
CREATE INDEX IF NOT EXISTS "Mention_status_idx"   ON "Mention"("status");

-- Foreign keys (guarded with DO block — skip if already added by a prior run)
DO $$
BEGIN
  ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
