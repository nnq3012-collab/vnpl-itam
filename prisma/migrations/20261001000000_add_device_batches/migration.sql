-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'BATCH';

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BatchToDevice" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BatchToDevice_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Batch_name_key" ON "Batch"("name");

-- CreateIndex
CREATE INDEX "_BatchToDevice_B_index" ON "_BatchToDevice"("B");

-- AddForeignKey
ALTER TABLE "_BatchToDevice" ADD CONSTRAINT "_BatchToDevice_A_fkey" FOREIGN KEY ("A") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchToDevice" ADD CONSTRAINT "_BatchToDevice_B_fkey" FOREIGN KEY ("B") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

