-- CreateTable
CREATE TABLE "BoardVersion" (
    "id" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardVersion_roomId_createdAt_idx" ON "BoardVersion"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "BoardVersion" ADD CONSTRAINT "BoardVersion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
