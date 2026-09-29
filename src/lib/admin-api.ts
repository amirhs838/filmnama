import {
  getAdminTokens,
  mapAdminError,
  MEDIA_UPLOAD_MAX_BYTES,
  type AdminFetch,
  type AdminTokens,
} from "./admin-auth";

export type AdminStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AdminSeo = {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
};

export type DepartmentInput = {
  slug: string;
  label: string;
  latin: string;
  description: string;
  status: AdminStatus;
  seo?: AdminSeo;
};

export type Department = {
  id: string;
  slug: string;
  label: string;
  latin: string;
  description: string;
  status: AdminStatus;
  seo: AdminSeo;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CourseIconKey =
  | "Drama"
  | "Camera"
  | "Clapperboard"
  | "Palette"
  | "Scissors"
  | "Aperture"
  | "Sparkles"
  | "Music"
  | "Code2"
  | "BrainCircuit"
  | "Server"
  | "Languages";

export type CourseFaq = {
  question: string;
  answer: string;
};

export type CoverMedia = {
  id: string;
  url: string;
  alt: string;
};

export type CourseInput = {
  slug: string;
  departmentId: string;
  title: string;
  latin: string;
  description: string;
  level: string;
  duration: string;
  iconKey: CourseIconKey;
  contentHtml: string;
  syllabus: string[];
  faq: CourseFaq[];
  instructorIds: string[];
  coverMediaId: string | null;
  seo: AdminSeo;
  status: AdminStatus;
  customPath: string | null;
};

export type Course = CourseInput & {
  id: string;
  coverMedia: CoverMedia | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LeadStatus = "NEW" | "CONTACTED" | "CLOSED";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  courseId: string | null;
  status: LeadStatus;
  consentAt: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadPage = {
  items: Lead[];
  nextCursor: string | null;
};

export type LeadFilters = {
  status?: LeadStatus;
  courseId?: string;
  limit?: number;
  cursor?: string;
};

export type InstructorInput = {
  slug: string;
  name: string;
  bio: string;
  image: string | null;
  status: AdminStatus;
  seo: AdminSeo;
  customPath: string | null;
};

export type Instructor = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  image: string | null;
  status: AdminStatus;
  customPath: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CategoryInput = {
  slug: string;
  title: string;
};

export type Category = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type TagInput = {
  slug: string;
  title: string;
};

export type Tag = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PostInput = {
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  categoryId: string | null;
  tagIds: string[];
  coverMediaId: string | null;
  seo: AdminSeo;
  status: AdminStatus;
  customPath: string | null;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  categoryId: string | null;
  authorId: string;
  tagIds: string[];
  coverMediaId: string | null;
  coverMedia: CoverMedia | null;
  status: AdminStatus;
  seo: AdminSeo;
  customPath: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PostFilters = {
  category?: string;
  tag?: string;
  limit?: number;
  cursor?: string;
};

export type PostPage = {
  items: Post[];
  nextCursor: string | null;
};

export type AlbumInput = {
  slug: string;
  title: string;
  description: string;
  status: AdminStatus;
  coverMediaId: string | null;
  seo: AdminSeo;
};

export type Album = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: AdminStatus;
  coverMediaId: string | null;
  coverMedia: CoverMedia | null;
  seo: AdminSeo;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AlbumItemInput = {
  albumId: string;
  mediaId: string;
  title: string;
  caption: string;
  position: number;
  status: AdminStatus;
};

export type AlbumItem = {
  id: string;
  albumId: string;
  mediaId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AlbumItemFilters = {
  albumId?: string;
};

export type WorkInput = {
  slug: string;
  title: string;
  student: string;
  category: string;
  mediaId: string | null;
  contentHtml: string;
  seo: AdminSeo;
  status: AdminStatus;
  customPath: string | null;
};

export type Work = {
  id: string;
  slug: string;
  title: string;
  student: string;
  category: string;
  mediaId: string | null;
  contentHtml: string;
  status: AdminStatus;
  seo: AdminSeo;
  customPath: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
] as const;

export type MediaMime = (typeof MEDIA_MIME_TYPES)[number];

export type MediaInput = {
  storageKey: string;
  mimeType: MediaMime;
  size: number;
  alt: string;
};

export type Media = {
  id: string;
  storageKey: string;
  mimeType: string;
  size: number;
  alt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type MediaFilters = {
  mime?: string;
  limit?: number;
  cursor?: string;
};

export type MediaPage = {
  items: Media[];
  nextCursor: string | null;
};

export type SettingsContact = {
  phone?: string;
  mobile?: string;
  address?: string;
  instagram?: string;
};

export type SettingsInput = {
  name: string;
  description: string;
  contact: SettingsContact;
  seo: AdminSeo;
};

export type SiteSettings = {
  name: string;
  description: string;
  contact: SettingsContact;
  seo: AdminSeo;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserRole = "SUPER_ADMIN" | "CONTENT_MANAGER" | "BLOG_EDITOR";

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

export type UserFilters = {
  active?: boolean;
  role?: AdminUserRole;
  limit?: number;
  cursor?: string;
};

export type UserPage = {
  items: AdminUser[];
  nextCursor: string | null;
};

export type UserAccessInput = {
  role: AdminUserRole;
  active: boolean;
};

export type Audit = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
};

export type AuditFilters = {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  limit?: number;
  cursor?: string;
};

export type AuditPage = {
  items: Audit[];
  nextCursor: string | null;
};

export type Redirect = {
  id: string;
  source: string;
  destination: string | null;
  locale: string;
  createdAt: string;
  updatedAt: string;
};

export type RedirectFilters = {
  limit?: number;
  cursor?: string;
};

export type RedirectPage = {
  items: Redirect[];
  nextCursor: string | null;
};

export type RevalidationItem = {
  id: string;
  paths: string[];
  version: number;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RevalidationFilters = {
  pending?: boolean;
  limit?: number;
  cursor?: string;
};

export type RevalidationPage = {
  items: RevalidationItem[];
  nextCursor: string | null;
};

export type DepartmentFormState = {
  slug: string;
  label: string;
  latin: string;
  description: string;
  status: AdminStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoindex?: boolean;
};

export type CourseFormState = {
  slug: string;
  departmentId: string;
  title: string;
  latin: string;
  description: string;
  level: string;
  duration: string;
  iconKey: CourseIconKey;
  contentHtml: string;
  customPath?: string | null;
  syllabusText: string;
  faq: CourseFaq[];
  instructorIdsText: string;
  coverMediaId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoindex?: boolean;
  status: AdminStatus;
};

export type InstructorFormState = {
  slug: string;
  name: string;
  bio: string;
  image?: string | null;
  customPath?: string | null;
  status: AdminStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoindex?: boolean;
};

export type CategoryFormState = {
  slug: string;
  title: string;
};

export type TagFormState = {
  slug: string;
  title: string;
};

export type PostFormState = {
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  categoryId?: string | null;
  tagIdsText: string;
  coverMediaId?: string | null;
  customPath?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoindex?: boolean;
  status: AdminStatus;
};

export type AlbumFormState = {
  slug: string;
  title: string;
  description: string;
  status: AdminStatus;
  coverMediaId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoindex?: boolean;
};

export type AlbumItemFormState = {
  albumId: string;
  mediaId: string;
  title: string;
  caption?: string;
  position: string;
  status: AdminStatus;
};

export type WorkFormState = {
  slug: string;
  title: string;
  student?: string;
  category: string;
  mediaId?: string | null;
  contentHtml: string;
  customPath?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoindex?: boolean;
  status: AdminStatus;
};

export type MediaFormState = {
  storageKey: string;
  mimeType: string;
  size: string;
  alt: string;
};

export type SettingsFormState = {
  name: string;
  description: string;
  contactPhone?: string;
  contactMobile?: string;
  contactAddress?: string;
  contactInstagram?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  seoNoindex?: boolean;
};

export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseIds(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const id = part.trim();
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeSeoText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Light client-side normalization for editor-defined custom paths
 * (stored without leading slash). The backend validates strictly and
 * rejects reserved prefixes with a 409 conflict.
 */
export function normalizeCustomPath(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.trim().replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
  return cleaned.length > 0 ? cleaned : null;
}

export function buildDepartmentPayload(
  form: DepartmentFormState,
): DepartmentInput {
  return {
    slug: form.slug.trim(),
    label: form.label.trim(),
    latin: form.latin.trim(),
    description: form.description.trim(),
    status: form.status,
    seo: {
      title: normalizeSeoText(form.seoTitle),
      description: normalizeSeoText(form.seoDescription),
      canonicalUrl: normalizeSeoText(form.seoCanonicalUrl),
      noindex: form.seoNoindex ?? false,
    },
  };
}

export function buildCoursePayload(form: CourseFormState): CourseInput {
  const faq: CourseFaq[] = [];
  for (const entry of form.faq) {
    const question = entry.question.trim();
    if (question.length === 0) continue;
    faq.push({ question, answer: entry.answer.trim() });
  }
  const coverMediaId = (form.coverMediaId ?? "").trim();
  return {
    slug: form.slug.trim(),
    departmentId: form.departmentId.trim(),
    title: form.title.trim(),
    latin: form.latin.trim(),
    description: form.description.trim(),
    level: form.level.trim(),
    duration: form.duration.trim(),
    iconKey: form.iconKey,
    contentHtml: form.contentHtml,
    syllabus: splitLines(form.syllabusText),
    faq,
    instructorIds: parseIds(form.instructorIdsText),
    coverMediaId: coverMediaId.length > 0 ? coverMediaId : null,
    seo: {
      title: normalizeSeoText(form.seoTitle),
      description: normalizeSeoText(form.seoDescription),
      canonicalUrl: normalizeSeoText(form.seoCanonicalUrl),
      noindex: form.seoNoindex ?? false,
    },
    status: form.status,
    customPath: normalizeCustomPath(form.customPath),
  };
}

export function buildInstructorPayload(
  form: InstructorFormState,
): InstructorInput {
  const image = (form.image ?? "").trim();
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    bio: form.bio.trim(),
    image: image.length > 0 ? image : null,
    status: form.status,
    customPath: normalizeCustomPath(form.customPath),
    seo: {
      title: normalizeSeoText(form.seoTitle),
      description: normalizeSeoText(form.seoDescription),
      canonicalUrl: normalizeSeoText(form.seoCanonicalUrl),
      noindex: form.seoNoindex ?? false,
    },
  };
}

export function buildCategoryPayload(form: CategoryFormState): CategoryInput {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
  };
}

export function buildTagPayload(form: TagFormState): TagInput {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
  };
}

export function buildPostPayload(form: PostFormState): PostInput {
  const categoryId = (form.categoryId ?? "").trim();
  const coverMediaId = (form.coverMediaId ?? "").trim();
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    excerpt: form.excerpt.trim(),
    contentHtml: form.contentHtml,
    categoryId: categoryId.length > 0 ? categoryId : null,
    tagIds: parseIds(form.tagIdsText),
    coverMediaId: coverMediaId.length > 0 ? coverMediaId : null,
    seo: {
      title: normalizeSeoText(form.seoTitle),
      description: normalizeSeoText(form.seoDescription),
      canonicalUrl: normalizeSeoText(form.seoCanonicalUrl),
      noindex: form.seoNoindex ?? false,
    },
    status: form.status,
    customPath: normalizeCustomPath(form.customPath),
  };
}

function authHeaders(
  tokens: AdminTokens | null,
  method: string,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (tokens && tokens.accessToken.length > 0)
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  if (
    tokens &&
    tokens.csrfToken.length > 0 &&
    (method === "POST" ||
      method === "PUT" ||
      method === "PATCH" ||
      method === "DELETE")
  )
    headers["X-CSRF-Token"] = tokens.csrfToken;
  return headers;
}

function resolveTokens(passed?: AdminTokens | null): AdminTokens | null {
  if (passed !== undefined) return passed;
  return getAdminTokens();
}

async function readJsonOrThrow(res: Response): Promise<unknown> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("invalid_response");
  }
  if (!res.ok) throw new Error(mapAdminError(res.status));
  return data;
}

async function getJson(
  fetcher: AdminFetch,
  path: string,
  tokens?: AdminTokens | null,
): Promise<unknown> {
  const resolved = resolveTokens(tokens);
  const res = await fetcher(path, {
    method: "GET",
    headers: authHeaders(resolved, "GET"),
    credentials: "same-origin",
    cache: "no-store",
  });
  return readJsonOrThrow(res);
}

async function sendJson(
  fetcher: AdminFetch,
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  payload: unknown,
  tokens?: AdminTokens | null,
): Promise<unknown> {
  const resolved = resolveTokens(tokens);
  const headers = authHeaders(resolved, method);
  const init: RequestInit = {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  };
  // Backend rejects mutating requests without an explicit JSON content type.
  // Undici/browsers may drop Content-Type on bodyless requests, so DELETE
  // carries an empty JSON object to keep the header (and the 415 guard) happy.
  headers["Content-Type"] = "application/json";
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    init.body = JSON.stringify(payload);
  } else {
    init.body = "{}";
  }
  const res = await fetcher(path, init);
  return readJsonOrThrow(res);
}

