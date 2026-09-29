import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { sanitizeCourseHtml } from "./course-html";
import { isContentPath, isCustomUrlPath, isMediaId, isSlug, mediaSrc, parseAlbum, parseAlbumDetail, parseAlbums, parseCategories, parseCoverMedia, parseInstructor, parseInstructors, parsePost, parsePostPage, parseSettings, parseTags, parseWork, parseWorks, parseCourse, parseCoursePage, parseDepartment, parseRedirect, readingMinutes, relatedPosts, shareLinks, toCourseCard, postPath, instructorPath, albumPath, workPath, parseSearchItem, parseSearchPage, normalizeSearchQuery, normalizeSearchTypesParam, normalizeSearchLimit, buildSitemapEntries, toSitemapLastModified } from "./content-contract";
import { normalizeCustomPath } from "./admin-api";
import { aboutPageJsonLd, breadcrumbJsonLd, courseJsonLd, faqJsonLd, organizationJsonLd, serializeJsonLd } from "./structured-data";
import { parseRevalidatePaths, readRevalidateBody, verifyRevalidateSignature } from "./revalidation";
import { createConsultationSubmission, isConsultationAccepted, normalizeMobile, preselectConsultationCourse, validateConsultation, validRetryAfter } from "./consultation";
import { proxyConsultation } from "./consultation-proxy";

const course = {
  id: "acting", slug: "acting", title: "بازیگری", latin: "ACTING", department: "cinema", description: "توضیحات", level: "مقدماتی", duration: "۴۸ جلسه", iconKey: "Drama",
  contentHtml: "", syllabus: ["تمرین"], faq: [{ question: "پرسش", answer: "پاسخ" }], instructors: [],
  seo: { title: null, description: null, canonicalUrl: null, noindex: false }, updatedAt: "2026-09-17T00:00:00.000Z", publishedAt: null,
};

test("course contract preserves slugs and serializable cards", () => {
  const parsed = parseCourse(course);
  assert.equal(parsed.slug, "acting");
  assert.equal(parsed.coverMedia, null);
  assert.equal(toCourseCard(parsed).iconKey, "Drama");
  assert.equal(toCourseCard(parsed).coverMedia, null);
  assert.equal("contentHtml" in toCourseCard(parsed), false);
  assert.deepEqual(JSON.parse(JSON.stringify(toCourseCard(parsed))), toCourseCard(parsed));
  assert.equal(parseCourse({ ...course, department: "new-department" }).department, "new-department");
});

test("contract rejects malformed fields, icons, pagination and nested data", () => {
  for (const patch of [{ iconKey: "Unknown" }, { slug: "../acting" }, { updatedAt: "yesterday" }, { seo: {} }, { faq: [{ question: "q" }] }, { instructors: [{}] }, { syllabus: [1] }, { publishedAt: 123 }]) assert.throws(() => parseCourse({ ...course, ...patch }));
  assert.throws(() => parseCoursePage({ items: [course] }));
  assert.throws(() => parseCoursePage({ items: [], nextCursor: "" }));
  assert.equal(parseCoursePage({ items: [course], nextCursor: null }).items.length, 1);
  assert.throws(() => parseDepartment({ slug: "cinema" }));
});

test("paths and redirect destinations are restricted to public course routes", () => {
  for (const path of ["/", "/courses", "/courses/", "/courses/cinema", "/courses/cinema/", "/courses/tech/ai", "/courses/tech/ai/"]) assert.equal(isContentPath(path), true);
  for (const path of ["//example.com", "/courses/../admin", "/courses/a/b/c", "/courses/a?x=1", "/courses/%2e%2e", "/api/revalidate", "/courses/a\\b", "/courses//"]) {
    assert.equal(isContentPath(path), false);
    assert.throws(() => parseRedirect({ destination: path }));
  }
  assert.equal(parseRedirect({ destination: null }), null);
});

test("JSON-LD is script safe and contains only supplied visible course fields", () => {
  const json = serializeJsonLd({ text: "</script><script>" });
  assert.equal(json.includes("<"), false);
  assert.equal(JSON.parse(json).text, "</script><script>");
  const data = courseJsonLd(parseCourse(course), "https://example.com/courses/cinema/acting");
  assert.equal("offers" in data, false);
  assert.equal("aggregateRating" in data, false);
  assert.equal("hasCourseInstance" in data, false);
  assert.equal(faqJsonLd([]), null);
  assert.equal(faqJsonLd(course.faq)?.mainEntity[0].acceptedAnswer.text, "پاسخ");
  assert.equal(breadcrumbJsonLd([{ name: "خانه", path: "/" }], "https://example.com").itemListElement[0].position, 1);
});

test("course HTML preserves editorial markup and safe links", () => {
  const html = '<h2>معرفی دوره</h2><p>متن <strong>مهم</strong> و <em>تأکید</em></p><h3>پیش‌نیازها</h3><ul><li>تمرین</li></ul><ol><li>پروژه</li></ol><blockquote>یادگیری</blockquote><a href="/#contact" title="مشاوره">ثبت‌نام</a>';
  assert.equal(sanitizeCourseHtml(html), html);
  assert.equal(sanitizeCourseHtml(""), "");
  assert.equal(sanitizeCourseHtml('<a href="https://example.com/course">دوره</a>'), '<a href="https://example.com/course">دوره</a>');
});

test("course HTML removes executable content, embeds and styling attributes", () => {
  const html = '<script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.com"></iframe><object data="file"></object><img src="x" onerror="alert(1)"><svg onload="alert(1)"></svg><form><input name="x"></form><p id="contact" class="hidden" style="display:none" onclick="alert(1)">متن امن</p>';
  assert.equal(sanitizeCourseHtml(html), "<p>متن امن</p>");
  assert.equal(sanitizeCourseHtml('<p>شروع<strong>متن'), "<p>شروع<strong>متن</strong></p>");
});

test("course HTML rejects unsafe link schemes and unsolicited browsing contexts", () => {
  for (const href of ["javascript:alert(1)", "jav&#x61;script:alert(1)", "java&#10;script:alert(1)", "data:text/html,unsafe", "vbscript:msgbox(1)", "//example.com"]) {
    assert.equal(sanitizeCourseHtml(`<a href="${href}" target="_blank" onclick="alert(1)">پیوند</a>`), "<a>پیوند</a>");
  }
});

