-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "coverMediaId" TEXT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "coverMediaId" TEXT;

-- CreateIndex
CREATE INDEX "Course_coverMediaId_idx" ON "Course"("coverMediaId");

-- CreateIndex
CREATE INDEX "Post_coverMediaId_idx" ON "Post"("coverMediaId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
