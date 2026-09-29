import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_DELETE_BODY_LIMIT,
  ADMIN_MUTATING_BODY_LIMIT,
  AUTH_BODY_LIMIT,
  adminBodyLimit,
  allowedAdminMethods,
  checkProxyOrigin,
  clearAdminTokens,
  getAdminTokens,
  isAllowedAdminMethod,
  isAllowedAdminPath,
  isMediaUpload,
  isSafeMethod,
  isSameOrigin,
  isUploadContentLengthAllowed,
  isUploadContentType,
  loginFlow,
  mapAdminError,
  MEDIA_UPLOAD_LIMIT,
  MEDIA_UPLOAD_MAX_BYTES,
  MEDIA_UPLOAD_PATH,
  MEDIA_UPLOAD_TIMEOUT_MS,
  parseLogin,
  parseMe,
  resolveAdminProxyPath,
  setAdminTokens,
} from "./admin-auth";

test("origin check accepts only the exact request origin", () => {
  assert.equal(
    isSameOrigin("https://frontend.example", "https://frontend.example/api/admin/auth/csrf"),
    true,
  );
  for (const origin of [
    null,
    "",
    "null",
    "https://other.example",
    "https://frontend.example/",
    "https://frontend.example:443",
    "http://frontend.example",
  ])
    assert.equal(
      isSameOrigin(origin, "https://frontend.example/api/admin/auth/csrf"),
      false,
    );
  assert.equal(isSameOrigin("https://frontend.example", "not a url"), false);
});

test("proxy origin allows missing origin only for safe methods", () => {
  const url = "https://frontend.example/api/admin/auth/csrf";
  assert.equal(isSafeMethod("GET"), true);
  assert.equal(isSafeMethod("HEAD"), true);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    assert.equal(isSafeMethod(method), false);
  assert.equal(checkProxyOrigin(null, url, "GET"), true);
  assert.equal(checkProxyOrigin("", url, "GET"), true);
  assert.equal(checkProxyOrigin(null, url, "HEAD"), true);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"])
    assert.equal(checkProxyOrigin(null, url, method), false);
  assert.equal(
    checkProxyOrigin("https://frontend.example", url, "POST"),
    true,
  );
  assert.equal(
    checkProxyOrigin("https://other.example", url, "GET"),
    false,
  );
  assert.equal(checkProxyOrigin("https://frontend.example", "not a url", "GET"), false);
});

test("proxy path resolution matches the allowlist contract", () => {
  assert.equal(resolveAdminProxyPath(["auth", "csrf"]), "auth/csrf");
  assert.equal(resolveAdminProxyPath(["auth", "login"]), "auth/login");
  assert.equal(resolveAdminProxyPath(["courses"]), "admin/courses");
  assert.equal(resolveAdminProxyPath(["courses", "course-1"]), "admin/courses/course-1");
  assert.equal(
    resolveAdminProxyPath(["leads", "550e8400-e29b-41d4-a716-446655440000", "status"]),
    "admin/leads/550e8400-e29b-41d4-a716-446655440000/status",
  );
  assert.equal(resolveAdminProxyPath(undefined), "admin/");
  assert.equal(resolveAdminProxyPath([]), "admin/");
  for (const segments of [
    ["auth", "csrf"],
    ["courses"],
    ["courses", "course-1"],
    ["leads", "lead_1", "status"],
    ["users", "user-1", "access"],
  ])
    assert.equal(isAllowedAdminPath(resolveAdminProxyPath(segments)), true);
  for (const segments of [undefined, [], ["admin", "courses"], ["evil"]])
    assert.equal(isAllowedAdminPath(resolveAdminProxyPath(segments)), false);
});

test("allowlist accepts only the five backend auth paths", () => {
  for (const path of [
    "auth/csrf",
    "auth/login",
    "auth/refresh",
    "auth/logout",
    "auth/me",
  ])
    assert.equal(isAllowedAdminPath(path), true);
  for (const path of [
    "",
    "auth",
    "auth/csrf/extra",
    "auth/../auth/csrf",
    "Auth/Csrf",
    " auth/csrf",
    "public/leads",
    "admin/unknown",
  ])
    assert.equal(isAllowedAdminPath(path), false);
});

