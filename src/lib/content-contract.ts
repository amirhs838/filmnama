export const iconKeys = ["Drama", "Camera", "Clapperboard", "Palette", "Scissors", "Aperture", "Sparkles", "Music", "Code2", "BrainCircuit", "Server", "Languages"] as const;

export type IconKey = (typeof iconKeys)[number];
export interface DepartmentDto {
  id: string;
  slug: string;
  label: string;
  latin: string;
  description: string;
  updatedAt: string;
}
export interface CoverMediaDto { id: string; url: string; alt: string }
export const MEDIA_PROXY_LIMIT = 13 * 1024 * 1024;
export function isMediaId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}
export function mediaSrc(id: string): string {
  return `/api/media/${encodeURIComponent(id)}`;
}
export interface CourseDto {
  id: string;
  slug: string;
  title: string;
  latin: string;
  department: string;
  description: string;
  level: string;
  duration: string;
  iconKey: IconKey;
  contentHtml: string;
  syllabus: string[];
  faq: { question: string; answer: string }[];
  instructors: { id: string; slug: string; name: string; bio: string; image: string | null }[];
  coverMedia: CoverMediaDto | null;
  customPath: string | null;
  seo: { title: string | null; description: string | null; canonicalUrl: string | null; noindex: boolean };
  updatedAt: string;
  publishedAt: string | null;
}
export type CourseCardDto = Pick<CourseDto, "id" | "slug" | "title" | "latin" | "department" | "description" | "level" | "duration" | "iconKey" | "coverMedia">;

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isContentPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value === "/" || value === "/courses" || value === "/courses/") return true;
  const naked = value.endsWith("/") && value !== "/" ? value.slice(0, -1) : value;
  if (naked.startsWith("/courses/") && naked.split("/").length <= 4 && naked.slice(9).split("/").every(isSlug)) return true;
  if (naked === "/blog" || naked === "/instructors" || naked === "/gallery" || naked === "/works") return true;
  const cms = /^\/(blog|instructors|gallery|works)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return naked.length <= 250 && cms.test(naked);
}

const customUrlSegment = "[A-Za-z0-9_\\u0600-\\u06FF.-]+";

// First segments owned by the stack — keep in sync with
// backend/src/common/paths.ts RESERVED_FIRST_SEGMENTS (backend rejects these
// at write time; the frontend mirrors the list so intake gates stay strict).
const RESERVED_CUSTOM_FIRST_SEGMENTS = [
  "admin", "api", "courses", "blog", "instructors", "gallery", "works", "search",
  "about", "about-us", "contact", "contact-us", "faq", "professors", "training-course",
  "استادها", "ساخته-های-فیلم-نما", "گالری-ویدیوهای-دورهها",
  "media", "settings", "leads", "login", "users", "reports", "departments",
  "categories", "tags", "posts", "albums",
  "robots.txt", "sitemap.xml", "wp-sitemap.xml", "icon.png", "favicon.ico", "_next",
];

/**
 * Editor-defined custom URLs (stored without leading slash, up to 5
 * segments). Used for revalidation intake and sitemap/canonical rendering —
 * deliberately separate from isContentPath so course-redirect scoping stays
 * strict (see "paths and redirect destinations" test).
 */
export function isCustomUrlPath(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 251) return false;
  const naked = value.endsWith("/") && value !== "/" ? value.slice(0, -1) : value;
  if (!new RegExp(`^/${customUrlSegment}(/${customUrlSegment}){0,4}$`).test(naked)) return false;
  const first = naked.slice(1).split("/")[0] ?? "";
  if (first === "." || first === "..") return false;
  return !RESERVED_CUSTOM_FIRST_SEGMENTS.includes(first.toLowerCase());
}

