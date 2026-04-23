-- CreateEnum
CREATE TYPE "EmailCampaignTemplate" AS ENUM ('GENERIC', 'OFFER', 'EVENT', 'BIRTHDAY', 'WELCOME', 'NEWS');

-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailAudienceType" AS ENUM ('ALL', 'NEW_7D', 'VIP', 'BIRTHDAY_MONTH', 'INACTIVE_30D', 'CUSTOM');

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "preheader" VARCHAR(200),
    "headline" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" VARCHAR(60),
    "ctaUrl" VARCHAR(500),
    "heroImageUrl" VARCHAR(500),
    "template" "EmailCampaignTemplate" NOT NULL DEFAULT 'GENERIC',
    "audienceType" "EmailAudienceType" NOT NULL DEFAULT 'ALL',
    "audienceFilter" JSONB,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "unsubCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "unsubToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "unsubedAt" TIMESTAMP(3),
    "failedReason" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");

-- CreateIndex
CREATE INDEX "EmailCampaign_scheduledAt_idx" ON "EmailCampaign"("scheduledAt");

-- CreateIndex
CREATE INDEX "EmailCampaign_createdAt_idx" ON "EmailCampaign"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignRecipient_unsubToken_key" ON "EmailCampaignRecipient"("unsubToken");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_campaignId_idx" ON "EmailCampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_userId_idx" ON "EmailCampaignRecipient"("userId");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_unsubToken_idx" ON "EmailCampaignRecipient"("unsubToken");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignRecipient_campaignId_userId_key" ON "EmailCampaignRecipient"("campaignId", "userId");

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