test("allowlist accepts admin departments courses and leads patterns", () => {
  for (const path of [
    "admin/departments",
    "admin/departments/dep-1",
    "admin/departments/ABC_123-xyz",
    "admin/courses",
    "admin/courses/course-1",
    "admin/courses/A1_b-2",
    "admin/leads",
    "admin/leads/550e8400-e29b-41d4-a716-446655440000/status",
    "admin/leads/lead_1/status",
  ])
    assert.equal(isAllowedAdminPath(path), true);
  for (const path of [
    "admin",
    "admin/departments/",
    "admin/departments/a/b",
    "admin/departments/../other",
    "admin/courses/",
    "admin/courses/a/b",
    "admin/leads/abc",
    "admin/leads/abc/status/extra",
    "admin/leads//status",
    "admin/leads/a/status ",
    "Admin/departments",
    "admin/Departments/dep-1",
    "admin/unknown",
    "admin/leads/abc/Status",
    "public/leads",
  ])
    assert.equal(isAllowedAdminPath(path), false);
});

test("allowlist accepts admin instructors categories tags posts patterns", () => {
  for (const path of [
    "admin/instructors",
    "admin/instructors/ins-1",
    "admin/instructors/ABC_123-xyz",
    "admin/categories",
    "admin/categories/cat-1",
    "admin/tags",
    "admin/tags/tag-1",
    "admin/posts",
    "admin/posts/post-1",
    "admin/posts/A1_b-2",
  ])
    assert.equal(isAllowedAdminPath(path), true);
  for (const path of [
    "admin/instructors/",
    "admin/instructors/a/b",
    "admin/instructors/../other",
    "admin/categories/",
    "admin/categories/a/b",
    "admin/tags/",
    "admin/tags/a/b",
    "admin/posts/",
    "admin/posts/a/b",
    "Admin/instructors",
    "admin/Instructors/ins-1",
    "admin/Categories/cat-1",
    "admin/Posts/post-1",
    "admin/instructors/a/status",
    "admin/posts/abc/extra",
  ])
    assert.equal(isAllowedAdminPath(path), false);
});

