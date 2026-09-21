-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "zIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Chat_roomId_userId_idx" ON "Chat"("roomId", "userId");
