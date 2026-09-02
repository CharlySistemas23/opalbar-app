-- Schema drift repair + Report polymorphic fix.
--
-- Three problems, all present in production:
--
-- 1. `Report.targetId` carried THREE foreign keys at once (User, Post,
--    Comment). Postgres enforces every constraint on a column, so a value had
--    to exist in all three tables simultaneously — impossible. Every INSERT
--    failed with "Report_targetId_user_fkey violated", i.e. reporting a post,
--    comment or user was broken 100% of the time (App Store guideline 1.2).
--    Fix: `targetId` stays a plain polymorphic pointer (still indexed and used
--    by every query) and referential integrity moves to three typed nullable
--    columns, exactly one of which is set according to `targetType`.
--
-- 2. `ReservationBlock` and `PushBroadcast` existed in schema.prisma but no
--    migration ever created them, so `/reservations/availability` and the
--    admin broadcast history threw "table does not exist".
--
-- 3. `EmailCampaign.images` / `.attachments` were likewise never created.

-- ── 1. Report: drop the mutually-exclusive constraints ──
ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_targetId_user_fkey";
ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_targetId_post_fkey";
ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_targetId_comment_fkey";

ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "reportedUserId" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "reportedPostId" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "reportedCommentId" TEXT;

-- Backfill rows that predate the fix (only targets that still exist).
UPDATE "Report" r SET "reportedUserId" = r."targetId"
  WHERE r."targetType" = 'USER'
    AND r."reportedUserId" IS NULL
    AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = r."targetId");

UPDATE "Report" r SET "reportedPostId" = r."targetId"
  WHERE r."targetType" = 'POST'
    AND r."reportedPostId" IS NULL
    AND EXISTS (SELECT 1 FROM "Post" p WHERE p."id" = r."targetId");

UPDATE "Report" r SET "reportedCommentId" = r."targetId"
  WHERE r."targetType" = 'COMMENT'
    AND r."reportedCommentId" IS NULL
    AND EXISTS (SELECT 1 FROM "Comment" c WHERE c."id" = r."targetId");

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reportedUserId_fkey"
  FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reportedPostId_fkey"
  FOREIGN KEY ("reportedPostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reportedCommentId_fkey"
  FOREIGN KEY ("reportedCommentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Report_reportedPostId_idx" ON "Report"("reportedPostId");
CREATE INDEX IF NOT EXISTS "Report_reportedCommentId_idx" ON "Report"("reportedCommentId");
CREATE INDEX IF NOT EXISTS "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- ── 2. Missing tables ──
CREATE TABLE IF NOT EXISTS "ReservationBlock" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(200),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReservationBlock_venueId_idx" ON "ReservationBlock"("venueId");
CREATE INDEX IF NOT EXISTS "ReservationBlock_startsAt_idx" ON "ReservationBlock"("startsAt");

ALTER TABLE "ReservationBlock" DROP CONSTRAINT IF EXISTS "ReservationBlock_venueId_fkey";
ALTER TABLE "ReservationBlock"
  ADD CONSTRAINT "ReservationBlock_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PushBroadcast" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PushBroadcast_sentAt_idx" ON "PushBroadcast"("sentAt");

-- ── 3. Missing campaign columns ──
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── 4. Privacy defaults now match the schema (new accounts only) ──
ALTER TABLE "User" ALTER COLUMN "dmPolicy" SET DEFAULT 'FRIENDS_ONLY';
ALTER TABLE "User" ALTER COLUMN "mentionPolicy" SET DEFAULT 'FRIENDS_ONLY';
