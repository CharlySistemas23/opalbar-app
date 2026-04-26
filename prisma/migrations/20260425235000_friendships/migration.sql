-- Friendships (FB/IG hybrid) + extended DM/friend privacy + new notif types

-- Enums (idempotent for redeploys)
DO $$ BEGIN
  CREATE TYPE "FriendPolicy" AS ENUM ('EVERYONE', 'FRIENDS_OF_FRIENDS', 'NONE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend DmPolicy with FRIENDS_OF_FRIENDS + FRIENDS_ONLY
ALTER TYPE "DmPolicy" ADD VALUE IF NOT EXISTS 'FRIENDS_OF_FRIENDS';
ALTER TYPE "DmPolicy" ADD VALUE IF NOT EXISTS 'FRIENDS_ONLY';

-- New notification types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_ACCEPTED';

-- User: friendPolicy + isPrivate
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "friendPolicy" "FriendPolicy" NOT NULL DEFAULT 'EVERYONE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- Friendship table
CREATE TABLE IF NOT EXISTS "Friendship" (
  "id"           TEXT NOT NULL,
  "requesterId"  TEXT NOT NULL,
  "addresseeId"  TEXT NOT NULL,
  "status"       "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
  "filteredAt"   TIMESTAMP(3),
  "acceptedAt"   TIMESTAMP(3),
  "declinedAt"   TIMESTAMP(3),
  "blockedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");
CREATE INDEX IF NOT EXISTS "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");
CREATE INDEX IF NOT EXISTS "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");
CREATE INDEX IF NOT EXISTS "Friendship_status_idx" ON "Friendship"("status");

DO $$ BEGIN
  ALTER TABLE "Friendship"
    ADD CONSTRAINT "Friendship_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Friendship"
    ADD CONSTRAINT "Friendship_addresseeId_fkey"
    FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
