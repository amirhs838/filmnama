import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import sanitize from 'sanitize-html';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { customPathInput, isCustomFirstSegmentAllowed } from './paths';

export const slug = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const localPath = z.string().max(250).regex(/^\/courses(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$/);
const cmsPath = z.string().max(250).regex(/^\/(?:blog|instructors|gallery|works)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/);
// Editor-defined custom paths (also used by the revalidation outbox):
// latin/Persian segments, up to 5 levels, never validated against the
// reserved list here (that check runs at write time, not on dispatch).
const customUrlPath = z.string().max(250).regex(/^(?:[A-Za-z0-9_\u0600-\u06FF.-]+)(?:\/(?:[A-Za-z0-9_\u0600-\u06FF.-]+)){0,4}$/);
export function validRevalidationPath(path: string) {
  if (path === '/') return true;
  if (localPath.safeParse(path).success || cmsPath.safeParse(path).success) return true;
  if (!path.startsWith('/') || path.length > 251) return false;
  const naked = path.endsWith('/') ? path.slice(1, -1) : path.slice(1);
  if (!isCustomFirstSegmentAllowed(naked)) return false;
  return customUrlPath.safeParse(naked).success;
}
export function cleanHtml(html: string) {
  return sanitize(html, { allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a'], allowedAttributes: { a: ['href', 'title'] }, allowedSchemes: ['https', 'http', 'mailto'], allowProtocolRelative: false });
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export const signature = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex');
export function safeEqual(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
@Injectable()
export class SchemaPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>) {}
  transform(value: unknown): T { const result = this.schema.safeParse(value); if (!result.success) throw new BadRequestException('Invalid request'); return result.data; }
}
export const seoSchema = z.object({ title: z.string().max(200).nullable(), description: z.string().max(400).nullable(), canonicalUrl: z.string().url().regex(/^https:\/\//).max(500).nullable(), noindex: z.boolean() }).strict();
export const coverMediaIdSchema = z.string().min(1).max(100).nullish().transform((value) => value ?? null);
export const departmentSchema = z.object({ slug, label: z.string().min(1).max(200), latin: z.string().min(1).max(200), description: z.string().max(5000), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']), seo: seoSchema.optional() }).strict();
export const courseSchema = z.object({ slug, departmentId: z.string().min(1).max(100), title: z.string().min(1).max(200), latin: z.string().min(1).max(200), description: z.string().max(5000), level: z.string().max(200), duration: z.string().max(200), iconKey: z.enum(['Drama', 'Camera', 'Clapperboard', 'Palette', 'Scissors', 'Aperture', 'Sparkles', 'Music', 'Code2', 'BrainCircuit', 'Server', 'Languages']), contentHtml: z.string().max(100000).transform(cleanHtml), syllabus: z.array(z.string().max(1000)).max(100), faq: z.array(z.object({ question: z.string().min(1).max(1000), answer: z.string().max(5000) }).strict()).max(100), instructorIds: z.array(z.string().min(1).max(100)).max(30).refine((ids) => new Set(ids).size === ids.length), seo: seoSchema, status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']), coverMediaId: coverMediaIdSchema, customPath: customPathInput.optional() }).strict();
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export const listSchema = z.object({ department: slug.optional(), limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().max(300).regex(/^[A-Za-z0-9_-]+$/).optional() }).strict();
export type ListInput = z.infer<typeof listSchema>;
// Phase 1 CMS: schemas mirror the existing Prisma columns (no new migration).
// - Instructor has no publishedAt/seo/latin/title columns: public visibility is
//   status=PUBLISHED + deletedAt=null; seo is accepted (optional) but ignored on persist.
// - Category/Tag have only slug/title columns (no label/description/status columns):
//   the API uses `title`; task shorthand `label` maps to `title`.
export const instructorSchema = z.object({
  slug,
  name: z.string().min(2).max(200),
  bio: z.string().max(5000),
  image: z.string().max(500).nullable().optional().default(null),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  seo: seoSchema.optional(),
  customPath: customPathInput.optional(),
}).strict();
export type InstructorInput = z.infer<typeof instructorSchema>;
export const categorySchema = z.object({ slug, title: z.string().min(1).max(200) }).strict();
export type CategoryInput = z.infer<typeof categorySchema>;
export const tagSchema = z.object({ slug, title: z.string().min(1).max(200) }).strict();
export type TagInput = z.infer<typeof tagSchema>;
export const postSchema = z.object({
  slug,
  title: z.string().min(1).max(200),
  excerpt: z.string().max(2000),
  contentHtml: z.string().max(100000).transform(cleanHtml),
  categoryId: z.string().min(1).max(100).nullish().transform((value) => value ?? null),
  tagIds: z.array(z.string().min(1).max(100)).max(30).refine((ids) => new Set(ids).size === ids.length),
  seo: seoSchema.optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  coverMediaId: coverMediaIdSchema,
  customPath: customPathInput.optional(),
}).strict();
export type PostInput = z.infer<typeof postSchema>;
export const postListSchema = z.object({
  category: slug.optional(),
  tag: slug.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(300).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();
export type PostListInput = z.infer<typeof postListSchema>;
// Phase 3 CMS: schemas mirror the existing Prisma columns (no new migration).
// - GalleryAlbum/PortfolioItem/SiteSettings have no publishedAt column: public
//   visibility is status=PUBLISHED + deletedAt=null (settings is a singleton row).
// - GalleryItem has no caption/status columns: both are accepted for API stability
//   but ignored on persist; item visibility is deletedAt=null and public order is
//   position asc, id asc.
// - GalleryItem.mediaId is required by the database: the schema keeps it optional
//   for forward-compat but the repository rejects creates without a live media row.
// - Media has no status column and no binary handling: metadata records only, the
//   storage backend (file bytes) is deferred to a later phase. Strict JSON only.
export const albumSchema = z.object({
  slug,
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  coverMediaId: z.string().min(1).max(100).nullish().transform((value) => value ?? null),
  seo: seoSchema.optional(),
}).strict();
export type AlbumInput = z.infer<typeof albumSchema>;
export const galleryItemSchema = z.object({
  albumId: z.string().min(1).max(100),
  mediaId: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200),
  caption: z.string().max(2000),
  position: z.number().int().min(0).max(1000000),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
}).strict();
export type GalleryItemInput = z.infer<typeof galleryItemSchema>;
export const portfolioSchema = z.object({
  slug,
  title: z.string().min(1).max(200),
  student: z.string().max(200).optional().default(''),
  category: z.string().min(1).max(100),
  mediaId: z.string().min(1).max(100).nullish().transform((value) => value ?? null),
  contentHtml: z.string().max(100000).transform(cleanHtml),
  seo: seoSchema.optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  customPath: customPathInput.optional(),
}).strict();
export type PortfolioInput = z.infer<typeof portfolioSchema>;
export const portfolioListSchema = z.object({ category: z.string().min(1).max(100).optional() }).strict();
export type PortfolioListInput = z.infer<typeof portfolioListSchema>;
export const mediaMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] as const;
export function assertSafeStorageKey(storageKey: string) {
  if (storageKey.includes('..') || storageKey.includes('\\') || storageKey.startsWith('/') || storageKey.includes('\0')) throw new Error('Invalid storage key');
}
const safeStorageKey = z.string().min(1).max(500).refine((value) => {
  try { assertSafeStorageKey(value); return true; } catch { return false; }
});
export const mediaSchema = z.object({
  storageKey: safeStorageKey,
  mimeType: z.enum(mediaMimeTypes),
  size: z.number().int().min(1).max(500 * 1024 * 1024),
  alt: z.string().max(500),
}).strict();
export type MediaInput = z.infer<typeof mediaSchema>;
export const mediaMetaSchema = z.object({ alt: z.string().max(500) }).strict();
export type MediaMetaInput = z.infer<typeof mediaMetaSchema>;
export const mediaListSchema = z.object({
  mime: z.enum(mediaMimeTypes).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(300).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();
export type MediaListInput = z.infer<typeof mediaListSchema>;
const contactSchema = z.object({
  phone: z.string().max(500).optional(),
  mobile: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  instagram: z.string().max(500).optional(),
}).strict();
export const settingsSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  contact: contactSchema,
  seo: seoSchema.optional(),
}).strict();
export type SettingsInput = z.infer<typeof settingsSchema>;