test("shared authored content covers all courses and remains intact after sanitization", () => {
  const content = JSON.parse(readFileSync("backend/prisma/course-content.json", "utf8")) as Record<string, { contentHtml: string; syllabus: string[]; faq: { question: string; answer: string }[]; seoTitle: string; seoDescription: string }>;
  const slugs = ["acting", "cinematography", "directing", "makeup", "editing", "filmmaking", "vfx", "music", "programming", "ai", "it", "language"];
  assert.deepEqual(Object.keys(content).sort(), slugs.sort());
  for (const [slug, authored] of Object.entries(content)) {
    const parsed = parseCourse({ ...course, slug, contentHtml: authored.contentHtml, syllabus: authored.syllabus, faq: authored.faq, seo: { ...course.seo, title: authored.seoTitle, description: authored.seoDescription } });
    assert.ok(parsed.contentHtml.trim(), slug);
    assert.equal(sanitizeCourseHtml(parsed.contentHtml), parsed.contentHtml, slug);
    assert.ok(parsed.syllabus.length > 0, slug);
    assert.ok(parsed.faq.length > 0, slug);
    assert.ok(authored.seoTitle.trim(), slug);
    assert.ok(authored.seoDescription.trim(), slug);
    assert.deepEqual(faqJsonLd(parsed.faq)?.mainEntity.map((item) => ({ question: item.name, answer: item.acceptedAnswer.text })), parsed.faq);
  }
});

const secret = "a".repeat(32);
const timestamp = "1800000000";
const rawBody = '{"paths":["/","/courses/cinema/acting"]}';
const sign = (body = rawBody) => createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

test("HMAC verifies exact raw body and rejects malformed, expired or modified signatures", () => {
  assert.equal(verifyRevalidateSignature(rawBody, timestamp, sign(), secret, Number(timestamp)), true);
  assert.equal(verifyRevalidateSignature(`${rawBody} `, timestamp, sign(), secret, Number(timestamp)), false);
  for (const signature of [null, "ff", "g".repeat(64), "0".repeat(64)]) assert.equal(verifyRevalidateSignature(rawBody, timestamp, signature, secret, Number(timestamp)), false);
  assert.equal(verifyRevalidateSignature(rawBody, timestamp, sign(), secret, Number(timestamp) + 301), false);
  assert.equal(verifyRevalidateSignature(rawBody, timestamp, sign(), secret, Number(timestamp) - 301), false);
  assert.equal(verifyRevalidateSignature(rawBody, timestamp, sign(), "short", Number(timestamp)), false);
});

test("webhook paths and streaming body enforce caps", async () => {
  assert.deepEqual(parseRevalidatePaths(rawBody), ["/", "/courses/cinema/acting"]);
  for (const value of [{ paths: [] }, { paths: Array(101).fill("/") }, { paths: ["/admin"] }, { paths: ["/"], tags: ["arbitrary"] }]) assert.throws(() => parseRevalidatePaths(JSON.stringify(value)));
  assert.throws(() => parseRevalidatePaths(" ".repeat(16385)));
  await assert.rejects(readRevalidateBody(new Request("http://localhost", { method: "POST", body: "a".repeat(16385) })));
  assert.equal(await readRevalidateBody(new Request("http://localhost", { method: "POST", body: rawBody })), rawBody);
});

const lead = { submissionId: "550e8400-e29b-41d4-a716-446655440000", name: "نام آزمایشی", phone: "09123456789", consent: true };
const leadConfig = { contentSource: () => "api", backendUrl: () => new URL("https://backend.example/api/v1/") };
function leadRequest(body: unknown = lead, headers: Record<string, string> = {}) {
  return new Request("https://frontend.example/api/consultation", { method: "POST", headers: { Origin: "https://frontend.example", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

function validatedLead(value: unknown) {
  const result = validateConsultation(value);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected valid consultation");
  return result.payload;
}

test("consultation normalizes Persian/Arabic mobile digits and omits trimmed blank optionals", () => {
  for (const phone of ["۰۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩", "+۹۸۹۱۲۳۴۵۶۷۸۹", "00989123456789", " 09123456789 "]) {
    assert.equal(normalizeMobile(phone), lead.phone);
    assert.deepEqual(validatedLead({ ...lead, name: ` ${lead.name} `, phone, email: " ", message: "\n", courseId: " " }), lead);
  }
  assert.equal(validatedLead({ ...lead, email: " user@example.com ", courseId: " actual-id ", message: " متن " }).courseId, "actual-id");
  assert.equal(validatedLead({ ...lead, name: "ab", message: "a".repeat(2000), courseId: "a".repeat(100), email: `${"a".repeat(242)}@example.com` }).email?.length, 254);
  assert.equal(validatedLead({ ...lead, name: "a".repeat(100) }).name.length, 100);
});

test("consultation rejects unknown fields, invalid types, missing consent and limits", () => {
  for (const value of [null, [], "text", { ...lead, extra: true }, { ...lead, submissionId: "not-uuid" }, { ...lead, name: " a " }, { ...lead, name: "a".repeat(101) }, { ...lead, phone: 9123456789 }, { ...lead, phone: "0912345678" }, { ...lead, phone: "091234567890" }, { ...lead, phone: "02123456789" }, { ...lead, consent: false }, { ...lead, consent: "true" }, { ...lead, email: null }, { ...lead, email: "invalid" }, { ...lead, email: "a".repeat(255) }, { ...lead, message: "a".repeat(2001) }, { ...lead, courseId: "a".repeat(101) }]) assert.equal(validateConsultation(value).ok, false);
});

test("submission retries preserve exact payload and UUID; only edits create a new identity", () => {
  let count = 0;
  const state = createConsultationSubmission(() => `550e8400-e29b-41d4-a716-${String(++count).padStart(12, "0")}`);
  const input = { name: lead.name, phone: "+۹۸۹۱۲۳۴۵۶۷۸۹", consent: true, email: " " };
  const first = state.prepare(input);
  assert.deepEqual(state.prepare({ ...input }), first);
  assert.equal(count, 1);
  state.edit();
  const next = state.prepare(input);
  assert.notDeepEqual(next, first);
  assert.equal(count, 2);
  assert.deepEqual(state.prepare(input), next);
  assert.notDeepEqual(state.prepare({ ...input, name: "نام تازه" }), next);
  assert.equal(count, 3);
});

test("mount preselection uses only actual supplied course IDs and falls back to general", () => {
  const select = { value: "" };
  const options = [{ id: "db-id/123", title: "دوره" }];
  preselectConsultationCourse(select, "?course=db-id%2F123", options);
  assert.equal(select.value, "db-id/123");
  for (const search of ["", "?course=acting", "?course=%3Cscript%3E"]) {
    preselectConsultationCourse(select, search, options);
    assert.equal(select.value, "");
  }
  preselectConsultationCourse(select, "?course=db-id%2F123", []);
  assert.equal(select.value, "");
});

test("proxy denies missing/cross/nonexact origins and non-API configuration before upstream", async () => {
  let calls = 0;
  const config = { ...leadConfig, fetch: (async () => { calls++; return Response.json({ accepted: true }, { status: 201 }); }) as typeof fetch };
  for (const origin of ["", "null", "https://other.example", "https://frontend.example/", "https://frontend.example:443"]) assert.equal((await proxyConsultation(leadRequest(lead, { Origin: origin }), config)).status, 403);
  const absent = leadRequest();
  absent.headers.delete("origin");
  assert.equal((await proxyConsultation(absent, config)).status, 403);
  for (const source of ["mock", "", "invalid"]) assert.equal((await proxyConsultation(leadRequest(), { ...config, contentSource: () => source })).status, 503);
  assert.equal((await proxyConsultation(leadRequest(), { ...config, contentSource: () => { throw new Error(); } })).status, 503);
  assert.equal((await proxyConsultation(leadRequest(), { ...config, backendUrl: () => { throw new Error(); } })).status, 503);
  assert.equal(calls, 0);
});

test("proxy enforces JSON, validation and 8KB streamed bytes without trusting Content-Length", async () => {
  let calls = 0;
  const config = { ...leadConfig, fetch: (async () => { calls++; return Response.json({ accepted: true }, { status: 201 }); }) as typeof fetch };
  assert.equal((await proxyConsultation(leadRequest(lead, { "Content-Type": "text/plain" }), config)).status, 415);
  assert.equal((await proxyConsultation(leadRequest({ ...lead, consent: false }), config)).status, 400);
  assert.equal((await proxyConsultation(leadRequest(lead, { "Content-Length": "8193" }), config)).status, 413);
  for (const contentLength of [undefined, "1"]) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new TextEncoder().encode("ی".repeat(2500))); }, cancel() { cancelled = true; } });
    const headers: Record<string, string> = { Origin: "https://frontend.example", "Content-Type": "application/json" };
    if (contentLength) headers["Content-Length"] = contentLength;
    const request = new Request("https://frontend.example/api/consultation", { method: "POST", headers, body: stream, duplex: "half" } as RequestInit);
    assert.equal((await proxyConsultation(request, config)).status, 413);
    assert.equal(cancelled, true);
  }
  const malformed = new Request("https://frontend.example/api/consultation", { method: "POST", headers: { Origin: "https://frontend.example", "Content-Type": "application/json" }, body: "{" });
  assert.equal((await proxyConsultation(malformed, config)).status, 400);
  assert.equal(calls, 0);
  const raw = JSON.stringify(lead);
  const bounded = new Request("https://frontend.example/api/consultation", { method: "POST", headers: { Origin: "https://frontend.example", "Content-Type": "application/json; charset=utf-8" }, body: raw + " ".repeat(8192 - new TextEncoder().encode(raw).length) });
  assert.equal((await proxyConsultation(bounded, config)).status, 201);
});

