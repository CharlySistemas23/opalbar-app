-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "stickerKey" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
