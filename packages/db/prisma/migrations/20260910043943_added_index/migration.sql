-- DropIndex
DROP INDEX "Chat_roomId_userId_idx";

-- CreateIndex
CREATE INDEX "Chat_roomId_zIndex_idx" ON "Chat"("roomId", "zIndex");