test("proxy forwards only normalized payload and allowlisted headers with safe fetch options", async () => {
  const response = await proxyConsultation(leadRequest({ ...lead, phone: "+۹۸۹۱۲۳۴۵۶۷۸۹", email: " " }, { Cookie: "session=private", Authorization: "Bearer private", "X-Forwarded-For": "192.0.2.1", "X-Real-IP": "192.0.2.2" }), {
    ...leadConfig,
    fetch: (async (url, init) => {
      assert.equal(String(url), "https://backend.example/api/v1/public/leads");
      assert.equal(init?.method, "POST");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.credentials, "omit");
      assert.ok(init?.signal instanceof AbortSignal);
      assert.deepEqual(Object.fromEntries(new Headers(init?.headers)), { accept: "application/json", "content-type": "application/json", origin: "https://frontend.example" });
      assert.deepEqual(JSON.parse(String(init?.body)), lead);
      return Response.json({ accepted: true }, { status: 201, headers: { "Set-Cookie": "private", "X-Private": "private" } });
    }) as typeof fetch,
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("x-private"), null);
});

test("proxy maps errors without exposing upstream bodies and sanitizes Retry-After", async () => {
  for (const [status, expected] of [[400, 400], [422, 400], [403, 403], [409, 409], [429, 429], [500, 502], [503, 502], [302, 502], [200, 502]]) {
    const response = await proxyConsultation(leadRequest(), { ...leadConfig, fetch: (async () => new Response("private name and phone", { status, headers: { "Retry-After": "60" } })) as typeof fetch });
    assert.equal(response.status, expected);
    assert.equal((await response.text()).includes("private"), false);
    assert.equal(response.headers.get("retry-after"), status === 429 || status === 503 ? "60" : null);
  }
  for (const retryAfter of ["Wed, 21 Oct 2026 07:28:00 GMT", "-1", "1.5", "Infinity", "9007199254740992", ""]) {
    assert.equal(validRetryAfter(retryAfter), undefined);
    const response = await proxyConsultation(leadRequest(), { ...leadConfig, fetch: (async () => new Response(null, { status: 429, headers: { "Retry-After": retryAfter } })) as typeof fetch });
    assert.equal(response.headers.get("retry-after"), null);
  }
  assert.equal(validRetryAfter("0"), "0");
});

test("proxy verifies successful shape and handles network, timeout and stalled response safely", async () => {
  for (const value of [{ accepted: false }, { accepted: true, phone: "private" }, [], null]) {
    assert.equal(isConsultationAccepted(value), false);
    const response = await proxyConsultation(leadRequest(), { ...leadConfig, fetch: (async () => Response.json(value, { status: 201 })) as typeof fetch });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "uncertain" });
  }
  for (const response of [new Response("not json", { status: 201 }), new Response("{", { status: 201, headers: { "Content-Type": "application/json" } }), Response.json({ accepted: true, data: "x".repeat(9000) }, { status: 201 })]) {
    assert.equal((await proxyConsultation(leadRequest(), { ...leadConfig, fetch: (async () => response) as typeof fetch })).status, 502);
  }
  assert.equal((await proxyConsultation(leadRequest(), { ...leadConfig, fetch: (async () => { throw new Error("private"); }) as typeof fetch })).status, 502);
  const timeout = await proxyConsultation(leadRequest(), { ...leadConfig, timeoutMs: 5, fetch: ((_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new Error("private")), { once: true }); })) as typeof fetch });
  assert.equal(timeout.status, 504);
  const stalled = await proxyConsultation(leadRequest(), { ...leadConfig, timeoutMs: 5, fetch: (async () => new Response(new ReadableStream(), { status: 201, headers: { "Content-Type": "application/json" } })) as typeof fetch });
  assert.equal(stalled.status, 504);
});

test("consultation integration keeps one contact anchor, server-only config and mount-safe selection", () => {
  const footer = readFileSync("src/components/layout/Footer.tsx", "utf8");
  const form = readFileSync("src/components/layout/ConsultationForm.tsx", "utf8");
  const route = readFileSync("src/app/api/consultation/route.ts", "utf8");
  const page = readFileSync("src/app/(site)/courses/[department-slug]/[course-slug]/page.tsx", "utf8");
  assert.equal((footer.match(/id="contact"/g) ?? []).length, 1);
  assert.equal(form.includes('id="contact"'), false);
  assert.ok(footer.includes("await getCourses()"));
  assert.ok(footer.includes('contentSource() === "api"'));
  assert.ok(route.includes('import "server-only"'));
  assert.ok(route.includes("proxyConsultation(request, { backendUrl, contentSource })"));
  assert.equal(form.includes("content-config"), false);
  assert.equal(form.includes("useSearchParams"), false);
  assert.ok(form.includes("preselectConsultationCourse(select.current, window.location.search, courses)"));
  assert.equal((page.match(/encodeURIComponent\(course.id\)/g) ?? []).length, 3);
  for (const text of ["aria-describedby", 'aria-live="polite"', "htmlFor=", 'type="checkbox"', "busy.current", "submission.current.edit()", 'credentials: "omit"']) assert.ok(form.includes(text), text);
});

