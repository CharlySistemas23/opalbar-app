-- CreateTable
CREATE TABLE "PostEmojiReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostEmojiReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostEmojiReaction_postId_idx" ON "PostEmojiReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostEmojiReaction_postId_userId_emoji_key" ON "PostEmojiReaction"("postId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "PostEmojiReaction" ADD CONSTRAINT "PostEmojiReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostEmojiReaction" ADD CONSTRAINT "PostEmojiReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