function invalid(): never {
  throw new Error("Invalid content response");
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 20000): string {
  if (typeof value !== "string" || value.length > max) invalid();
  return value;
}
function required(value: unknown, max = 500): string {
  const result = text(value, max);
  return result.trim() ? result : invalid();
}
function slug(value: unknown): string {
  return isSlug(value) ? value : invalid();
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}
function nullableCustomPath(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 250) invalid();
  return value;
}
function iso(value: unknown): string {
  const result = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) invalid();
  return result;
}
function array<T>(value: unknown, parse: (item: unknown) => T, max = 1000): T[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value.map(parse);
}
function boolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : invalid();
}
export function parseDepartment(value: unknown): DepartmentDto {
  const v = record(value);
  return { id: required(v.id), slug: slug(v.slug), label: required(v.label), latin: text(v.latin), description: text(v.description), updatedAt: iso(v.updatedAt) };
}
export function parseDepartments(value: unknown): DepartmentDto[] {
  const items = array(record(value).items, parseDepartment);
  if (new Set(items.map((item) => item.slug)).size !== items.length) invalid();
  return items;
}
export function parseCourse(value: unknown): CourseDto {
  const v = record(value);
  const seo = record(v.seo);
  if (!iconKeys.includes(v.iconKey as IconKey)) invalid();
  return {
    id: required(v.id), slug: slug(v.slug), title: required(v.title), latin: text(v.latin), department: slug(v.department),
    description: text(v.description), level: text(v.level), duration: text(v.duration), iconKey: v.iconKey as IconKey,
    contentHtml: text(v.contentHtml, 500000), syllabus: array(v.syllabus, (item) => text(item)),
    faq: array(v.faq, (item) => { const q = record(item); return { question: required(q.question), answer: required(q.answer, 20000) }; }),
    instructors: array(v.instructors, (item) => { const i = record(item); return { id: required(i.id), slug: slug(i.slug), name: required(i.name), bio: text(i.bio), image: nullableText(i.image) }; }),
    coverMedia: parseCoverMedia(v.coverMedia),
    customPath: nullableCustomPath(v.customPath),
    seo: { title: nullableText(seo.title), description: nullableText(seo.description), canonicalUrl: nullableText(seo.canonicalUrl), noindex: boolean(seo.noindex) },
    updatedAt: iso(v.updatedAt), publishedAt: v.publishedAt === null ? null : iso(v.publishedAt),
  };
}
export function parseCoursePage(value: unknown): { items: CourseDto[]; nextCursor: string | null } {
  const v = record(value);
  const nextCursor = v.nextCursor === null ? null : required(v.nextCursor);
  return { items: array(v.items, parseCourse, 100), nextCursor };
}
export function parseRedirect(value: unknown): string | null {
  const destination = record(value).destination;
  return destination === null ? null : isContentPath(destination) ? destination : invalid();
}

// ---- Phase 5 public content (instructors / blog / gallery / works / settings) ----

export interface SeoDto { title: string | null; description: string | null; canonicalUrl: string | null; noindex: boolean }
export interface InstructorDto { id: string; slug: string; name: string; bio: string; image: string | null; customPath: string | null; updatedAt: string }
export interface PostDto {
  id: string; slug: string; title: string; excerpt: string; contentHtml: string;
  category: string | null; tagIds: string[]; coverMedia: CoverMediaDto | null;
  customPath: string | null;
  seo: SeoDto; publishedAt: string | null; updatedAt: string;
}
export interface BlogTaxonomyDto { id: string; slug: string; title: string; updatedAt: string }
export interface GalleryMediaDto { storageKey: string; mimeType: string; alt: string }
export interface GalleryItemDto { id: string; title: string; position: number; mediaId: string; media: GalleryMediaDto }
export interface AlbumDto { id: string; slug: string; title: string; description: string; coverMedia: CoverMediaDto | null; seo: SeoDto; updatedAt: string }
export interface AlbumDetailDto extends AlbumDto { items: GalleryItemDto[] }
export interface WorkDto {
  id: string; slug: string; title: string; student: string; category: string;
  mediaId: string | null; media: GalleryMediaDto | null; contentHtml: string; customPath: string | null; seo: SeoDto; updatedAt: string;
}
export interface SettingsContactDto { phone?: string; mobile?: string; address?: string; instagram?: string }
export interface SettingsDto { name: string; description: string; contact: SettingsContactDto; seo: SeoDto; createdAt: string; updatedAt: string }

