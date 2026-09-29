export const ADMIN_ALLOWED_PATHS = [
  "auth/csrf",
  "auth/login",
  "auth/refresh",
  "auth/logout",
  "auth/me",
  "admin/departments",
  "admin/courses",
  "admin/leads",
  "admin/instructors",
  "admin/categories",
  "admin/tags",
  "admin/posts",
  "admin/gallery-albums",
  "admin/gallery-items",
  "admin/works",
  "admin/media",
  "admin/settings",
  "admin/users",
  "admin/audits",
  "admin/redirects",
  "admin/revalidation",
] as const;

export type AdminAllowedPath = (typeof ADMIN_ALLOWED_PATHS)[number];

export const AUTH_BODY_LIMIT = 8192;
export const ADMIN_MUTATING_BODY_LIMIT = 131072;
// DELETE carries at most an empty JSON object (the backend 415-guard
// requires a JSON content type even for bodyless deletes).
export const ADMIN_DELETE_BODY_LIMIT = 1024;

export const MEDIA_UPLOAD_PATH = "admin/media/upload";
export const MEDIA_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;
export const MEDIA_UPLOAD_HEADROOM_BYTES = 1024 * 1024;
export const MEDIA_UPLOAD_LIMIT = MEDIA_UPLOAD_MAX_BYTES + MEDIA_UPLOAD_HEADROOM_BYTES;
export const MEDIA_UPLOAD_TIMEOUT_MS = 60000;

const ADMIN_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

const ADMIN_ROLES = ["SUPER_ADMIN", "CONTENT_MANAGER", "BLOG_EDITOR"] as const;

export type AdminTokens = {
  accessToken: string;
  csrfToken: string;
  role: string;
};

export type AdminMe = {
  id: string;
  role: string;
};

export type AdminFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

const ADMIN_DETAIL_RESOURCES = [
  "departments",
  "courses",
  "instructors",
  "categories",
  "tags",
  "posts",
  "gallery-albums",
  "gallery-items",
  "works",
  "media",
] as const;

export function isAllowedAdminPath(path: string): boolean {
  if ((ADMIN_ALLOWED_PATHS as readonly string[]).includes(path)) return true;
  if (path === MEDIA_UPLOAD_PATH) return true;
  const segments = path.split("/");
  if (segments.length === 3) {
    if (
      segments[0] === "admin" &&
      (ADMIN_DETAIL_RESOURCES as readonly string[]).includes(segments[1]) &&
      ADMIN_ID_PATTERN.test(segments[2])
    )
      return true;
  }
  if (segments.length === 4) {
    if (
      segments[0] === "admin" &&
      segments[1] === "leads" &&
      ADMIN_ID_PATTERN.test(segments[2]) &&
      segments[3] === "status"
    )
      return true;
    if (
      segments[0] === "admin" &&
      segments[1] === "users" &&
      ADMIN_ID_PATTERN.test(segments[2]) &&
      segments[3] === "access"
    )
      return true;
  }
  return false;
}

const ADMIN_COLLECTION_POST_RESOURCES = [
  "departments",
  "courses",
  "instructors",
  "categories",
  "tags",
  "posts",
  "gallery-albums",
  "gallery-items",
  "works",
  "media",
] as const;

const ADMIN_DETAIL_PUT_RESOURCES = [
  "departments",
  "courses",
  "instructors",
  "categories",
  "tags",
  "posts",
  "gallery-albums",
  "gallery-items",
  "works",
] as const;

export function allowedAdminMethods(path: string): readonly string[] {
  if (path === "auth/csrf" || path === "auth/me") return ["GET"];
  if (
    path === "auth/login" ||
    path === "auth/refresh" ||
    path === "auth/logout"
  )
    return ["POST"];
  if (path === MEDIA_UPLOAD_PATH) return ["POST"];
  const collection = path.split("/");
  if (
    collection.length === 2 &&
    collection[0] === "admin" &&
    (ADMIN_COLLECTION_POST_RESOURCES as readonly string[]).includes(collection[1])
  )
    return ["GET", "POST"];
  if (path === "admin/settings") return ["GET", "PUT"];
  if (
    path === "admin/leads" ||
    path === "admin/users" ||
    path === "admin/audits" ||
    path === "admin/redirects" ||
    path === "admin/revalidation"
  )
    return ["GET"];
  const segments = path.split("/");
  if (
    segments.length === 3 &&
    segments[0] === "admin" &&
    (ADMIN_DETAIL_PUT_RESOURCES as readonly string[]).includes(segments[1]) &&
    ADMIN_ID_PATTERN.test(segments[2])
  )
    return ["GET", "PUT", "DELETE"];
  if (
    segments.length === 3 &&
    segments[0] === "admin" &&
    segments[1] === "media" &&
    ADMIN_ID_PATTERN.test(segments[2])
  )
    return ["GET", "PATCH", "DELETE"];
  if (
    segments.length === 4 &&
    segments[0] === "admin" &&
    segments[1] === "leads" &&
    ADMIN_ID_PATTERN.test(segments[2]) &&
    segments[3] === "status"
  )
    return ["PATCH"];
  if (
    segments.length === 4 &&
    segments[0] === "admin" &&
    segments[1] === "users" &&
    ADMIN_ID_PATTERN.test(segments[2]) &&
    segments[3] === "access"
  )
    return ["PATCH"];
  return [];
}