const instructorFixture = { id: "abc", slug: "arman-naderi", name: "آرمان", bio: "بیو", image: null, updatedAt: "2026-09-17T00:00:00.000Z" };
const seoFixture = { title: null, description: null, canonicalUrl: null, noindex: false };
const postFixture = {
  id: "p1", slug: "hello-world", title: "سلام", excerpt: "چکیده", contentHtml: "<p>متن</p>",
  category: null, tagIds: [], seo: seoFixture, publishedAt: null, updatedAt: "2026-09-17T00:00:00.000Z",
};
const albumFixture = { id: "a1", slug: "studio", title: "استودیو", description: "توضیح", seo: seoFixture, updatedAt: "2026-09-17T00:00:00.000Z" };
const workFixture = {
  id: "w1", slug: "short-film", title: "فیلم کوتاه", student: "هنرجو", category: "فیلم",
  mediaId: null, media: null, contentHtml: "<p>متن</p>", seo: seoFixture, updatedAt: "2026-09-17T00:00:00.000Z",
};
const settingsFixture = {
  name: "فیلم‌نما", description: "توضیح", contact: { mobile: "09120000000" }, seo: seoFixture,
  createdAt: "2026-09-17T00:00:00.000Z", updatedAt: "2026-09-17T00:00:00.000Z",
};

test("public instructors parse and reject bad shapes", () => {
  assert.equal(parseInstructor(instructorFixture).slug, "arman-naderi");
  assert.equal(parseInstructors({ items: [instructorFixture] }).length, 1);
  assert.equal(parseInstructor({ ...instructorFixture, image: "https://example.com/a.jpg" }).image, "https://example.com/a.jpg");
  for (const patch of [{ slug: "../x" }, { name: " " }, { bio: 1 }, { updatedAt: "yesterday" }, { image: 1 }]) assert.throws(() => parseInstructor({ ...instructorFixture, ...patch }));
  assert.throws(() => parseInstructors({ items: [instructorFixture, instructorFixture] }));
  assert.throws(() => parseInstructors({ items: "nope" }));
});

test("public posts validate slugs, cursors and seo", () => {
  assert.equal(parsePost(postFixture).slug, "hello-world");
  assert.equal(parsePost(postFixture).coverMedia, null);
  assert.equal(parsePost({ ...postFixture, category: "news" }).category, "news");
  assert.equal(parsePostPage({ items: [postFixture], nextCursor: null }).items.length, 1);
  assert.ok(parsePostPage({ items: [], nextCursor: "QUJD" }).nextCursor);
  for (const patch of [{ slug: "Bad_Slug" }, { category: "Bad" }, { tagIds: [""] }, { contentHtml: 1 }, { seo: {} }, { publishedAt: "now" }]) assert.throws(() => parsePost({ ...postFixture, ...patch }));
  for (const cursor of ["", "has space", "x".repeat(301), "!!!"]) assert.throws(() => parsePostPage({ items: [], nextCursor: cursor }));
  assert.throws(() => parsePostPage({ items: [postFixture] }));
});

test("cover media parses backend shape and rejects bad ids urls and alt", () => {
  const cover = { id: "m1", url: "/api/v1/public/media/m1/file", alt: "کاور نوشته" };
  assert.deepEqual(parseCoverMedia(cover), cover);
  assert.equal(parseCoverMedia(null), null);
  assert.equal(parseCoverMedia(undefined), null);
  assert.deepEqual(parsePost({ ...postFixture, coverMedia: cover }).coverMedia, cover);
  assert.deepEqual(parseCourse({ ...course, coverMedia: cover }).coverMedia, cover);
  assert.deepEqual(toCourseCard(parseCourse({ ...course, coverMedia: cover })).coverMedia, cover);
  for (const bad of [
    { ...cover, id: "../m1" },
    { ...cover, id: "" },
    { ...cover, id: "x".repeat(101) },
    { ...cover, url: "https://cdn.example/m1" },
    { ...cover, url: "/api/other/m1/preview" },
    { ...cover, url: "/api/v1/public/media/m1" },
    { ...cover, alt: "x".repeat(501) },
    { ...cover, alt: 1 },
    "m1",
    [],
  ])
    assert.throws(() => parseCoverMedia(bad));
  assert.throws(() => parsePost({ ...postFixture, coverMedia: { ...cover, id: "bad id" } }));
  assert.throws(() => parseCourse({ ...course, coverMedia: {} }));
});

test("media ids and proxy src stay within the same-origin proxy", () => {
  assert.equal(isMediaId("abc_123-XYZ"), true);
  for (const bad of ["", "a/b", "a b", "../x", "x".repeat(101), null, 1, []] as unknown[])
    assert.equal(isMediaId(bad), false);
  assert.equal(mediaSrc("m1"), "/api/media/m1");
});

test("reading time counts whitespace words at 200wpm with a one minute floor", () => {
  assert.equal(readingMinutes(""), 1);
  assert.equal(readingMinutes("   "), 1);
  assert.equal(readingMinutes("سلام دنیا"), 1);
  assert.equal(readingMinutes(Array(200).fill("واژه").join(" ")), 1);
  assert.equal(readingMinutes(Array(201).fill("واژه").join("\n")), 2);
  assert.equal(readingMinutes(`${Array(400).fill("واژه").join(" ")} `), 2);
  assert.equal(readingMinutes(Array(401).fill("واژه").join(" ")), 3);
});

test("share links encode the canonical page url and title for real endpoints", () => {
  const url = "https://filmnama.example/blog/salam-donya";
  const title = "سلام دنیا";
  const links = shareLinks(url, title);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  assert.equal(links.x, `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`);
  assert.equal(links.telegram, `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`);
  assert.equal(links.whatsapp, `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`);
  assert.equal(links.linkedin, `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`);
  for (const href of Object.values(links)) {
    const parsed = new URL(href);
    assert.ok(["twitter.com", "t.me", "wa.me", "www.linkedin.com"].includes(parsed.hostname), href);
  }
});

test("related posts prefer the same category then shared tags excluding self", () => {
  const base = { ...postFixture };
  const current = { ...base, id: "p0", slug: "current", category: "news", tagIds: ["t1", "t2"] };
  const sameCategory = { ...base, id: "p1", slug: "cat-1", category: "news", tagIds: [] };
  const sameCategoryTag = { ...base, id: "p2", slug: "cat-2", category: "news", tagIds: ["t1"] };
  const sameTag = { ...base, id: "p3", slug: "tag-1", category: "sport", tagIds: ["t2"] };
  const otherTag = { ...base, id: "p4", slug: "tag-2", category: "sport", tagIds: ["t1"] };
  const unrelated = { ...base, id: "p5", slug: "other", category: "sport", tagIds: ["t9"] };
  const posts = [current, sameTag, unrelated, sameCategory, otherTag, sameCategoryTag].map((item) => parsePost(item));
  const related = relatedPosts(posts, parsePost(current), 3);
  assert.deepEqual(related.map((item) => item.id), ["p1", "p2", "p3"]);
  assert.deepEqual(relatedPosts(posts, parsePost(current), 2).map((item) => item.id), ["p1", "p2"]);
  assert.deepEqual(relatedPosts([parsePost(current)], parsePost(current)).length, 0);
  const noCategory = parsePost({ ...base, id: "px", slug: "no-cat", category: null, tagIds: ["t9"] });
  assert.deepEqual(relatedPosts(posts, noCategory).map((item) => item.id), ["p5"]);
});