function parseSeo(value: unknown): SeoDto {
  const seo = record(value);
  return { title: nullableText(seo.title), description: nullableText(seo.description), canonicalUrl: nullableText(seo.canonicalUrl), noindex: boolean(seo.noindex) };
}
function parseCursor(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length < 1 || value.length > 300 || !/^[A-Za-z0-9_-]+$/.test(value)) invalid();
  return value as string;
}
function parseMedia(value: unknown): GalleryMediaDto {
  const v = record(value);
  return { storageKey: required(v.storageKey, 500), mimeType: text(v.mimeType, 100), alt: text(v.alt, 500) };
}
export function parseCoverMedia(value: unknown): CoverMediaDto | null {
  if (value === null || value === undefined) return null;
  const v = record(value);
  if (!isMediaId(v.id)) invalid();
  const url = text(v.url, 500);
  if (!url.startsWith("/api/") || !url.endsWith("/file")) invalid();
  return { id: v.id as string, url, alt: text(v.alt, 500) };
}
export function parseInstructor(value: unknown): InstructorDto {
  const v = record(value);
  return { id: required(v.id, 100), slug: slug(v.slug), name: required(v.name, 200), bio: text(v.bio, 5000), image: v.image === null ? null : text(v.image, 500), customPath: nullableCustomPath(v.customPath), updatedAt: iso(v.updatedAt) };
}
export function parseInstructors(value: unknown): InstructorDto[] {
  const items = array(record(value).items, parseInstructor, 1000);
  if (new Set(items.map((item) => item.slug)).size !== items.length) invalid();
  return items;
}
export function parsePost(value: unknown): PostDto {
  const v = record(value);
  return {
    id: required(v.id, 100), slug: slug(v.slug), title: required(v.title, 200), excerpt: text(v.excerpt, 2000),
    contentHtml: text(v.contentHtml, 500000), category: v.category === null ? null : slug(v.category),
    tagIds: array(v.tagIds, (item) => required(item, 100), 30), coverMedia: parseCoverMedia(v.coverMedia),
    customPath: nullableCustomPath(v.customPath),
    seo: parseSeo(v.seo),
    publishedAt: v.publishedAt === null ? null : iso(v.publishedAt), updatedAt: iso(v.updatedAt),
  };
}
export function parsePostPage(value: unknown): { items: PostDto[]; nextCursor: string | null } {
  const v = record(value);
  return { items: array(v.items, parsePost, 100), nextCursor: parseCursor(v.nextCursor) };
}
function parseTaxonomy(value: unknown): BlogTaxonomyDto {
  const v = record(value);
  return { id: required(v.id, 100), slug: slug(v.slug), title: required(v.title, 200), updatedAt: iso(v.updatedAt) };
}
export function parseCategories(value: unknown): BlogTaxonomyDto[] {
  const items = array(record(value).items, parseTaxonomy, 1000);
  if (new Set(items.map((item) => item.slug)).size !== items.length) invalid();
  return items;
}
export function parseTags(value: unknown): BlogTaxonomyDto[] {
  const items = array(record(value).items, parseTaxonomy, 1000);
  if (new Set(items.map((item) => item.slug)).size !== items.length) invalid();
  return items;
}
export function parseAlbum(value: unknown): AlbumDto {
  const v = record(value);
  return { id: required(v.id, 100), slug: slug(v.slug), title: required(v.title, 200), description: text(v.description, 2000), coverMedia: parseCoverMedia(v.coverMedia), seo: parseSeo(v.seo), updatedAt: iso(v.updatedAt) };
}
export function parseAlbums(value: unknown): AlbumDto[] {
  const items = array(record(value).items, parseAlbum, 1000);
  if (new Set(items.map((item) => item.slug)).size !== items.length) invalid();
  return items;
}
export function parseAlbumDetail(value: unknown): AlbumDetailDto {
  const v = record(value);
  const base = parseAlbum(v);
  const items = array(v.items, (item) => {
    const i = record(item);
    const position = i.position;
    if (typeof position !== "number" || !Number.isInteger(position) || position < 0 || position > 1000000) invalid();
    if (!isMediaId(i.mediaId)) invalid();
    return { id: required(i.id, 100), title: required(i.title, 200), position, mediaId: i.mediaId as string, media: parseMedia(i.media) };
  }, 1000);
  return { ...base, items };
}
export function parseWork(value: unknown): WorkDto {
  const v = record(value);
  return {
    id: required(v.id, 100), slug: slug(v.slug), title: required(v.title, 200), student: text(v.student, 200),
    category: required(v.category, 100),
    mediaId: v.mediaId === null ? null : isMediaId(v.mediaId) ? v.mediaId : invalid(),
    media: v.media === null ? null : parseMedia(v.media),
    contentHtml: text(v.contentHtml, 500000), customPath: nullableCustomPath(v.customPath), seo: parseSeo(v.seo), updatedAt: iso(v.updatedAt),
  };
}
export function parseWorks(value: unknown): WorkDto[] {
  return array(record(value).items, parseWork, 1000);
}
export function parseSettings(value: unknown): SettingsDto {
  const v = record(value);
  const contact = record(v.contact ?? {});
  for (const key of Object.keys(contact)) {
    if (!["phone", "mobile", "address", "instagram"].includes(key)) invalid();
  }
  const pick = (key: string): string | undefined => {
    const item = contact[key];
    if (item === undefined) return undefined;
    return text(item, 500);
  };
  return {
    name: required(v.name, 200), description: text(v.description, 2000),
    contact: { ...(pick("phone") !== undefined ? { phone: pick("phone") } : {}), ...(pick("mobile") !== undefined ? { mobile: pick("mobile") } : {}), ...(pick("address") !== undefined ? { address: pick("address") } : {}), ...(pick("instagram") !== undefined ? { instagram: pick("instagram") } : {}) },
    seo: parseSeo(v.seo), createdAt: iso(v.createdAt), updatedAt: iso(v.updatedAt),
  };
}
export function postPath(post: Pick<PostDto, "slug">): string {
  return `/blog/${post.slug}/`;
}
export function instructorPath(instructor: Pick<InstructorDto, "slug">): string {
  return `/instructors/${instructor.slug}/`;
}
export function albumPath(album: Pick<AlbumDto, "slug">): string {
  return `/gallery/${album.slug}/`;
}
export function workPath(work: Pick<WorkDto, "slug">): string {
  return `/works/${work.slug}/`;
}
export function toCourseCard(course: CourseDto): CourseCardDto {
  const { id, slug, title, latin, department, description, level, duration, iconKey, coverMedia } = course;
  return { id, slug, title, latin, department, description, level, duration, iconKey, coverMedia };
}
export function coursePath(course: Pick<CourseDto, "department" | "slug">): string {
  return `/courses/${course.department}/${course.slug}/`;
}

