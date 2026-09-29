-- AlterTable
ALTER TABLE "GalleryAlbum" ADD COLUMN     "coverMediaId" TEXT;

-- CreateIndex
CREATE INDEX "GalleryAlbum_coverMediaId_idx" ON "GalleryAlbum"("coverMediaId");

-- AddForeignKey
ALTER TABLE "GalleryAlbum" ADD CONSTRAINT "GalleryAlbum_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