export function isAllowedAdminMethod(path: string, method: string): boolean {
  return allowedAdminMethods(path).includes(method);
}

export function adminBodyLimit(path: string, method: string): number | null {
  if (!isAllowedAdminMethod(path, method)) return null;
  if (path === MEDIA_UPLOAD_PATH) return null;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    if (path.startsWith("auth/")) return AUTH_BODY_LIMIT;
    return ADMIN_MUTATING_BODY_LIMIT;
  }
  if (method === "DELETE") return ADMIN_DELETE_BODY_LIMIT;
  return null;
}

export function isMediaUpload(path: string, method: string): boolean {
  return path === MEDIA_UPLOAD_PATH && method === "POST";
}

export function isUploadContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(";", 1)[0].trim().toLowerCase() === "multipart/form-data";
}

export function isUploadContentLengthAllowed(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d+$/.test(value)) return false;
  return Number(value) <= MEDIA_UPLOAD_LIMIT;
}

export function isSameOrigin(
  origin: string | null,
  requestUrl: string,
): boolean {
  if (!origin) return false;
  try {
    return origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

export function resolveAdminProxyPath(segments: string[] | undefined): string {
  const joined = (segments ?? []).join("/");
  return segments?.[0] === "auth" ? joined : `admin/${joined}`;
}

export function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export function checkProxyOrigin(
  origin: string | null,
  requestUrl: string,
  method: string,
): boolean {
  if (origin) return isSameOrigin(origin, requestUrl);
  return isSafeMethod(method);
}

export function mapAdminError(status: number): string {
  if (status === 400) return "rejected";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413) return "body_too_large";
  if (status === 415) return "unsupported_media_type";
  if (status === 429) return "rate_limited";
  if (status === 503) return "unavailable";
  return "upstream";
}

export function parseCsrf(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const token = (value as Record<string, unknown>).csrfToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function parseLogin(value: unknown): AdminTokens | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.accessToken !== "string" || input.accessToken.length === 0)
    return null;
  if (typeof input.csrfToken !== "string" || input.csrfToken.length === 0)
    return null;
  if (
    typeof input.role !== "string" ||
    !(ADMIN_ROLES as readonly string[]).includes(input.role)
  )
    return null;
  return {
    accessToken: input.accessToken,
    csrfToken: input.csrfToken,
    role: input.role,
  };
}

export function parseMe(value: unknown): AdminMe | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || input.id.length === 0) return null;
  if (
    typeof input.role !== "string" ||
    !(ADMIN_ROLES as readonly string[]).includes(input.role)
  )
    return null;
  return { id: input.id, role: input.role };
}

let memoryTokens: AdminTokens | null = null;

export function setAdminTokens(tokens: AdminTokens | null): void {
  memoryTokens = tokens;
}

export function getAdminTokens(): AdminTokens | null {
  return memoryTokens;
}

export function clearAdminTokens(): void {
  memoryTokens = null;
}

export async function loginFlow(
  fetcher: AdminFetch,
  email: string,
  password: string,
): Promise<AdminTokens> {
  const csrfRes = await fetcher("/api/admin/auth/csrf", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!csrfRes.ok) throw new Error(mapAdminError(csrfRes.status));
  let csrfBody: unknown;
  try {
    csrfBody = await csrfRes.json();
  } catch {
    throw new Error("invalid_response");
  }
  const csrfToken = parseCsrf(csrfBody);
  if (!csrfToken) throw new Error("invalid_response");
  const loginRes = await fetcher("/api/admin/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ email, password }),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!loginRes.ok) throw new Error(mapAdminError(loginRes.status));
  let loginBody: unknown;
  try {
    loginBody = await loginRes.json();
  } catch {
    throw new Error("invalid_response");
  }
  const tokens = parseLogin(loginBody);
  if (!tokens) throw new Error("invalid_response");
  setAdminTokens(tokens);
  return tokens;
}
