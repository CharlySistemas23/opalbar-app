-- ─────────────────────────────────────────────
-- Notification aggregation key — backend audit P1 #8 (2026-05-18)
--
-- Previously the aggregator filtered by JSON path on `data.aggregationKey`,
-- which is un-indexed → full table scan per like/comment notification.
--
-- This migration adds an indexed `aggregationKey` column and a composite
-- index on (userId, type, read, aggregationKey) so the lookup is O(log n).
-- The service writes the column on new rows AND keeps writing into
-- `data.aggregationKey` for backward compatibility with legacy rows.
-- ─────────────────────────────────────────────

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "aggregationKey" TEXT;

-- Backfill from existing data.aggregationKey rows (safe, idempotent).
UPDATE "Notification"
  SET "aggregationKey" = (data->>'aggregationKey')
  WHERE "aggregationKey" IS NULL AND data ? 'aggregationKey';

CREATE INDEX IF NOT EXISTS "Notification_userId_type_read_aggregationKey_idx"
  ON "Notification" ("userId", "type", "read", "aggregationKey");
