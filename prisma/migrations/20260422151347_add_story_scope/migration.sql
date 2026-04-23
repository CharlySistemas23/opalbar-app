-- CreateEnum
CREATE TYPE "StoryScope" AS ENUM ('PERSONAL', 'VENUE');

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "scope" "StoryScope" NOT NULL DEFAULT 'PERSONAL';

-- CreateIndex
CREATE INDEX "Story_scope_expiresAt_idx" ON "Story"("scope", "expiresAt");
