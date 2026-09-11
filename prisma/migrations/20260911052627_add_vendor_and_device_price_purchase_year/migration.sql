-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "price" DECIMAL(12,2),
ADD COLUMN     "purchaseYear" INTEGER,
ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Device_vendorId_idx" ON "Device"("vendorId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