export function readingMinutes(value: string): number {
  const words = value.split(/\s+/).filter((word) => word.length > 0).length;
  return Math.max(1, Math.ceil(words / 200));
}

export interface ShareLinks { x: string; telegram: string; whatsapp: string; linkedin: string }

export function shareLinks(pageUrl: string, title: string): ShareLinks {
  const url = encodeURIComponent(pageUrl);
  const text = encodeURIComponent(title);
  return {
    x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
  };
}

export function relatedPosts(
  posts: PostDto[],
  current: Pick<PostDto, "id" | "category" | "tagIds">,
  max = 3,
): PostDto[] {
  const others = posts.filter((post) => post.id !== current.id);
  const byCategory = others.filter(
    (post) => current.category !== null && post.category === current.category,
  );
  const picked = new Set(byCategory.map((post) => post.id));
  const byTag = others.filter(
    (post) =>
      !picked.has(post.id) &&
      post.tagIds.some((tag) => current.tagIds.includes(tag)),
  );
  return [...byCategory, ...byTag].slice(0, max);
}

// ---- Public search (GET <BACKEND>/public/search) ----

export const searchKinds = ["course", "post", "instructor"] as const;
export type SearchKind = (typeof searchKinds)[number];
export const searchTypeParams = ["courses", "posts", "instructors"] as const;
export type SearchTypeParam = (typeof searchTypeParams)[number];