test("method rules allow only the specified verbs", () => {
  assert.deepEqual([...allowedAdminMethods("auth/csrf")], ["GET"]);
  assert.deepEqual([...allowedAdminMethods("auth/me")], ["GET"]);
  assert.deepEqual([...allowedAdminMethods("auth/login")], ["POST"]);
  assert.deepEqual([...allowedAdminMethods("auth/refresh")], ["POST"]);
  assert.deepEqual([...allowedAdminMethods("auth/logout")], ["POST"]);
  assert.deepEqual([...allowedAdminMethods("admin/departments")], ["GET", "POST"]);
  assert.deepEqual([...allowedAdminMethods("admin/courses")], ["GET", "POST"]);
  assert.deepEqual([...allowedAdminMethods("admin/leads")], ["GET"]);
  assert.deepEqual([...allowedAdminMethods("admin/departments/dep-1")], [
    "GET",
    "PUT",
    "DELETE",
  ]);
  assert.deepEqual([...allowedAdminMethods("admin/courses/crs-1")], [
    "GET",
    "PUT",
    "DELETE",
  ]);
  assert.deepEqual([...allowedAdminMethods("admin/leads/lead-1/status")], ["PATCH"]);
  assert.equal(isAllowedAdminMethod("admin/departments", "GET"), true);
  assert.equal(isAllowedAdminMethod("admin/departments", "POST"), true);
  assert.equal(isAllowedAdminMethod("admin/departments", "PUT"), false);
  assert.equal(isAllowedAdminMethod("admin/departments", "DELETE"), false);
  assert.equal(isAllowedAdminMethod("admin/departments", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/departments/dep-1", "GET"), true);
  assert.equal(isAllowedAdminMethod("admin/departments/dep-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/departments/dep-1", "DELETE"), true);
  assert.equal(isAllowedAdminMethod("admin/departments/dep-1", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/departments/dep-1", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/courses/crs-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/courses/crs-1", "DELETE"), true);
  assert.equal(isAllowedAdminMethod("admin/courses/crs-1", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/leads", "GET"), true);
  assert.equal(isAllowedAdminMethod("admin/leads", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/leads/lead-1/status", "PATCH"), true);
  assert.equal(isAllowedAdminMethod("admin/leads/lead-1/status", "GET"), false);
  assert.equal(isAllowedAdminMethod("admin/leads/lead-1/status", "PUT"), false);
  assert.equal(isAllowedAdminMethod("auth/csrf", "POST"), false);
  assert.equal(isAllowedAdminMethod("auth/login", "GET"), false);
  assert.equal(isAllowedAdminMethod("admin/users", "GET"), true);
  assert.equal(isAllowedAdminMethod("admin/users", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/audits", "GET"), true);
  assert.equal(isAllowedAdminMethod("", "GET"), false);
});

test("method rules allow PUT-only detail verbs for instructors and blog resources", () => {
  for (const base of [
    "admin/instructors",
    "admin/categories",
    "admin/tags",
    "admin/posts",
  ])
    assert.deepEqual([...allowedAdminMethods(base)], ["GET", "POST"]);
  for (const detail of [
    "admin/instructors/ins-1",
    "admin/categories/cat-1",
    "admin/tags/tag-1",
    "admin/posts/post-1",
  ])
    assert.deepEqual([...allowedAdminMethods(detail)], ["GET", "PUT", "DELETE"]);
  assert.equal(isAllowedAdminMethod("admin/instructors", "PUT"), false);
  assert.equal(isAllowedAdminMethod("admin/instructors", "DELETE"), false);
  assert.equal(isAllowedAdminMethod("admin/categories", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/tags", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/posts", "PUT"), false);
  assert.equal(isAllowedAdminMethod("admin/posts", "DELETE"), false);
  assert.equal(isAllowedAdminMethod("admin/posts", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/instructors/ins-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/instructors/ins-1", "DELETE"), true);
  assert.equal(isAllowedAdminMethod("admin/instructors/ins-1", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/instructors/ins-1", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/categories/cat-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/categories/cat-1", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/tags/tag-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/tags/tag-1", "DELETE"), true);
  assert.equal(isAllowedAdminMethod("admin/tags/tag-1", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/posts/post-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/posts/post-1", "DELETE"), true);
  assert.equal(isAllowedAdminMethod("admin/posts/post-1", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/posts/post-1", "POST"), false);
});

test("body caps keep auth 8KB and allow 128KB for mutating admin JSON", () => {
  assert.equal(AUTH_BODY_LIMIT, 8192);
  assert.equal(ADMIN_MUTATING_BODY_LIMIT, 131072);
  assert.equal(adminBodyLimit("auth/login", "POST"), 8192);
  assert.equal(adminBodyLimit("auth/refresh", "POST"), 8192);
  assert.equal(adminBodyLimit("auth/logout", "POST"), 8192);
  assert.equal(adminBodyLimit("auth/csrf", "GET"), null);
  assert.equal(adminBodyLimit("auth/me", "GET"), null);
  assert.equal(adminBodyLimit("admin/departments", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/courses", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/departments/dep-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/courses/crs-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/instructors", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/categories", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/tags", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/posts", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/instructors/ins-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/categories/cat-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/tags/tag-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/posts/post-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/leads/lead-1/status", "PATCH"), 131072);
  assert.equal(adminBodyLimit("admin/departments", "GET"), null);
  assert.equal(adminBodyLimit("admin/instructors", "GET"), null);
  assert.equal(adminBodyLimit("admin/posts", "GET"), null);
  assert.equal(adminBodyLimit("admin/posts/post-1", "GET"), null);
  assert.equal(adminBodyLimit("admin/posts/post-1", "PATCH"), null);
  assert.equal(adminBodyLimit("admin/instructors/ins-1", "PATCH"), null);
  assert.equal(adminBodyLimit("admin/departments/dep-1", "GET"), null);
  assert.equal(ADMIN_DELETE_BODY_LIMIT, 1024);
  assert.equal(adminBodyLimit("admin/departments/dep-1", "DELETE"), 1024);
  assert.equal(adminBodyLimit("admin/courses/crs-1", "DELETE"), 1024);
  assert.equal(adminBodyLimit("admin/media/media-1", "DELETE"), 1024);
  assert.equal(adminBodyLimit("admin/leads", "GET"), null);
  assert.equal(adminBodyLimit("admin/departments", "PUT"), null);
  assert.equal(adminBodyLimit("admin/leads/lead-1/status", "GET"), null);
  assert.equal(adminBodyLimit("auth/login", "GET"), null);
});

test("token store keeps memory-only state until cleared", () => {
  clearAdminTokens();
  assert.equal(getAdminTokens(), null);
  const tokens = {
    accessToken: "access",
    csrfToken: "csrf",
    role: "CONTENT_MANAGER",
  };
  setAdminTokens(tokens);
  assert.deepEqual(getAdminTokens(), tokens);
  clearAdminTokens();
  assert.equal(getAdminTokens(), null);
});

test("error mapping stays generic and covers auth statuses", () => {
  assert.equal(mapAdminError(400), "rejected");
  assert.equal(mapAdminError(401), "unauthorized");
  assert.equal(mapAdminError(403), "forbidden");
  assert.equal(mapAdminError(404), "not_found");
  assert.equal(mapAdminError(409), "conflict");
  assert.equal(mapAdminError(413), "body_too_large");
  assert.equal(mapAdminError(415), "unsupported_media_type");
  assert.equal(mapAdminError(429), "rate_limited");
  assert.equal(mapAdminError(503), "unavailable");
  assert.equal(mapAdminError(500), "upstream");
  assert.equal(mapAdminError(200), "upstream");
});

test("login and me parsers accept only well-formed payloads", () => {
  const login = {
    accessToken: "access",
    csrfToken: "csrf",
    role: "BLOG_EDITOR",
  };
  assert.deepEqual(parseLogin(login), login);
  assert.deepEqual(parseMe({ id: "user-1", role: "SUPER_ADMIN" }), {
    id: "user-1",
    role: "SUPER_ADMIN",
  });
  for (const value of [
    null,
    [],
    {},
    { ...login, role: "UNKNOWN" },
    { ...login, accessToken: "" },
    { id: "", role: "SUPER_ADMIN" },
    { id: "user-1", role: "UNKNOWN" },
  ])
    assert.equal(parseLogin(value) !== null && parseMe(value) !== null, false);
});

test("allowlist accepts admin gallery works media settings and directory patterns", () => {
  for (const path of [
    "admin/gallery-albums",
    "admin/gallery-albums/album-1",
    "admin/gallery-albums/ABC_123-xyz",
    "admin/gallery-items",
    "admin/gallery-items/item-1",
    "admin/gallery-items/A1_b-2",
    "admin/works",
    "admin/works/work-1",
    "admin/media",
    "admin/media/media-1",
    "admin/settings",
    "admin/users",
    "admin/users/user-1/access",
    "admin/users/ABC_123-xyz/access",
    "admin/audits",
    "admin/redirects",
    "admin/revalidation",
  ])
    assert.equal(isAllowedAdminPath(path), true);
  for (const path of [
    "admin/gallery-albums/",
    "admin/gallery-albums/a/b",
    "admin/gallery-items/",
    "admin/gallery-items/a/b",
    "admin/works/",
    "admin/works/a/b",
    "admin/media/",
    "admin/media/a/b",
    "admin/settings/extra",
    "admin/settings/1",
    "admin/users/user-1",
    "admin/users/user-1/other",
    "admin/users//access",
    "admin/users/a/access/extra",
    "admin/audits/",
    "admin/audits/a/b",
    "admin/redirects/x",
    "admin/revalidation/y",
    "Admin/gallery-albums",
    "admin/Gallery-Items/item-1",
    "admin/Works/work-1",
    "admin/Media/media-1",
    "admin/Settings",
    "admin/Users",
  ])
    assert.equal(isAllowedAdminPath(path), false);
});

test("method rules cover gallery works media settings users audits redirects revalidation", () => {
  for (const base of [
    "admin/gallery-albums",
    "admin/gallery-items",
    "admin/works",
    "admin/media",
  ])
    assert.deepEqual([...allowedAdminMethods(base)], ["GET", "POST"]);
  assert.deepEqual([...allowedAdminMethods("admin/settings")], ["GET", "PUT"]);
  for (const base of [
    "admin/users",
    "admin/audits",
    "admin/redirects",
    "admin/revalidation",
  ])
    assert.deepEqual([...allowedAdminMethods(base)], ["GET"]);
  for (const detail of [
    "admin/gallery-albums/album-1",
    "admin/gallery-items/item-1",
    "admin/works/work-1",
  ])
    assert.deepEqual([...allowedAdminMethods(detail)], ["GET", "PUT", "DELETE"]);
  assert.deepEqual([...allowedAdminMethods("admin/media/media-1")], [
    "GET",
    "PATCH",
    "DELETE",
  ]);
  assert.deepEqual([...allowedAdminMethods("admin/users/user-1/access")], ["PATCH"]);
  assert.equal(isAllowedAdminMethod("admin/gallery-albums", "POST"), true);
  assert.equal(isAllowedAdminMethod("admin/gallery-items", "POST"), true);
  assert.equal(isAllowedAdminMethod("admin/works", "POST"), true);
  assert.equal(isAllowedAdminMethod("admin/media", "POST"), true);
  assert.equal(isAllowedAdminMethod("admin/settings", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/settings", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/settings", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/settings", "DELETE"), false);
  assert.equal(isAllowedAdminMethod("admin/users", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/audits", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/redirects", "DELETE"), false);
  assert.equal(isAllowedAdminMethod("admin/revalidation", "PUT"), false);
  assert.equal(isAllowedAdminMethod("admin/gallery-albums/album-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/gallery-albums/album-1", "DELETE"), true);
  assert.equal(isAllowedAdminMethod("admin/gallery-albums/album-1", "PATCH"), false);
  assert.equal(isAllowedAdminMethod("admin/gallery-items/item-1", "PUT"), true);
  assert.equal(isAllowedAdminMethod("admin/works/work-1", "DELETE"), true);
  assert.equal(isAllowedAdminMethod("admin/media/media-1", "PATCH"), true);
  assert.equal(isAllowedAdminMethod("admin/media/media-1", "PUT"), false);
  assert.equal(isAllowedAdminMethod("admin/media/media-1", "POST"), false);
  assert.equal(isAllowedAdminMethod("admin/users/user-1/access", "PATCH"), true);
  assert.equal(isAllowedAdminMethod("admin/users/user-1/access", "GET"), false);
  assert.equal(isAllowedAdminMethod("admin/users/user-1/access", "PUT"), false);
});

test("body caps cover gallery works media settings and access mutations", () => {
  assert.equal(adminBodyLimit("admin/gallery-albums", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/gallery-items", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/works", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/media", "POST"), 131072);
  assert.equal(adminBodyLimit("admin/gallery-albums/album-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/gallery-items/item-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/works/work-1", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/settings", "PUT"), 131072);
  assert.equal(adminBodyLimit("admin/media/media-1", "PATCH"), 131072);
  assert.equal(adminBodyLimit("admin/users/user-1/access", "PATCH"), 131072);
  assert.equal(adminBodyLimit("admin/gallery-albums", "GET"), null);
  assert.equal(adminBodyLimit("admin/works", "GET"), null);
  assert.equal(adminBodyLimit("admin/media", "GET"), null);
  assert.equal(adminBodyLimit("admin/settings", "GET"), null);
  assert.equal(adminBodyLimit("admin/users", "GET"), null);
  assert.equal(adminBodyLimit("admin/audits", "GET"), null);
  assert.equal(adminBodyLimit("admin/redirects", "GET"), null);
  assert.equal(adminBodyLimit("admin/revalidation", "GET"), null);
  assert.equal(adminBodyLimit("admin/media/media-1", "GET"), null);
  assert.equal(adminBodyLimit("admin/media/media-1", "PUT"), null);
  assert.equal(adminBodyLimit("admin/gallery-albums/album-1", "PATCH"), null);
  assert.equal(adminBodyLimit("admin/users/user-1/access", "GET"), null);
  assert.equal(adminBodyLimit("admin/settings", "POST"), null);
  assert.equal(adminBodyLimit("admin/settings", "DELETE"), null);
});

test("upload allowlist exposes only POST admin/media/upload outside JSON caps", () => {
  assert.equal(MEDIA_UPLOAD_PATH, "admin/media/upload");
  assert.equal(MEDIA_UPLOAD_MAX_BYTES, 12 * 1024 * 1024);
  assert.equal(MEDIA_UPLOAD_LIMIT, 13 * 1024 * 1024);
  assert.equal(MEDIA_UPLOAD_TIMEOUT_MS, 60000);
  assert.equal(isAllowedAdminPath(MEDIA_UPLOAD_PATH), true);
  assert.equal(isAllowedAdminPath("admin/media/upload/extra"), false);
  assert.deepEqual([...allowedAdminMethods(MEDIA_UPLOAD_PATH)], ["POST"]);
  assert.equal(isAllowedAdminMethod(MEDIA_UPLOAD_PATH, "POST"), true);
  for (const method of ["GET", "PUT", "PATCH", "DELETE"])
    assert.equal(isAllowedAdminMethod(MEDIA_UPLOAD_PATH, method), false);
  assert.equal(isMediaUpload(MEDIA_UPLOAD_PATH, "POST"), true);
  assert.equal(isMediaUpload(MEDIA_UPLOAD_PATH, "GET"), false);
  assert.equal(isMediaUpload("admin/media", "POST"), false);
  assert.equal(adminBodyLimit(MEDIA_UPLOAD_PATH, "POST"), null);
});

test("upload guards accept only multipart bodies within the 13MB headroom", () => {
  assert.equal(isUploadContentType("multipart/form-data"), true);
  assert.equal(isUploadContentType("multipart/form-data; boundary=----abc"), true);
  assert.equal(isUploadContentType("Multipart/Form-Data; boundary=x"), true);
  for (const value of [null, "", "application/json", "multipart/mixed", "text/plain"]) {
    assert.equal(isUploadContentType(value), false);
  }
  assert.equal(isUploadContentLengthAllowed(null), true);
  assert.equal(isUploadContentLengthAllowed("0"), true);
  assert.equal(isUploadContentLengthAllowed(String(MEDIA_UPLOAD_LIMIT)), true);
  assert.equal(isUploadContentLengthAllowed(String(MEDIA_UPLOAD_LIMIT + 1)), false);
  assert.equal(isUploadContentLengthAllowed(String(Number.MAX_SAFE_INTEGER)), false);
  for (const value of ["", " ", "-1", "1.5", "abc", "12MB", "0x10"]) {
    assert.equal(isUploadContentLengthAllowed(value), false);
  }
});

test("login flow fetches csrf then posts credentials and stores tokens", async () => {
  clearAdminTokens();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === "/api/admin/auth/csrf")
      return Response.json({ csrfToken: "csrf-1" });
    assert.equal(url, "/api/admin/auth/login");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      email: "admin@example.test",
      password: "secret",
    });
    assert.equal(
      new Headers(init?.headers).get("x-csrf-token"),
      "csrf-1",
    );
    return Response.json({
      accessToken: "access-1",
      csrfToken: "csrf-2",
      role: "CONTENT_MANAGER",
    });
  }) as typeof fetch;
  const tokens = await loginFlow(
    fetcher,
    "admin@example.test",
    "secret",
  );
  assert.equal(tokens.accessToken, "access-1");
  assert.deepEqual(getAdminTokens(), tokens);
  assert.equal(calls.length, 2);
  clearAdminTokens();
});
