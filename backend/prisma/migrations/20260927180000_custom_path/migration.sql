-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "customPath" TEXT;
ALTER TABLE "Instructor" ADD COLUMN "customPath" TEXT;
ALTER TABLE "Post" ADD COLUMN       "customPath" TEXT;
ALTER TABLE "PortfolioItem" ADD COLUMN "customPath" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Course_customPath_key" ON "Course"("customPath");
CREATE UNIQUE INDEX "Instructor_customPath_key" ON "Instructor"("customPath");
CREATE UNIQUE INDEX "Post_customPath_key" ON "Post"("customPath");
CREATE UNIQUE INDEX "PortfolioItem_customPath_key" ON "PortfolioItem"("customPath");