test("public taxonomies reject duplicates and bad slugs", () => {
  const cat = { id: "c1", slug: "news", title: "اخبار", updatedAt: "2026-09-17T00:00:00.000Z" };
  assert.equal(parseCategories({ items: [cat] })[0].title, "اخبار");
  assert.equal(parseTags({ items: [cat] })[0].slug, "news");
  assert.throws(() => parseCategories({ items: [cat, cat] }));
  assert.throws(() => parseTags({ items: [{ ...cat, slug: "Bad" }] }));
});

test("public gallery parses albums, items and media", () => {
  assert.equal(parseAlbums({ items: [albumFixture] }).length, 1);
  assert.equal(parseAlbum(albumFixture).coverMedia, null);
  assert.deepEqual(
    parseAlbum({ ...albumFixture, coverMedia: { id: "m1", url: "/api/v1/public/media/m1/file", alt: "کاور" } }).coverMedia,
    { id: "m1", url: "/api/v1/public/media/m1/file", alt: "کاور" },
  );
  assert.throws(() => parseAlbum({ ...albumFixture, coverMedia: { id: "m1", url: "https://cdn.example/m1", alt: "x" } }));
  const detail = parseAlbumDetail({ ...albumFixture, items: [{ id: "i1", title: "عکس", position: 0, mediaId: "m1", media: { storageKey: "k", mimeType: "image/jpeg", alt: "" } }] });
  assert.equal(detail.items[0]?.mediaId, "m1");
  assert.throws(() => parseAlbumDetail({ ...albumFixture, items: [{ id: "i1", title: "عکس", position: 0, media: { storageKey: "k", mimeType: "image/jpeg", alt: "" } }] }));
  assert.equal(detail.items[0].media.storageKey, "k");
  assert.throws(() => parseAlbums({ items: [albumFixture, albumFixture] }));
  assert.throws(() => parseAlbumDetail({ ...albumFixture, items: [{ id: "i1", title: "x", position: -1, media: { storageKey: "k", mimeType: "image/jpeg", alt: "" } }] }));
  assert.throws(() => parseAlbumDetail({ ...albumFixture, items: [{ id: "i1", title: "x", position: 0, media: null }] }));
  assert.throws(() => parseAlbum({ ...albumFixture, slug: "Bad" }));
});

test("public works and settings enforce caps", () => {
  assert.equal(parseWork(workFixture).category, "فیلم");
  assert.equal(parseWorks({ items: [workFixture] }).length, 1);
  assert.equal(parseWork({ ...workFixture, media: { storageKey: "k", mimeType: "video/mp4", alt: "متن" } }).media?.mimeType, "video/mp4");
  assert.equal(parseWork({ ...workFixture, mediaId: "m9", media: { storageKey: "k", mimeType: "image/jpeg", alt: "x" } }).mediaId, "m9");
  for (const patch of [{ slug: "Bad" }, { category: " " }, { category: "x".repeat(101) }, { student: 1 }, { media: {} }, { mediaId: "../m" }, { mediaId: 42 }]) assert.throws(() => parseWork({ ...workFixture, ...patch }));
  assert.equal(parseSettings(settingsFixture).contact.mobile, "09120000000");
  assert.deepEqual(parseSettings({ ...settingsFixture, contact: {} }).contact, {});
  for (const patch of [{ name: " " }, { contact: { unknown: "x" } }, { contact: { mobile: 1 } }, { seo: null }]) assert.throws(() => parseSettings({ ...settingsFixture, ...patch }));
});

test("public paths and helpers cover new routes without touching course redirects", () => {
  for (const path of ["/blog", "/blog/", "/blog/hello-world", "/blog/hello-world/", "/instructors", "/instructors/", "/instructors/arman-naderi", "/gallery", "/gallery/", "/gallery/studio", "/works", "/works/", "/works/short-film"]) assert.equal(isContentPath(path), true);
  for (const path of ["/blog/a/b", "/instructors/A", "/gallery//x", "/blog/hello_world", "/BLOG", "/works//"]) assert.equal(isContentPath(path), false);
  assert.equal(isSlug("a".repeat(121)), false);
  assert.equal(postPath({ slug: "hello-world" }), "/blog/hello-world/");
  assert.equal(instructorPath({ slug: "arman-naderi" }), "/instructors/arman-naderi/");
  assert.equal(albumPath({ slug: "studio" }), "/gallery/studio/");
  assert.equal(workPath({ slug: "short-film" }), "/works/short-film/");
  assert.deepEqual(parseRevalidatePaths(JSON.stringify({ paths: ["/blog", "/instructors/x", "/gallery/y", "/works/z"] })), ["/blog", "/instructors/x", "/gallery/y", "/works/z"]);
});

test("work and gallery pages play videos and keep images", () => {
  const detail = readFileSync("src/app/(site)/works/[slug]/page.tsx", "utf8");
  assert.ok(detail.includes("<video") && detail.includes("controls") && detail.includes('startsWith("video/")'));
  assert.ok(detail.includes("<img") && detail.includes('startsWith("image/")'));
  const cards = readFileSync("src/components/home/StudentWorks.tsx", "utf8");
  assert.ok(cards.includes("<video") && cards.includes('muted') && cards.includes('startsWith("video/")'));
  const album = readFileSync("src/app/(site)/gallery/[slug]/page.tsx", "utf8");
  assert.ok(album.includes("<video") && album.includes('startsWith("video/")'));
});