export async function listDepartments(
  fetcher: AdminFetch,
  tokens?: AdminTokens | null,
): Promise<{ items: Department[] }> {
  const data = (await getJson(
    fetcher,
    "/api/admin/departments",
    tokens,
  )) as { items: Department[] };
  return { items: data.items ?? [] };
}

export async function getDepartment(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Department> {
  return (await getJson(
    fetcher,
    `/api/admin/departments/${encodeURIComponent(id)}`,
    tokens,
  )) as Department;
}

export async function saveDepartment(
  fetcher: AdminFetch,
  input: DepartmentInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Department> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/departments/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Department;
  return (await sendJson(
    fetcher,
    "/api/admin/departments",
    "POST",
    payload,
    tokens,
  )) as Department;
}

export async function removeDepartment(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Department> {
  return (await sendJson(
    fetcher,
    `/api/admin/departments/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Department;
}

export async function listCourses(
  fetcher: AdminFetch,
  departmentId?: string,
  tokens?: AdminTokens | null,
): Promise<{ items: Course[] }> {
  const data = (await getJson(
    fetcher,
    "/api/admin/courses",
    tokens,
  )) as { items: Course[] };
  const items = data.items ?? [];
  if (departmentId === undefined || departmentId.length === 0)
    return { items };
  return { items: items.filter((course) => course.departmentId === departmentId) };
}

export async function getCourse(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Course> {
  return (await getJson(
    fetcher,
    `/api/admin/courses/${encodeURIComponent(id)}`,
    tokens,
  )) as Course;
}

export async function saveCourse(
  fetcher: AdminFetch,
  input: CourseInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Course> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/courses/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Course;
  return (await sendJson(
    fetcher,
    "/api/admin/courses",
    "POST",
    payload,
    tokens,
  )) as Course;
}

export async function removeCourse(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Course> {
  return (await sendJson(
    fetcher,
    `/api/admin/courses/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Course;
}

export async function listInstructors(
  fetcher: AdminFetch,
  tokens?: AdminTokens | null,
): Promise<{ items: Instructor[] }> {
  const data = (await getJson(
    fetcher,
    "/api/admin/instructors",
    tokens,
  )) as { items: Instructor[] };
  return { items: data.items ?? [] };
}

export async function getInstructor(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Instructor> {
  return (await getJson(
    fetcher,
    `/api/admin/instructors/${encodeURIComponent(id)}`,
    tokens,
  )) as Instructor;
}

export async function saveInstructor(
  fetcher: AdminFetch,
  input: InstructorInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Instructor> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/instructors/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Instructor;
  return (await sendJson(
    fetcher,
    "/api/admin/instructors",
    "POST",
    payload,
    tokens,
  )) as Instructor;
}

export async function removeInstructor(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Instructor> {
  return (await sendJson(
    fetcher,
    `/api/admin/instructors/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Instructor;
}

export async function listCategories(
  fetcher: AdminFetch,
  tokens?: AdminTokens | null,
): Promise<{ items: Category[] }> {
  const data = (await getJson(
    fetcher,
    "/api/admin/categories",
    tokens,
  )) as { items: Category[] };
  return { items: data.items ?? [] };
}

export async function getCategory(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Category> {
  return (await getJson(
    fetcher,
    `/api/admin/categories/${encodeURIComponent(id)}`,
    tokens,
  )) as Category;
}

export async function saveCategory(
  fetcher: AdminFetch,
  input: CategoryInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Category> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/categories/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Category;
  return (await sendJson(
    fetcher,
    "/api/admin/categories",
    "POST",
    payload,
    tokens,
  )) as Category;
}

export async function removeCategory(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Category> {
  return (await sendJson(
    fetcher,
    `/api/admin/categories/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Category;
}

export async function listTags(
  fetcher: AdminFetch,
  tokens?: AdminTokens | null,
): Promise<{ items: Tag[] }> {
  const data = (await getJson(
    fetcher,
    "/api/admin/tags",
    tokens,
  )) as { items: Tag[] };
  return { items: data.items ?? [] };
}

export async function getTag(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Tag> {
  return (await getJson(
    fetcher,
    `/api/admin/tags/${encodeURIComponent(id)}`,
    tokens,
  )) as Tag;
}

export async function saveTag(
  fetcher: AdminFetch,
  input: TagInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Tag> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/tags/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Tag;
  return (await sendJson(
    fetcher,
    "/api/admin/tags",
    "POST",
    payload,
    tokens,
  )) as Tag;
}

export async function removeTag(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Tag> {
  return (await sendJson(
    fetcher,
    `/api/admin/tags/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Tag;
}

export async function listPosts(
  fetcher: AdminFetch,
  filters: PostFilters = {},
  tokens?: AdminTokens | null,
): Promise<PostPage> {
  const params = new URLSearchParams();
  if (filters.category !== undefined && filters.category.length > 0)
    params.set("category", filters.category);
  if (filters.tag !== undefined && filters.tag.length > 0)
    params.set("tag", filters.tag);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor !== undefined && filters.cursor.length > 0)
    params.set("cursor", filters.cursor);
  const query = params.toString();
  const path = query.length > 0 ? `/api/admin/posts?${query}` : "/api/admin/posts";
  const data = (await getJson(fetcher, path, tokens)) as PostPage;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export async function getPost(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Post> {
  return (await getJson(
    fetcher,
    `/api/admin/posts/${encodeURIComponent(id)}`,
    tokens,
  )) as Post;
}

export async function savePost(
  fetcher: AdminFetch,
  input: PostInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Post> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/posts/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Post;
  return (await sendJson(
    fetcher,
    "/api/admin/posts",
    "POST",
    payload,
    tokens,
  )) as Post;
}

export async function removePost(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Post> {
  return (await sendJson(
    fetcher,
    `/api/admin/posts/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Post;
}

export async function listLeads(
  fetcher: AdminFetch,
  filters: LeadFilters = {},
  tokens?: AdminTokens | null,
): Promise<LeadPage> {
  const params = new URLSearchParams();
  if (filters.status !== undefined) params.set("status", filters.status);
  if (filters.courseId !== undefined && filters.courseId.length > 0)
    params.set("courseId", filters.courseId);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor !== undefined && filters.cursor.length > 0)
    params.set("cursor", filters.cursor);
  const query = params.toString();
  const path = query.length > 0 ? `/api/admin/leads?${query}` : "/api/admin/leads";
  const data = (await getJson(fetcher, path, tokens)) as LeadPage;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export async function setLeadStatus(
  fetcher: AdminFetch,
  id: string,
  status: LeadStatus,
  tokens?: AdminTokens | null,
): Promise<{ id: string; status: LeadStatus }> {
  return (await sendJson(
    fetcher,
    `/api/admin/leads/${encodeURIComponent(id)}/status`,
    "PATCH",
    { status },
    tokens,
  )) as { id: string; status: LeadStatus };
}

export function buildAlbumPayload(form: AlbumFormState): AlbumInput {
  const coverMediaId = (form.coverMediaId ?? "").trim();
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    coverMediaId: coverMediaId.length > 0 ? coverMediaId : null,
    seo: {
      title: normalizeSeoText(form.seoTitle),
      description: normalizeSeoText(form.seoDescription),
      canonicalUrl: normalizeSeoText(form.seoCanonicalUrl),
      noindex: form.seoNoindex ?? false,
    },
  };
}

export function buildAlbumItemPayload(form: AlbumItemFormState): AlbumItemInput {
  const position = Number.parseInt(form.position.trim(), 10);
  return {
    albumId: form.albumId.trim(),
    mediaId: form.mediaId.trim(),
    title: form.title.trim(),
    caption: (form.caption ?? "").trim(),
    position: Number.isFinite(position) ? position : 0,
    status: form.status,
  };
}

export function buildWorkPayload(form: WorkFormState): WorkInput {
  const mediaId = (form.mediaId ?? "").trim();
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    student: (form.student ?? "").trim(),
    category: form.category.trim(),
    mediaId: mediaId.length > 0 ? mediaId : null,
    contentHtml: form.contentHtml,
    seo: {
      title: normalizeSeoText(form.seoTitle),
      description: normalizeSeoText(form.seoDescription),
      canonicalUrl: normalizeSeoText(form.seoCanonicalUrl),
      noindex: form.seoNoindex ?? false,
    },
    status: form.status,
    customPath: normalizeCustomPath(form.customPath),
  };
}

export function buildMediaPayload(form: MediaFormState): MediaInput {
  const size = Number.parseInt(form.size.trim(), 10);
  return {
    storageKey: form.storageKey.trim(),
    mimeType: form.mimeType.trim() as MediaMime,
    size: Number.isFinite(size) ? size : 0,
    alt: form.alt.trim(),
  };
}

export function buildSettingsPayload(form: SettingsFormState): SettingsInput {
  const contact: SettingsContact = {};
  const phone = (form.contactPhone ?? "").trim();
  const mobile = (form.contactMobile ?? "").trim();
  const address = (form.contactAddress ?? "").trim();
  const instagram = (form.contactInstagram ?? "").trim();
  if (phone.length > 0) contact.phone = phone;
  if (mobile.length > 0) contact.mobile = mobile;
  if (address.length > 0) contact.address = address;
  if (instagram.length > 0) contact.instagram = instagram;
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    contact,
    seo: {
      title: normalizeSeoText(form.seoTitle),
      description: normalizeSeoText(form.seoDescription),
      canonicalUrl: normalizeSeoText(form.seoCanonicalUrl),
      noindex: form.seoNoindex ?? false,
    },
  };
}

export async function listAlbums(
  fetcher: AdminFetch,
  tokens?: AdminTokens | null,
): Promise<{ items: Album[] }> {
  const data = (await getJson(
    fetcher,
    "/api/admin/gallery-albums",
    tokens,
  )) as { items: Album[] };
  return { items: data.items ?? [] };
}

export async function getAlbum(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Album> {
  return (await getJson(
    fetcher,
    `/api/admin/gallery-albums/${encodeURIComponent(id)}`,
    tokens,
  )) as Album;
}

export async function saveAlbum(
  fetcher: AdminFetch,
  input: AlbumInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Album> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/gallery-albums/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Album;
  return (await sendJson(
    fetcher,
    "/api/admin/gallery-albums",
    "POST",
    payload,
    tokens,
  )) as Album;
}

export async function removeAlbum(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Album> {
  return (await sendJson(
    fetcher,
    `/api/admin/gallery-albums/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Album;
}

export async function listAlbumItems(
  fetcher: AdminFetch,
  filters: AlbumItemFilters = {},
  tokens?: AdminTokens | null,
): Promise<{ items: AlbumItem[] }> {
  const params = new URLSearchParams();
  if (filters.albumId !== undefined && filters.albumId.length > 0)
    params.set("albumId", filters.albumId);
  const query = params.toString();
  const path =
    query.length > 0 ? `/api/admin/gallery-items?${query}` : "/api/admin/gallery-items";
  const data = (await getJson(fetcher, path, tokens)) as { items: AlbumItem[] };
  return { items: data.items ?? [] };
}

export async function getAlbumItem(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<AlbumItem> {
  return (await getJson(
    fetcher,
    `/api/admin/gallery-items/${encodeURIComponent(id)}`,
    tokens,
  )) as AlbumItem;
}

export async function saveAlbumItem(
  fetcher: AdminFetch,
  input: AlbumItemInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<AlbumItem> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/gallery-items/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as AlbumItem;
  return (await sendJson(
    fetcher,
    "/api/admin/gallery-items",
    "POST",
    payload,
    tokens,
  )) as AlbumItem;
}

export async function removeAlbumItem(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<AlbumItem> {
  return (await sendJson(
    fetcher,
    `/api/admin/gallery-items/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as AlbumItem;
}

export async function listWorks(
  fetcher: AdminFetch,
  tokens?: AdminTokens | null,
): Promise<{ items: Work[] }> {
  const data = (await getJson(fetcher, "/api/admin/works", tokens)) as {
    items: Work[];
  };
  return { items: data.items ?? [] };
}

export async function getWork(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Work> {
  return (await getJson(
    fetcher,
    `/api/admin/works/${encodeURIComponent(id)}`,
    tokens,
  )) as Work;
}

export async function saveWork(
  fetcher: AdminFetch,
  input: WorkInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Work> {
  const { id, ...payload } = input;
  if (id !== undefined && id.length > 0)
    return (await sendJson(
      fetcher,
      `/api/admin/works/${encodeURIComponent(id)}`,
      "PUT",
      payload,
      tokens,
    )) as Work;
  return (await sendJson(
    fetcher,
    "/api/admin/works",
    "POST",
    payload,
    tokens,
  )) as Work;
}

export async function removeWork(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Work> {
  return (await sendJson(
    fetcher,
    `/api/admin/works/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Work;
}

export async function listMedia(
  fetcher: AdminFetch,
  filters: MediaFilters = {},
  tokens?: AdminTokens | null,
): Promise<MediaPage> {
  const params = new URLSearchParams();
  if (filters.mime !== undefined && filters.mime.length > 0)
    params.set("mime", filters.mime);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor !== undefined && filters.cursor.length > 0)
    params.set("cursor", filters.cursor);
  const query = params.toString();
  const path = query.length > 0 ? `/api/admin/media?${query}` : "/api/admin/media";
  const data = (await getJson(fetcher, path, tokens)) as MediaPage;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export async function getMedia(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Media> {
  return (await getJson(
    fetcher,
    `/api/admin/media/${encodeURIComponent(id)}`,
    tokens,
  )) as Media;
}

export async function createMedia(
  fetcher: AdminFetch,
  input: MediaInput,
  tokens?: AdminTokens | null,
): Promise<Media> {
  return (await sendJson(
    fetcher,
    "/api/admin/media",
    "POST",
    input,
    tokens,
  )) as Media;
}

export async function patchMediaAlt(
  fetcher: AdminFetch,
  id: string,
  alt: string,
  tokens?: AdminTokens | null,
): Promise<Media> {
  return (await sendJson(
    fetcher,
    `/api/admin/media/${encodeURIComponent(id)}`,
    "PATCH",
    { alt },
    tokens,
  )) as Media;
}

export async function removeMedia(
  fetcher: AdminFetch,
  id: string,
  tokens?: AdminTokens | null,
): Promise<Media> {
  return (await sendJson(
    fetcher,
    `/api/admin/media/${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    tokens,
  )) as Media;
}

export type UploadFileError = "empty" | "unsupported_type" | "too_large";

export function uploadFileError(file: {
  size: number;
  type: string;
}): UploadFileError | null {
  if (file.size <= 0) return "empty";
  if (!(MEDIA_MIME_TYPES as readonly string[]).includes(file.type))
    return "unsupported_type";
  if (file.size > MEDIA_UPLOAD_MAX_BYTES) return "too_large";
  return null;
}

export async function uploadMedia(
  fetcher: AdminFetch,
  file: File | Blob,
  alt: string,
  tokens?: AdminTokens | null,
): Promise<Media> {
  const resolved = resolveTokens(tokens);
  const headers = authHeaders(resolved, "POST");
  const body = new FormData();
  body.append("file", file);
  body.append("alt", alt);
  // Trailing slash is required: a 308 redirect re-serializes FormData with a
  // new boundary while the old Content-Type is kept, so multer sees no file.
  const res = await fetcher("/api/admin/media/upload/", {
    method: "POST",
    headers,
    body,
    credentials: "same-origin",
    cache: "no-store",
  });
  return (await readJsonOrThrow(res)) as Media;
}

export async function getSettings(
  fetcher: AdminFetch,
  tokens?: AdminTokens | null,
): Promise<SiteSettings> {
  return (await getJson(fetcher, "/api/admin/settings", tokens)) as SiteSettings;
}

export async function saveSettings(
  fetcher: AdminFetch,
  input: SettingsInput,
  tokens?: AdminTokens | null,
): Promise<SiteSettings> {
  return (await sendJson(
    fetcher,
    "/api/admin/settings",
    "PUT",
    input,
    tokens,
  )) as SiteSettings;
}

export async function listUsers(
  fetcher: AdminFetch,
  filters: UserFilters = {},
  tokens?: AdminTokens | null,
): Promise<UserPage> {
  const params = new URLSearchParams();
  if (filters.role !== undefined) params.set("role", filters.role);
  if (filters.active !== undefined)
    params.set("active", filters.active ? "true" : "false");
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor !== undefined && filters.cursor.length > 0)
    params.set("cursor", filters.cursor);
  const query = params.toString();
  const path = query.length > 0 ? `/api/admin/users?${query}` : "/api/admin/users";
  const data = (await getJson(fetcher, path, tokens)) as UserPage;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export async function setUserAccess(
  fetcher: AdminFetch,
  id: string,
  input: UserAccessInput,
  tokens?: AdminTokens | null,
): Promise<{ id: string; role: string; active: boolean }> {
  return (await sendJson(
    fetcher,
    `/api/admin/users/${encodeURIComponent(id)}/access`,
    "PATCH",
    input,
    tokens,
  )) as { id: string; role: string; active: boolean };
}

export async function listAudits(
  fetcher: AdminFetch,
  filters: AuditFilters = {},
  tokens?: AdminTokens | null,
): Promise<AuditPage> {
  const params = new URLSearchParams();
  if (filters.entityType !== undefined && filters.entityType.length > 0)
    params.set("entityType", filters.entityType);
  if (filters.entityId !== undefined && filters.entityId.length > 0)
    params.set("entityId", filters.entityId);
  if (filters.actorId !== undefined && filters.actorId.length > 0)
    params.set("actorId", filters.actorId);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor !== undefined && filters.cursor.length > 0)
    params.set("cursor", filters.cursor);
  const query = params.toString();
  const path =
    query.length > 0 ? `/api/admin/audits?${query}` : "/api/admin/audits";
  const data = (await getJson(fetcher, path, tokens)) as AuditPage;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export async function listRedirects(
  fetcher: AdminFetch,
  filters: RedirectFilters = {},
  tokens?: AdminTokens | null,
): Promise<RedirectPage> {
  const params = new URLSearchParams();
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor !== undefined && filters.cursor.length > 0)
    params.set("cursor", filters.cursor);
  const query = params.toString();
  const path =
    query.length > 0 ? `/api/admin/redirects?${query}` : "/api/admin/redirects";
  const data = (await getJson(fetcher, path, tokens)) as RedirectPage;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export async function listRevalidation(
  fetcher: AdminFetch,
  filters: RevalidationFilters = {},
  tokens?: AdminTokens | null,
): Promise<RevalidationPage> {
  const params = new URLSearchParams();
  if (filters.pending !== undefined)
    params.set("pending", filters.pending ? "true" : "false");
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor !== undefined && filters.cursor.length > 0)
    params.set("cursor", filters.cursor);
  const query = params.toString();
  const path =
    query.length > 0
      ? `/api/admin/revalidation?${query}`
      : "/api/admin/revalidation";
  const data = (await getJson(fetcher, path, tokens)) as RevalidationPage;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export function windowFetch(): AdminFetch {
  return fetch.bind(window);
}

export async function listDepartmentsViaWindow(
  tokens?: AdminTokens | null,
): Promise<{ items: Department[] }> {
  return listDepartments(windowFetch(), tokens);
}

export async function getDepartmentViaWindow(
  id: string,
  tokens?: AdminTokens | null,
): Promise<Department> {
  return getDepartment(windowFetch(), id, tokens);
}

export async function saveDepartmentViaWindow(
  input: DepartmentInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Department> {
  return saveDepartment(windowFetch(), input, tokens);
}

export async function removeDepartmentViaWindow(
  id: string,
  tokens?: AdminTokens | null,
): Promise<Department> {
  return removeDepartment(windowFetch(), id, tokens);
}

export async function listCoursesViaWindow(
  departmentId?: string,
  tokens?: AdminTokens | null,
): Promise<{ items: Course[] }> {
  return listCourses(windowFetch(), departmentId, tokens);
}

export async function getCourseViaWindow(
  id: string,
  tokens?: AdminTokens | null,
): Promise<Course> {
  return getCourse(windowFetch(), id, tokens);
}

export async function saveCourseViaWindow(
  input: CourseInput & { id?: string },
  tokens?: AdminTokens | null,
): Promise<Course> {
  return saveCourse(windowFetch(), input, tokens);
}

export async function removeCourseViaWindow(
  id: string,
  tokens?: AdminTokens | null,
): Promise<Course> {
  return removeCourse(windowFetch(), id, tokens);
}

export async function listLeadsViaWindow(
  filters: LeadFilters = {},
  tokens?: AdminTokens | null,
): Promise<LeadPage> {
  return listLeads(windowFetch(), filters, tokens);
}

export async function setLeadStatusViaWindow(
  id: string,
  status: LeadStatus,
  tokens?: AdminTokens | null,
): Promise<{ id: string; status: LeadStatus }> {
  return setLeadStatus(windowFetch(), id, status, tokens);
}
