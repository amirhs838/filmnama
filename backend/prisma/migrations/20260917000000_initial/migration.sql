CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR');

CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BLOG_EDITOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latin" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "latin" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "syllabus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "image" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseInstructor" (
    "courseId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseInstructor_pkey" PRIMARY KEY ("courseId","instructorId")
);

CREATE TABLE "CourseFaq" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseFaq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaVariant" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryAlbum" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GalleryAlbum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "student" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mediaId" TEXT,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "courseId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contact" JSONB NOT NULL DEFAULT '{}',
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentRevision" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevalidationOutbox" (
    "id" TEXT NOT NULL,
    "paths" TEXT[],
    "version" INTEGER NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevalidationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "User_active_deletedAt_idx" ON "User"("active", "deletedAt");

CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

CREATE INDEX "RefreshSession_familyId_revokedAt_idx" ON "RefreshSession"("familyId", "revokedAt");

CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId", "expiresAt");

CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");

CREATE INDEX "Department_status_deletedAt_slug_idx" ON "Department"("status", "deletedAt", "slug");

CREATE INDEX "Course_status_deletedAt_id_idx" ON "Course"("status", "deletedAt", "id");

CREATE INDEX "Course_departmentId_status_idx" ON "Course"("departmentId", "status");

CREATE UNIQUE INDEX "Course_departmentId_slug_key" ON "Course"("departmentId", "slug");

CREATE UNIQUE INDEX "Instructor_slug_key" ON "Instructor"("slug");

CREATE INDEX "Instructor_status_deletedAt_idx" ON "Instructor"("status", "deletedAt");

CREATE INDEX "CourseInstructor_instructorId_idx" ON "CourseInstructor"("instructorId");

CREATE UNIQUE INDEX "CourseFaq_courseId_position_key" ON "CourseFaq"("courseId", "position");

CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

CREATE INDEX "Post_status_deletedAt_publishedAt_idx" ON "Post"("status", "deletedAt", "publishedAt");

CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");

CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");

CREATE UNIQUE INDEX "MediaVariant_storageKey_key" ON "MediaVariant"("storageKey");

CREATE UNIQUE INDEX "MediaVariant_mediaId_name_key" ON "MediaVariant"("mediaId", "name");

CREATE UNIQUE INDEX "GalleryAlbum_slug_key" ON "GalleryAlbum"("slug");

CREATE INDEX "GalleryAlbum_status_deletedAt_idx" ON "GalleryAlbum"("status", "deletedAt");

CREATE INDEX "GalleryItem_albumId_position_idx" ON "GalleryItem"("albumId", "position");

CREATE INDEX "GalleryItem_mediaId_idx" ON "GalleryItem"("mediaId");

CREATE UNIQUE INDEX "PortfolioItem_slug_key" ON "PortfolioItem"("slug");

CREATE INDEX "PortfolioItem_status_deletedAt_idx" ON "PortfolioItem"("status", "deletedAt");

CREATE INDEX "PortfolioItem_mediaId_idx" ON "PortfolioItem"("mediaId");

CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

CREATE INDEX "Lead_courseId_idx" ON "Lead"("courseId");

CREATE UNIQUE INDEX "Redirect_source_key" ON "Redirect"("source");

CREATE INDEX "Redirect_destination_idx" ON "Redirect"("destination");

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

CREATE INDEX "RevalidationOutbox_deliveredAt_createdAt_idx" ON "RevalidationOutbox"("deliveredAt", "createdAt");

ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseFaq" ADD CONSTRAINT "CourseFaq_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "GalleryAlbum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