test("phase 5 public pages never throw on empty CMS and keep server-only fetching", () => {
  const lib = readFileSync("src/lib/public-content.ts", "utf8");
  assert.ok(lib.includes('import "server-only"'));
  assert.ok(lib.includes('signal: AbortSignal.timeout(8000)'));
  assert.ok(lib.includes('redirect: "error"'));
  assert.ok(lib.includes('"instructors"') && lib.includes('"blog"') && lib.includes('"gallery"') && lib.includes('"works"') && lib.includes('"settings"'));
  for (const file of ["src/app/(site)/blog/page.tsx", "src/app/(site)/blog/[slug]/page.tsx", "src/app/(site)/instructors/page.tsx", "src/app/(site)/gallery/[slug]/page.tsx", "src/app/(site)/works/page.tsx", "src/app/(site)/works/[slug]/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes('"use client"'), false, file);
    assert.ok(source.includes("revalidate = 3600"), file);
  }
  const post = readFileSync("src/app/(site)/blog/[slug]/page.tsx", "utf8");
  assert.ok(post.includes("sanitizeCourseHtml") && post.includes("BlogPosting") && post.includes("serializeJsonLd"));
  for (const file of ["src/app/(site)/instructors/page.tsx", "src/app/(site)/gallery/page.tsx", "src/app/(site)/works/page.tsx"]) {
    assert.equal(readFileSync(file, "utf8").includes("serializeJsonLd"), false, file);
  }
  const home = readFileSync("src/app/(site)/page.tsx", "utf8");
  assert.ok(home.includes("getInstructors") && home.includes("getAlbums") && home.includes("getWorks"));
  const footer = readFileSync("src/components/layout/Footer.tsx", "utf8");
  assert.ok(footer.includes("getSettings"));
});

const searchItemFixture = {
  kind: "course",
  title: "بازیگری",
  latin: "ACTING",
  excerpt: "توضیح دوره",
  path: "/courses/cinema/acting",
  coverMedia: { id: "m1", url: "/api/v1/public/media/m1/file", alt: "کاور" },
};

test("search items validate kind, caps, paths and cover media", () => {
  assert.deepEqual(parseSearchItem(searchItemFixture), searchItemFixture);
  assert.deepEqual(
    parseSearchItem({ ...searchItemFixture, kind: "post", latin: null, path: "/blog/hello-world", coverMedia: null }),
    { ...searchItemFixture, kind: "post", latin: null, path: "/blog/hello-world", coverMedia: null },
  );
  assert.deepEqual(
    parseSearchItem({ ...searchItemFixture, kind: "instructor", latin: null, excerpt: null, path: "/instructors/arman-naderi", coverMedia: null }).kind,
    "instructor",
  );
  for (const patch of [
    { kind: "lesson" },
    { kind: "courses" },
    { title: "" },
    { title: " " },
    { title: "x".repeat(201) },
    { title: 1 },
    { latin: "x".repeat(201) },
    { latin: 1 },
    { excerpt: 1 },
    { path: "/search" },
    { path: "/api/v1/public/search" },
    { path: "/admin" },
    { path: "//example.com" },
    { path: "/courses/a/b/c" },
    { path: "/blog/a/b" },
    { path: "/courses/a/b/c" },
    { coverMedia: { id: "bad id", url: "/api/v1/public/media/m1/file", alt: "x" } },
    { coverMedia: { id: "m1", url: "https://cdn.example/m1", alt: "x" } },
  ])
    assert.throws(() => parseSearchItem({ ...searchItemFixture, ...patch }));
  assert.deepEqual(parseSearchPage({ items: [searchItemFixture] }).items.length, 1);
  assert.deepEqual(parseSearchPage({ items: [] }).items, []);
  assert.throws(() => parseSearchPage({ items: Array(21).fill(searchItemFixture) }));
  assert.throws(() => parseSearchPage({ items: "nope" }));
  assert.throws(() => parseSearchPage({}));
});

test("search query, types and limit normalize without throwing", () => {
  assert.equal(normalizeSearchQuery("  بازیگری  "), "بازیگری");
  assert.equal(normalizeSearchQuery("x".repeat(100))?.length, 100);
  for (const bad of ["", "   ", "x".repeat(101), null, undefined, 1, [], {}]) assert.equal(normalizeSearchQuery(bad), null);
  assert.equal(normalizeSearchTypesParam(undefined), undefined);
  assert.equal(normalizeSearchTypesParam("courses"), "courses");
  assert.equal(normalizeSearchTypesParam("posts,courses"), "courses,posts");
  assert.equal(normalizeSearchTypesParam(["posts", "courses"]), "courses,posts");
  assert.equal(normalizeSearchTypesParam("courses, courses"), "courses");
  assert.equal(normalizeSearchTypesParam(""), undefined);
  for (const bad of ["invalid", "courses,invalid", "", 1, null, ["courses", "bad"], { types: "courses" }]) {
    if (bad === "") continue;
    assert.equal(normalizeSearchTypesParam(bad), null, JSON.stringify(bad));
  }
  assert.equal(normalizeSearchLimit(1), 1);
  assert.equal(normalizeSearchLimit(20), 20);
  for (const bad of [0, 21, 1.5, NaN, "10", null, undefined, {}, []]) assert.equal(normalizeSearchLimit(bad), undefined);
});

test("sitemap entries build absolute urls with safe lastModified", () => {
  const entries = buildSitemapEntries("https://example.com/", [
    { path: "/blog/hello-world", updatedAt: "2026-09-17T00:00:00.000Z" },
    { path: "/blog/hello-world", updatedAt: "2026-09-17T00:00:00.000Z" },
    { path: "/courses", updatedAt: null, publishedAt: null },
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, "https://example.com/blog/hello-world");
  assert.equal(entries[0].lastModified.toISOString(), "2026-09-17T00:00:00.000Z");
  assert.ok(entries[1].lastModified instanceof Date);
  assert.ok(Number.isFinite(toSitemapLastModified("2026-09-17T00:00:00.000Z").getTime()));
  assert.ok(toSitemapLastModified("not-a-date", "2026-09-17T00:00:00.000Z").toISOString().startsWith("2026-09-17"));
  assert.ok(toSitemapLastModified(null, null) instanceof Date);
});

test("search fetching returns [] on bad input without fetch and uses per-query no-store", () => {
  const lib = readFileSync("src/lib/public-content.ts", "utf8");
  assert.ok(lib.includes("export async function getSearch"));
  assert.ok(lib.includes("normalizeSearchQuery"));
  assert.ok(lib.includes("normalizeSearchTypesParam"));
  assert.ok(lib.includes("parseSearchPage"));
  assert.ok(lib.includes("public/search"));
  assert.ok(lib.includes('cache: "no-store"'));
  assert.ok(lib.includes('redirect: "error"'));
  assert.ok(lib.includes("AbortSignal.timeout(8000)"));
  assert.ok(lib.includes('contentSource() === "mock"'));
  const fnStart = lib.indexOf("export async function getSearch");
  const fnBody = lib.slice(fnStart, fnStart + 2000);
  assert.ok(fnBody.includes("if (query === null) return []"));
  assert.ok(fnBody.includes("if (types === null) return []"));
  assert.ok(fnBody.indexOf("return []") < fnBody.indexOf("fetch("));
  assert.equal(fnBody.includes("revalidate"), false);
  assert.ok(lib.includes("if (!response.ok) return []"));
});

test("search page is a server component with noindex, accessible form and grouped results", () => {
  const page = readFileSync("src/app/(site)/search/page.tsx", "utf8");
  assert.equal(page.includes('"use client"'), false);
  assert.ok(page.includes("Server") || page.includes("async function") || page.includes("getSearch"));
  assert.ok(page.includes("index: false") && page.includes("follow: true"));
  assert.ok(page.includes('role="status"'));
  assert.ok(page.includes('htmlFor="search-q"') || page.includes('htmlFor='));
  assert.ok(page.includes('type="checkbox"'));
  assert.ok(page.includes('name="types"'));
  assert.ok(page.includes('name="q"'));
  assert.ok(page.includes("<button"));
  assert.ok(page.includes('method="GET"'));
  assert.ok(page.includes("defaultValue"));
  assert.ok(page.includes("mediaSrc"));
  assert.ok(page.includes("toFaDigits"));
  assert.ok(page.includes("دوره‌ها") && page.includes("نوشته‌ها") && page.includes("اساتید"));
  assert.ok(page.includes("?q=") || page.includes("q=${encodeURIComponent"));
  assert.ok(page.includes("getSearch"));
  assert.ok(page.includes("limit: 20"));
});

test("sitemap lists public content without search and survives empty CMS", () => {
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  assert.ok(sitemap.includes("export const revalidate = 3600"));
  assert.ok(sitemap.includes("export default async function sitemap"));
  assert.ok(sitemap.includes("MetadataRoute.Sitemap"));
  assert.ok(sitemap.includes("siteOrigin()"));
  assert.ok(sitemap.includes("getDepartments") && sitemap.includes("getCourses"));
  assert.ok(sitemap.includes("getPosts") && sitemap.includes("getInstructors"));
  assert.ok(sitemap.includes("getAlbums") && sitemap.includes("getWorks"));
  assert.ok(sitemap.includes("coursePath") && sitemap.includes("postPath"));
  assert.ok(sitemap.includes("instructorPath") && sitemap.includes("albumPath") && sitemap.includes("workPath"));
  assert.ok(sitemap.includes("buildSitemapEntries"));
  assert.ok(sitemap.includes("try") && sitemap.includes("catch"));
  assert.ok(sitemap.includes('"/courses/"') && sitemap.includes('"/blog/"'));
  assert.ok(sitemap.includes('"/instructors/"') && sitemap.includes('"/gallery/"') && sitemap.includes('"/works/"'));
  assert.equal(sitemap.includes('"/search"'), false);
  assert.equal(sitemap.includes("'/search'"), false);
});

test("robots disallows admin, api and search with absolute sitemap", () => {
  const robots = readFileSync("src/app/robots.ts", "utf8");
  assert.ok(robots.includes("MetadataRoute.Robots"));
  assert.ok(robots.includes('userAgent: "*"') || robots.includes("userAgent: '*'"));
  assert.ok(robots.includes('allow: "/"') || robots.includes("allow: '/'"));
  assert.ok(robots.includes("/admin/") && robots.includes("/api/") && robots.includes("/search"));
  assert.ok(robots.includes("siteOrigin()") && robots.includes("/wp-sitemap.xml"));
});

test("proxy matcher stays scoped to courses leaving sitemap and robots alone", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.ok(proxy.includes('matcher: "/courses/:path*"') || proxy.includes("matcher: '/courses/:path*'"));
  assert.equal(proxy.includes("sitemap"), false);
  assert.equal(proxy.includes("robots"), false);
});

test("header exposes search in desktop bar and mobile menu", () => {
  const header = readFileSync("src/components/layout/Header.tsx", "utf8");
  assert.ok(header.includes("Search") && header.includes("lucide-react"));
  assert.ok((header.match(/href="\/search\/"/g) ?? []).length >= 2);
  assert.ok(header.includes('aria-label="جستجو"'));
});

test("organization and about JSON-LD stay honest and minimal", () => {
  const org = organizationJsonLd({ name: "x", url: "https://example.com/" });
  assert.equal(org["@type"], "Organization");
  assert.equal("aggregateRating" in org, false);
  assert.equal("foundingDate" in org, false);
  const full = organizationJsonLd({
    name: "x", url: "https://example.com/", logo: "https://example.com/logo.png",
    sameAs: ["https://example.com/social"], telephone: "09120000000", address: "addr",
  });
  assert.equal(full.logo, "https://example.com/logo.png");
  assert.deepEqual(full.sameAs, ["https://example.com/social"]);
  assert.equal((full as { contactPoint: { "@type": string } }).contactPoint["@type"], "ContactPoint");
  assert.equal(aboutPageJsonLd("t", "d", "https://example.com/about")["@type"], "AboutPage");
  assert.ok(JSON.parse(serializeJsonLd(full)).name);
});

test("about page answers standard questions without fabricated claims", () => {
  const page = readFileSync("src/app/(site)/about/page.tsx", "utf8");
  assert.ok(page.includes('contentMetadata(') && page.includes('"/about/"'));
  assert.ok(page.includes("organizationJsonLd") && page.includes("aboutPageJsonLd") && page.includes("faqJsonLd"));
  assert.ok(page.includes("/courses") && page.includes("/#contact"));
  assert.ok(page.includes("مهارت‌های تخصصی"));
  for (const bad of ["تأسیس 13", "تأسیس 14", "هنرجویان", "بهترین آموزشگاه", "تضمین"]) assert.equal(page.includes(bad), false);
});

test("detail heroes use two-column layout with hierarchy title before lead", () => {
  const course = readFileSync("src/app/(site)/courses/[department-slug]/[course-slug]/page.tsx", "utf8");
  assert.ok(course.includes("lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"));
  assert.ok(course.includes("<figure") && course.includes("mediaSrc(course.coverMedia.id)"));
  assert.equal((course.match(/encodeURIComponent\(course\.id\)/g) ?? []).length, 3);
  const about = readFileSync("src/app/(site)/about/page.tsx", "utf8");
  assert.ok(about.includes("lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"));
  assert.ok(about.includes('src="/logo.png"'));
  const post = readFileSync("src/app/(site)/blog/[slug]/page.tsx", "utf8");
  assert.ok(post.indexOf("<h1") < post.indexOf("border-s-2 border-red"));
});

test("contact page reuses the consultation form with honest metadata", () => {
  const page = readFileSync("src/app/(site)/contact/page.tsx", "utf8");
  assert.ok(page.includes('contentMetadata(TITLE, DESCRIPTION, "/contact/")'));
  assert.ok(page.includes("ConsultationForm") && page.includes("available={available}"));
  assert.ok(page.includes('"@type": "ContactPage"') && page.includes("breadcrumbJsonLd") && page.includes("faqJsonLd"));
  assert.ok(page.includes(`tel:${"${site.mobile}"}`) || page.includes("tel:"));
  for (const bad of ["ساعت کاری", "پاسخگویی در", "تضمین", "بهترین آموزشگاه"]) assert.equal(page.includes(bad), false);
  const site = readFileSync("src/data/site.ts", "utf8");
  assert.ok(site.includes('{ href: "/contact/", label: "تماس با ما" }'));
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  assert.ok(sitemap.includes('{ path: "/contact/" }'));
});

test("instructors list page renders portraits with initial fallback", () => {
  const page = readFileSync("src/app/(site)/instructors/page.tsx", "utf8");
  assert.ok(page.includes("<img") && page.includes("aspect-[3/4]"));
  assert.ok(page.includes('startsWith("/")') && page.includes('startsWith("https://")'));
  assert.ok(page.includes("InitialTile") && page.includes('aspect="portrait"'));
});

test("migrated trust pages keep exact WP titles, H1s and canonicals", () => {
  const aboutUs = readFileSync("src/app/about-us/page.tsx", "utf8");
  assert.ok(aboutUs.includes('title: { absolute: "درباره ما - فیلم نما" }'));
  assert.ok(aboutUs.includes('"/about-us/"'));
  assert.ok(aboutUs.includes(">درباره ما</h1>"));
  assert.ok(aboutUs.includes("مجموعه بزرگ فیلم نما"));
  assert.equal(aboutUs.includes("/teacher-of-filmnama/") || aboutUs.includes("/training-courses/"), false);
  const contactUs = readFileSync("src/app/contact-us/page.tsx", "utf8");
  assert.ok(contactUs.includes('title: { absolute: "تماس با ما - فیلم نما" }'));
  assert.ok(contactUs.includes('"/contact-us/"'));
  assert.ok(contactUs.includes(">تماس با ما</h1>"));
  assert.ok(contactUs.includes("9 صبح الی9 شب") && contactUs.includes("info@example.com"));
  const faq = readFileSync("src/app/faq/page.tsx", "utf8");
  assert.ok(faq.includes('title: { absolute: "سوالات متداول - فیلم نما" }'));
  assert.ok(faq.includes('"/faq/"'));
  assert.ok(faq.includes(">سوالات متداول</h1>"));
  assert.ok(faq.includes("168 کشور جهان"));
  const hub = readFileSync("src/app/training-course/page.tsx", "utf8");
  assert.ok(hub.includes('title: { absolute: "معرفی دوره ها - فیلم نما" }'));
  assert.ok(hub.includes(">معرفی دوره ها</h1>"));
  assert.ok(hub.includes("getCourses") && hub.includes("coursePath"));
  const profs = readFileSync("src/app/professors/page.tsx", "utf8");
  assert.ok(profs.includes('title: { absolute: "اساتید - فیلم نما" }'));
  assert.ok(profs.includes(">اساتید</h1>"));
  assert.ok(profs.includes("getInstructors") && profs.includes("instructorPath"));
  const rootSlug = readFileSync("src/app/[...slug]/page.tsx", "utf8");
  assert.ok(rootSlug.includes('"/استادها/"') && rootSlug.includes('"/ساخته-های-فیلم-نما/"') && rootSlug.includes('"/گالری-ویدیوهای-دورهها/"'));
  assert.ok(rootSlug.includes("notFound()"));
  assert.ok(rootSlug.includes("generateStaticParams"));
  assert.ok(rootSlug.includes("resolveCustomPath"));
  const config = readFileSync("next.config.ts", "utf8");
  assert.equal(config.includes("rewrites"), false);
  assert.ok(config.includes("trailingSlash: true"));
  for (const [source, destination] of [
    ["/2022/09/26/", "/blog/"],
    ["/2024/09/25/", "/blog/"],
    ["/2024/09/26/", "/blog/"],
    ["/2024/09/28/", "/blog/"],
    ["/author/deli/", "/blog/"],
    ["/author/jaberi/", "/contact-us/"],
  ]) {
    assert.ok(config.includes(`source: "${source}"`) && config.includes(`destination: "${destination}"`), `redirect ${source}`);
  }
  const blog = readFileSync("src/app/(site)/blog/page.tsx", "utf8");
  assert.ok(blog.includes("اطلاعیه و اخبار – فیلم نما") && blog.includes('level="h1" title="اطلاعیه و اخبار"'));
  const gallery = readFileSync("src/app/(site)/gallery/page.tsx", "utf8");
  assert.ok(gallery.includes('title: { absolute: "گالری - فیلم نما" }') && gallery.includes('level="h1" title="گالری"'));
});

test("section headings render h1 for page headers and h2 for sections", () => {
  const heading = readFileSync("src/components/ui/SectionHeading.tsx", "utf8");
  assert.ok(heading.includes('level = "h2"') && heading.includes("TitleTag"));
  for (const file of [
    "src/app/(site)/blog/page.tsx",
    "src/app/(site)/gallery/page.tsx",
    "src/app/(site)/works/page.tsx",
    "src/app/(site)/instructors/page.tsx",
    "src/app/(site)/search/page.tsx",
  ]) {
    assert.ok(readFileSync(file, "utf8").includes('level="h1"'), file);
  }
});

test("nav and sitemap expose the about page", () => {
  const site = readFileSync("src/data/site.ts", "utf8");
  assert.ok(site.includes('{ href: "/about/", label: "درباره ما" }'));
  assert.equal(site.includes("#about"), false);
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  assert.ok(sitemap.includes('{ path: "/about/" }'));
});

test("editor-defined custom paths resolve, validate and prefer custom URLs", () => {
  assert.equal(isCustomUrlPath("/training-courses/فن-بیان/"), true);
  assert.equal(isCustomUrlPath("/director"), true);
  assert.equal(isCustomUrlPath("/2022/09/26/مراحل-تدوین-فیلم/"), true);
  assert.equal(isCustomUrlPath("/"), false);
  assert.equal(isCustomUrlPath("/courses/x"), false);
  assert.equal(isCustomUrlPath("/admin"), false);
  assert.equal(isCustomUrlPath("/blog/x"), false);
  assert.equal(isCustomUrlPath("no-leading-slash"), false);
  assert.equal(isCustomUrlPath("/a/b/c/d/e/f"), false);
  assert.equal(isCustomUrlPath("/../x"), false);
  assert.equal(parseCourse({ ...course, customPath: null }).customPath, null);
  assert.equal(parseCourse({ ...course, customPath: "training-courses/فن-بیان" }).customPath, "training-courses/فن-بیان");
  assert.equal(parsePost({ ...postFixture, customPath: "2022/09/26/note" }).customPath, "2022/09/26/note");
  assert.equal(parseWork({ ...workFixture, customPath: null }).customPath, null);
  assert.equal(normalizeCustomPath(""), null);
  assert.equal(normalizeCustomPath("/training-courses/فن-بیان/"), "training-courses/فن-بیان");
  assert.equal(normalizeCustomPath(null), null);
  const seo = readFileSync("src/lib/content-seo.ts", "utf8");
  assert.ok(seo.includes("withCustomCanonical") && seo.includes("canonicalUrl(`/${customPath}/`)"));
  for (const file of [
    "src/app/(site)/courses/[department-slug]/[course-slug]/page.tsx",
    "src/app/(site)/instructors/[slug]/page.tsx",
    "src/app/(site)/blog/[slug]/page.tsx",
    "src/app/(site)/works/[slug]/page.tsx",
  ]) {
    assert.ok(readFileSync(file, "utf8").includes("withCustomCanonical"), file);
  }
  const instructorForm = readFileSync("src/components/admin/InstructorForm.tsx", "utf8");
  assert.ok(instructorForm.includes('name="customPath"'));
  const sitemapSrc = readFileSync("src/app/sitemap.ts", "utf8");
  assert.ok(sitemapSrc.includes("item.customPath ? `/${item.customPath}/`"));
});
