-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "DiscoverySource" AS ENUM ('INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'FRIEND', 'WALKED_BY', 'GOOGLE', 'EVENT', 'INFLUENCER', 'OTHER');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('POINTS_ADJUST', 'STATUS_CHANGE', 'ROLE_CHANGE', 'NOTE_ADDED', 'NOTE_UPDATED', 'DELETE', 'BAN', 'UNBAN', 'VERIFY', 'MESSAGE_SENT', 'INTEREST_ADDED', 'INTEREST_REMOVED', 'PROFILE_UPDATED');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "discoverySource" "DiscoverySource",
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "internalNote" VARCHAR(2000),
ADD COLUMN     "occupation" VARCHAR(120);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" "AdminActionType" NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActionLog_targetUserId_createdAt_idx" ON "AdminActionLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_adminUserId_createdAt_idx" ON "AdminActionLog"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_action_idx" ON "AdminActionLog"("action");

-- CreateIndex
CREATE INDEX "UserProfile_gender_idx" ON "UserProfile"("gender");

-- CreateIndex
CREATE INDEX "UserProfile_discoverySource_idx" ON "UserProfile"("discoverySource");

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