export interface SearchItemDto {
  kind: SearchKind;
  title: string;
  latin: string | null;
  excerpt: string | null;
  path: string;
  coverMedia: CoverMediaDto | null;
}

export function parseSearchItem(value: unknown): SearchItemDto {
  const v = record(value);
  if (!searchKinds.includes(v.kind as SearchKind)) invalid();
  const title = required(v.title, 200);
  const latin = v.latin === null ? null : text(v.latin, 200);
  const excerpt = v.excerpt === null ? null : text(v.excerpt, 20000);
  if (typeof v.path !== "string" || !isContentPath(v.path)) invalid();
  return {
    kind: v.kind as SearchKind,
    title,
    latin,
    excerpt,
    path: v.path as string,
    coverMedia: parseCoverMedia(v.coverMedia),
  };
}

export function parseSearchPage(value: unknown): { items: SearchItemDto[] } {
  const v = record(value);
  return { items: array(v.items, parseSearchItem, 20) };
}

/** Trimmed query 1..100, or null when invalid. Never throws. */
export function normalizeSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return null;
  return trimmed;
}

/**
 * Normalize the `types` search-param (string | string[] | undefined from
 * Next searchParams) into a backend-ready comma string.
 * - undefined → undefined (default all, omit param)
 * - valid non-empty subset → canonical comma string (courses,posts,instructors order)
 * - invalid value → null (caller should return [] without fetching)
 * Empty parts (e.g. `?types=`) are treated as default-all (undefined).
 */
export function normalizeSearchTypesParam(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  const inputs: unknown[] = Array.isArray(value) ? value : [value];
  const parts: string[] = [];
  for (const entry of inputs) {
    if (typeof entry !== "string") return null;
    for (const chunk of entry.split(",")) {
      const trimmed = chunk.trim();
      if (trimmed) parts.push(trimmed);
    }
  }
  if (parts.length === 0) return undefined;
  const seen = new Set<string>();
  for (const part of parts) {
    if (!(searchTypeParams as readonly string[]).includes(part)) return null;
    seen.add(part);
  }
  if (seen.size === 0) return undefined;
  return searchTypeParams.filter((kind) => seen.has(kind)).join(",");
}

/** Valid limit 1..20, otherwise undefined (omit → backend default). Never throws. */
export function normalizeSearchLimit(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  if (value < 1 || value > 20) return undefined;
  return value;
}

// ---- Sitemap helpers (pure, no Next runtime) ----

export interface SitemapSourceItem {
  path: string;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

export function toSitemapLastModified(updatedAt?: string | null, publishedAt?: string | null): Date {
  for (const candidate of [updatedAt, publishedAt]) {
    if (typeof candidate === "string") {
      const time = Date.parse(candidate);
      if (Number.isFinite(time)) return new Date(time);
    }
  }
  return new Date();
}

export function buildSitemapEntries(
  origin: string,
  items: SitemapSourceItem[],
): { url: string; lastModified: Date }[] {
  const base = origin.replace(/\/+$/, "");
  const seen = new Set<string>();
  const entries: { url: string; lastModified: Date }[] = [];
  for (const item of items) {
    if (typeof item.path !== "string" || !item.path.startsWith("/")) continue;
    const url = `${base}${item.path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ url, lastModified: toSitemapLastModified(item.updatedAt, item.publishedAt) });
  }
  return entries;
}
