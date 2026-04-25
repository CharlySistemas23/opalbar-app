-- AlterEnum
-- Idempotent so it survives partial application from a prior failed deploy.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMUNITY_FOLLOW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMUNITY_NEW_POST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VENUE_STORY_NEW';
