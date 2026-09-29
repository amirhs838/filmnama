import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAlbumItemPayload,
  buildAlbumPayload,
  buildCategoryPayload,
  buildCoursePayload,
  buildDepartmentPayload,
  buildInstructorPayload,
  buildMediaPayload,
  buildPostPayload,
  buildSettingsPayload,
  buildTagPayload,
  buildWorkPayload,
  createMedia,
  getAlbum,
  getAlbumItem,
  getCategory,
  getCourse,
  getDepartment,
  getInstructor,
  getMedia,
  getPost,
  getSettings,
  getTag,
  getWork,
  listAlbumItems,
  listAlbums,
  listAudits,
  listCategories,
  listCourses,
  listDepartments,
  listInstructors,
  listLeads,
  listMedia,
  listPosts,
  listRedirects,
  listRevalidation,
  listTags,
  listUsers,
  listWorks,
  parseIds,
  patchMediaAlt,
  removeAlbum,
  removeAlbumItem,
  removeCategory,
  removeCourse,
  removeDepartment,
  removeInstructor,
  removeMedia,
  removePost,
  removeTag,
  removeWork,
  saveAlbum,
  saveAlbumItem,
  saveCategory,
  saveCourse,
  saveDepartment,
  saveInstructor,
  savePost,
  saveSettings,
  saveTag,
  saveWork,
  setLeadStatus,
  setUserAccess,
  splitLines,
  uploadFileError,
  uploadMedia,
  type Album,
  type AlbumItem,
  type Category,
  type Course,
  type Department,
  type Instructor,
  type Media,
  type Post,
  type SiteSettings,
  type Tag,
  type Work,
} from "./admin-api";
import { clearAdminTokens, setAdminTokens } from "./admin-auth";

const tokens = {
  accessToken: "access-1",
  csrfToken: "csrf-1",
  role: "CONTENT_MANAGER",
};

function jsonFetcher(
  expected: (url: string, init?: RequestInit) => void,
  payload: unknown,
  status = 200,
) {
  return (async (url: string, init?: RequestInit) => {
    expected(url, init);
    return Response.json(payload, { status });
  }) as typeof fetch;
}

test("splitLines trims blank lines across newline styles", () => {
  assert.deepEqual(splitLines("  الف\n\nب  \r\n\r\n  \nج "), ["الف", "ب", "ج"]);
  assert.deepEqual(splitLines(""), []);
  assert.deepEqual(splitLines("   \n \r\n "), []);
  assert.deepEqual(splitLines("single"), ["single"]);
});

test("parseIds splits comma text trims empties and dedupes", () => {
  assert.deepEqual(parseIds("a, b ,a,,  c ,b"), ["a", "b", "c"]);
  assert.deepEqual(parseIds(""), []);
  assert.deepEqual(parseIds("  , , "), []);
  assert.deepEqual(parseIds("id-1"), ["id-1"]);
});

test("department payload trims fields and normalizes seo empties to null", () => {
  const payload = buildDepartmentPayload({
    slug: "  cinema ",
    label: " سینما ",
    latin: " CINEMA ",
    description: " توضیح ",
    status: "PUBLISHED",
    seoTitle: " ",
    seoDescription: "",
    seoCanonicalUrl: " https://example.com/courses/cinema ",
    seoNoindex: true,
  });
  assert.deepEqual(payload, {
    slug: "cinema",
    label: "سینما",
    latin: "CINEMA",
    description: "توضیح",
    status: "PUBLISHED",
    seo: {
      title: null,
      description: null,
      canonicalUrl: "https://example.com/courses/cinema",
      noindex: true,
    },
  });
});

test("course payload keeps full PUT completeness with instructorIds and seo", () => {
  const payload = buildCoursePayload({
    slug: " acting ",
    departmentId: " dep-1 ",
    title: " بازیگری ",
    latin: " ACTING ",
    description: " توضیح ",
    level: " مقدماتی ",
    duration: " ۴۸ جلسه ",
    iconKey: "Drama",
    contentHtml: "<p>متن</p>",
    syllabusText: " تمرین\n\n اجرا \r\n",
    faq: [
      { question: " ", answer: "ignored" },
      { question: " پرسش ", answer: " پاسخ " },
    ],
    instructorIdsText: "  ",
    seoTitle: "",
    seoDescription: "  ",
    seoCanonicalUrl: "",
    status: "DRAFT",
  });
  assert.equal(payload.slug, "acting");
  assert.equal(payload.departmentId, "dep-1");
  assert.deepEqual(payload.syllabus, ["تمرین", "اجرا"]);
  assert.deepEqual(payload.faq, [{ question: "پرسش", answer: "پاسخ" }]);
  assert.deepEqual(payload.instructorIds, []);
  assert.deepEqual(payload.seo, {
    title: null,
    description: null,
    canonicalUrl: null,
    noindex: false,
  });
  assert.equal(payload.contentHtml, "<p>متن</p>");
  assert.equal(payload.iconKey, "Drama");
  assert.equal(payload.status, "DRAFT");
  const full = buildCoursePayload({
    slug: "a",
    departmentId: "d",
    title: "t",
    latin: "L",
    description: "desc",
    level: "lvl",
    duration: "dur",
    iconKey: "Camera",
    contentHtml: "<p>x</p>",
    syllabusText: "one",
    faq: [{ question: "q", answer: "a" }],
    instructorIdsText: "i1, i2, i1",
    seoTitle: "st",
    seoDescription: "sd",
    seoCanonicalUrl: "https://example.com/x",
    seoNoindex: true,
    status: "PUBLISHED",
  });
  assert.deepEqual(full.instructorIds, ["i1", "i2"]);
  assert.deepEqual(full.seo, {
    title: "st",
    description: "sd",
    canonicalUrl: "https://example.com/x",
    noindex: true,
  });
});

test("instructor payload trims fields normalizes image and keeps full PUT completeness", () => {
  const payload = buildInstructorPayload({
    slug: "  master-ahmadi ",
    name: " استاد احمدی ",
    bio: " توضیح ",
    image: "  ",
    status: "PUBLISHED",
    seoTitle: " ",
    seoDescription: "",
    seoCanonicalUrl: " https://example.com/instructors/x ",
    seoNoindex: true,
  });
  assert.deepEqual(payload, {
    slug: "master-ahmadi",
    name: "استاد احمدی",
    bio: "توضیح",
    image: null,
    status: "PUBLISHED",
    customPath: null,
    seo: {
      title: null,
      description: null,
      canonicalUrl: "https://example.com/instructors/x",
      noindex: true,
    },
  });
  const full = buildInstructorPayload({
    slug: "a",
    name: "نام",
    bio: "bio",
    image: " https://example.com/img.jpg ",
    status: "DRAFT",
    seoTitle: "st",
    seoDescription: "sd",
    seoCanonicalUrl: "",
    seoNoindex: false,
  });
  assert.equal(full.image, "https://example.com/img.jpg");
  assert.deepEqual(full.seo, {
    title: "st",
    description: "sd",
    canonicalUrl: null,
    noindex: false,
  });
});

test("category and tag payloads trim slug and title", () => {
  assert.deepEqual(
    buildCategoryPayload({ slug: "  cinema ", title: " سینما " }),
    { slug: "cinema", title: "سینما" },
  );
  assert.deepEqual(buildTagPayload({ slug: " montage ", title: " مونتاژ " }), {
    slug: "montage",
    title: "مونتاژ",
  });
});

test("post payload trims fields normalizes category tagIds and seo for full PUT", () => {
  const payload = buildPostPayload({
    slug: " first-post ",
    title: " نخستین نوشته ",
    excerpt: " خلاصه ",
    contentHtml: "<p>متن</p>",
    categoryId: "  ",
    tagIdsText: "t1, t2, t1",
    seoTitle: "",
    seoDescription: "  ",
    seoCanonicalUrl: "",
    status: "DRAFT",
  });
  assert.deepEqual(payload, {
    slug: "first-post",
    title: "نخستین نوشته",
    excerpt: "خلاصه",
    contentHtml: "<p>متن</p>",
    categoryId: null,
    tagIds: ["t1", "t2"],
    coverMediaId: null,
    seo: { title: null, description: null, canonicalUrl: null, noindex: false },
    status: "DRAFT",
    customPath: null,
  });
  const full = buildPostPayload({
    slug: "p",
    title: "t",
    excerpt: "e",
    contentHtml: "<p>x</p>",
    categoryId: " cat-1 ",
    tagIdsText: "",
    seoTitle: "st",
    seoDescription: "sd",
    seoCanonicalUrl: "https://example.com/blog/p",
    seoNoindex: true,
    status: "PUBLISHED",
  });
  assert.equal(full.categoryId, "cat-1");
  assert.deepEqual(full.tagIds, []);
  assert.deepEqual(full.seo, {
    title: "st",
    description: "sd",
    canonicalUrl: "https://example.com/blog/p",
    noindex: true,
  });
});

test("album payload trims fields and keeps full PUT completeness with seo", () => {
  const payload = buildAlbumPayload({
    slug: "  spring ",
    title: " بهار ",
    description: " توضیح ",
    status: "PUBLISHED",
    seoTitle: " ",
    seoDescription: "",
    seoCanonicalUrl: " https://example.com/gallery/spring ",
    seoNoindex: true,
  });
  assert.deepEqual(payload, {
    slug: "spring",
    title: "بهار",
    description: "توضیح",
    status: "PUBLISHED",
    coverMediaId: null,
    seo: {
      title: null,
      description: null,
      canonicalUrl: "https://example.com/gallery/spring",
      noindex: true,
    },
  });
  assert.equal(buildAlbumPayload({ slug: "s", title: "t", description: "d", status: "DRAFT", coverMediaId: " media-1 " }).coverMediaId, "media-1");
});

test("album item payload keeps caption status and parses position for full PUT", () => {
  const payload = buildAlbumItemPayload({
    albumId: " album-1 ",
    mediaId: " media-1 ",
    title: " غروب ",
    caption: " زیرنویس ",
    position: " 3 ",
    status: "PUBLISHED",
  });
  assert.deepEqual(payload, {
    albumId: "album-1",
    mediaId: "media-1",
    title: "غروب",
    caption: "زیرنویس",
    position: 3,
    status: "PUBLISHED",
  });
  const fallback = buildAlbumItemPayload({
    albumId: "a",
    mediaId: "m",
    title: "t",
    position: "nope",
    status: "DRAFT",
  });
  assert.equal(fallback.position, 0);
  assert.equal(fallback.caption, "");
});

test("work payload normalizes mediaId student and seo for full PUT", () => {
  const payload = buildWorkPayload({
    slug: " first-work ",
    title: " نخستین اثر ",
    student: " ",
    category: " عکاسی ",
    mediaId: "  ",
    contentHtml: "<p>متن</p>",
    seoTitle: "",
    seoDescription: "  ",
    seoCanonicalUrl: "",
    status: "DRAFT",
  });
  assert.deepEqual(payload, {
    slug: "first-work",
    title: "نخستین اثر",
    student: "",
    category: "عکاسی",
    mediaId: null,
    contentHtml: "<p>متن</p>",
    seo: { title: null, description: null, canonicalUrl: null, noindex: false },
    status: "DRAFT",
    customPath: null,
  });
  const full = buildWorkPayload({
    slug: "w",
    title: "t",
    student: " سارا ",
    category: "c",
    mediaId: " media-9 ",
    contentHtml: "<p>x</p>",
    seoTitle: "st",
    seoDescription: "sd",
    seoCanonicalUrl: "https://example.com/works/w",
    seoNoindex: true,
    status: "PUBLISHED",
  });
  assert.equal(full.mediaId, "media-9");
  assert.equal(full.student, "سارا");
  assert.deepEqual(full.seo, {
    title: "st",
    description: "sd",
    canonicalUrl: "https://example.com/works/w",
    noindex: true,
  });
});

test("media payload trims fields casts mime and parses size", () => {
  const payload = buildMediaPayload({
    storageKey: " gallery/a.jpg ",
    mimeType: "image/jpeg",
    size: " 1024 ",
    alt: " غروب ",
  });
  assert.deepEqual(payload, {
    storageKey: "gallery/a.jpg",
    mimeType: "image/jpeg",
    size: 1024,
    alt: "غروب",
  });
  const fallback = buildMediaPayload({
    storageKey: "k",
    mimeType: "video/mp4",
    size: "nope",
    alt: "",
  });
  assert.equal(fallback.size, 0);
});

test("settings payload keeps only non-empty contact fields with full PUT seo", () => {
  const payload = buildSettingsPayload({
    name: " فیلم‌نما ",
    description: " توضیح ",
    contactPhone: " 021-123 ",
    contactMobile: "  ",
    contactAddress: "",
    contactInstagram: " filmnama ",
    seoTitle: "",
    seoDescription: "  ",
    seoCanonicalUrl: "",
    seoNoindex: false,
  });
  assert.deepEqual(payload, {
    name: "فیلم‌نما",
    description: "توضیح",
    contact: { phone: "021-123", instagram: "filmnama" },
    seo: { title: null, description: null, canonicalUrl: null, noindex: false },
  });
  const full = buildSettingsPayload({
    name: "n",
    description: "d",
    contactPhone: "p",
    contactMobile: "m",
    contactAddress: "a",
    contactInstagram: "i",
    seoTitle: "st",
    seoDescription: "sd",
    seoCanonicalUrl: "https://example.com/",
    seoNoindex: true,
  });
  assert.deepEqual(full.contact, { phone: "p", mobile: "m", address: "a", instagram: "i" });
  assert.deepEqual(full.seo, {
    title: "st",
    description: "sd",
    canonicalUrl: "https://example.com/",
    noindex: true,
  });
});

test("album work and item helpers use exact proxy paths and verbs", async () => {
  clearAdminTokens();
  setAdminTokens(tokens);
  try {
    const albumBase = buildAlbumPayload({
      slug: "spring",
      title: "بهار",
      description: "توضیح",
      status: "DRAFT",
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      seoNoindex: false,
    });
    const album = { id: "album-1", ...albumBase } as Album;
    const albumList = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-albums");
      assert.equal(init?.method, "GET");
    }, { items: [album] });
    assert.deepEqual(await listAlbums(albumList), { items: [album] });
    const albumGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-albums/album-1");
      assert.equal(init?.method, "GET");
    }, album);
    assert.deepEqual(await getAlbum(albumGet, "album-1"), album);
    const albumPost = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-albums");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.ok(typeof body.seo === "object" && body.seo !== null);
    }, album);
    assert.deepEqual(await saveAlbum(albumPost, albumBase), album);
    const albumPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-albums/album-1");
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.equal(body.slug, "spring");
    }, album);
    assert.deepEqual(await saveAlbum(albumPut, { ...albumBase, id: "album-1" }), album);
    const albumDel = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-albums/album-1");
      assert.equal(init?.method, "DELETE");
      assert.equal(new Headers(init?.headers).get("content-type"), "application/json");
      assert.equal(init?.body, "{}");
    }, album);
    assert.deepEqual(await removeAlbum(albumDel, "album-1"), album);

    const itemBase = buildAlbumItemPayload({
      albumId: "album-1",
      mediaId: "media-1",
      title: "غروب",
      caption: "زیرنویس",
      position: "2",
      status: "DRAFT",
    });
    const item = {
      id: "item-1",
      albumId: "album-1",
      mediaId: "media-1",
      title: "غروب",
      position: 2,
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    } as AlbumItem;
    const itemList = jsonFetcher((url, init) => {
      assert.equal(init?.method, "GET");
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.pathname, "/api/admin/gallery-items");
      assert.equal(parsed.searchParams.get("albumId"), "album-1");
    }, { items: [item] });
    assert.deepEqual(await listAlbumItems(itemList, { albumId: "album-1" }), {
      items: [item],
    });
    const itemBare = jsonFetcher((url) => {
      assert.equal(url, "/api/admin/gallery-items");
    }, { items: [] });
    assert.deepEqual(await listAlbumItems(itemBare), { items: [] });
    const itemGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-items/item-1");
      assert.equal(init?.method, "GET");
    }, item);
    assert.deepEqual(await getAlbumItem(itemGet, "item-1"), item);
    const itemPost = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-items");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.equal(body.position, 2);
      assert.equal(body.caption, "زیرنویس");
    }, item);
    assert.deepEqual(await saveAlbumItem(itemPost, itemBase), item);
    const itemPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-items/item-1");
      assert.equal(init?.method, "PUT");
    }, item);
    assert.deepEqual(await saveAlbumItem(itemPut, { ...itemBase, id: "item-1" }), item);
    const itemDel = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/gallery-items/item-1");
      assert.equal(init?.method, "DELETE");
    }, item);
    assert.deepEqual(await removeAlbumItem(itemDel, "item-1"), item);

    const workBase = buildWorkPayload({
      slug: "first-work",
      title: "نخستین اثر",
      student: "",
      category: "عکاسی",
      mediaId: "",
      contentHtml: "<p>متن</p>",
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      status: "DRAFT",
    });
    const work = { id: "work-1", ...workBase } as Work;
    const workList = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/works");
      assert.equal(init?.method, "GET");
    }, { items: [work] });
    assert.deepEqual(await listWorks(workList), { items: [work] });
    const workGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/works/work-1");
      assert.equal(init?.method, "GET");
    }, work);
    assert.deepEqual(await getWork(workGet, "work-1"), work);
    const workPost = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/works");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.equal(body.mediaId, null);
      assert.ok(typeof body.seo === "object" && body.seo !== null);
    }, work);
    assert.deepEqual(await saveWork(workPost, workBase), work);
    const workPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/works/work-1");
      assert.equal(init?.method, "PUT");
    }, work);
    assert.deepEqual(await saveWork(workPut, { ...workBase, id: "work-1" }), work);
    const workDel = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/works/work-1");
      assert.equal(init?.method, "DELETE");
    }, work);
    assert.deepEqual(await removeWork(workDel, "work-1"), work);
  } finally {
    clearAdminTokens();
  }
});

test("media helpers pass bound cursors and use POST PATCH DELETE verbs", async () => {
  clearAdminTokens();
  setAdminTokens(tokens);
  try {
    const media = { id: "media-1", storageKey: "k" } as Media;
    const page = { items: [media], nextCursor: "cursor-2" };
    const list = jsonFetcher((url, init) => {
      assert.equal(init?.method, "GET");
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.pathname, "/api/admin/media");
      assert.equal(parsed.searchParams.get("mime"), "image/jpeg");
      assert.equal(parsed.searchParams.get("limit"), "5");
      assert.equal(parsed.searchParams.get("cursor"), "cursor-1");
    }, page);
    assert.deepEqual(
      await listMedia(list, { mime: "image/jpeg", limit: 5, cursor: "cursor-1" }),
      page,
    );
    const bare = jsonFetcher((url) => {
      assert.equal(url, "/api/admin/media");
    }, { items: [], nextCursor: null });
    assert.deepEqual(await listMedia(bare), { items: [], nextCursor: null });
    const detail = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/media/media-1");
      assert.equal(init?.method, "GET");
    }, media);
    assert.deepEqual(await getMedia(detail, "media-1"), media);
    const input = buildMediaPayload({
      storageKey: "gallery/a.jpg",
      mimeType: "image/jpeg",
      size: "10",
      alt: "غروب",
    });
    const post = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/media");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), input);
    }, media);
    assert.deepEqual(await createMedia(post, input), media);
    const patch = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/media/media-1");
      assert.equal(init?.method, "PATCH");
      assert.deepEqual(JSON.parse(String(init?.body)), { alt: "تازه" });
    }, media);
    assert.deepEqual(await patchMediaAlt(patch, "media-1", "تازه"), media);
    const del = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/media/media-1");
      assert.equal(init?.method, "DELETE");
    }, media);
    assert.deepEqual(await removeMedia(del, "media-1"), media);
  } finally {
    clearAdminTokens();
  }
});

test("settings users audits redirects and revalidation helpers use exact paths", async () => {
  clearAdminTokens();
  setAdminTokens(tokens);
  try {
    const settings = { name: "فیلم‌نما" } as SiteSettings;
    const settingsGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/settings");
      assert.equal(init?.method, "GET");
    }, settings);
    assert.deepEqual(await getSettings(settingsGet), settings);
    const settingsInput = buildSettingsPayload({
      name: "فیلم‌نما",
      description: "توضیح",
      contactPhone: "021",
      contactMobile: "",
      contactAddress: "",
      contactInstagram: "",
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      seoNoindex: false,
    });
    const settingsPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/settings");
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(body.name, "فیلم‌نما");
      assert.deepEqual(body.contact, { phone: "021" });
    }, settings);
    assert.deepEqual(await saveSettings(settingsPut, settingsInput), settings);

    const userPage = { items: [{ id: "user-1" }], nextCursor: "cursor-2" };
    const users = jsonFetcher((url, init) => {
      assert.equal(init?.method, "GET");
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.pathname, "/api/admin/users");
      assert.equal(parsed.searchParams.get("role"), "CONTENT_MANAGER");
      assert.equal(parsed.searchParams.get("active"), "true");
      assert.equal(parsed.searchParams.get("limit"), "5");
      assert.equal(parsed.searchParams.get("cursor"), "cursor-1");
    }, userPage);
    assert.deepEqual(
      await listUsers(users, { role: "CONTENT_MANAGER", active: true, limit: 5, cursor: "cursor-1" }),
      userPage,
    );
    const usersInactive = jsonFetcher((url) => {
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.searchParams.get("active"), "false");
    }, { items: [], nextCursor: null });
    assert.deepEqual(await listUsers(usersInactive, { active: false }), {
      items: [],
      nextCursor: null,
    });
    const accessRes = { id: "user-1", role: "BLOG_EDITOR", active: false };
    const access = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/users/user-1/access");
      assert.equal(init?.method, "PATCH");
      assert.deepEqual(JSON.parse(String(init?.body)), { role: "BLOG_EDITOR", active: false });
    }, accessRes);
    assert.deepEqual(
      await setUserAccess(access, "user-1", { role: "BLOG_EDITOR", active: false }),
      accessRes,
    );

    const auditPage = { items: [{ id: "audit-1" }], nextCursor: "cursor-2" };
    const audits = jsonFetcher((url, init) => {
      assert.equal(init?.method, "GET");
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.pathname, "/api/admin/audits");
      assert.equal(parsed.searchParams.get("entityType"), "Media");
      assert.equal(parsed.searchParams.get("entityId"), "media-1");
      assert.equal(parsed.searchParams.get("actorId"), "user-1");
      assert.equal(parsed.searchParams.get("limit"), "5");
      assert.equal(parsed.searchParams.get("cursor"), "cursor-1");
    }, auditPage);
    assert.deepEqual(
      await listAudits(audits, {
        entityType: "Media",
        entityId: "media-1",
        actorId: "user-1",
        limit: 5,
        cursor: "cursor-1",
      }),
      auditPage,
    );
    const redirectsPage = { items: [{ id: "redirect-1" }], nextCursor: null };
    const redirects = jsonFetcher((url, init) => {
      assert.equal(init?.method, "GET");
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.pathname, "/api/admin/redirects");
      assert.equal(parsed.searchParams.get("limit"), "5");
    }, redirectsPage);
    assert.deepEqual(await listRedirects(redirects, { limit: 5 }), redirectsPage);
    const revalidationPage = { items: [{ id: "outbox-1" }], nextCursor: null };
    const outbox = jsonFetcher((url, init) => {
      assert.equal(init?.method, "GET");
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.pathname, "/api/admin/revalidation");
      assert.equal(parsed.searchParams.get("pending"), "true");
      assert.equal(parsed.searchParams.get("limit"), "5");
    }, revalidationPage);
    assert.deepEqual(await listRevalidation(outbox, { pending: true, limit: 5 }), revalidationPage);
    const outboxAll = jsonFetcher((url) => {
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.searchParams.has("pending"), false);
    }, { items: [], nextCursor: null });
    assert.deepEqual(await listRevalidation(outboxAll), { items: [], nextCursor: null });
  } finally {
    clearAdminTokens();
  }
});

test("saveDepartment posts without id and puts without id in body", async () => {
  clearAdminTokens();
  setAdminTokens(tokens);
  try {
    const base = {
      slug: "cinema",
      label: "سینما",
      latin: "CINEMA",
      description: "توضیح",
      status: "PUBLISHED" as const,
      seo: {
        title: null,
        description: null,
        canonicalUrl: null,
        noindex: false,
      },
    };
    const created = { id: "dep-1", ...base } as Department;
    const post = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/departments");
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer access-1");
      assert.equal(new Headers(init?.headers).get("x-csrf-token"), "csrf-1");
      assert.equal("id" in (JSON.parse(String(init?.body)) as Record<string, unknown>), false);
    }, created);
    assert.deepEqual(await saveDepartment(post, base), created);
    const updated = { ...created, label: "تازه" };
    const put = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/departments/dep-1");
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.equal(body.label, "تازه");
    }, updated);
    assert.deepEqual(await saveDepartment(put, { ...base, id: "dep-1", label: "تازه" }), updated);
  } finally {
    clearAdminTokens();
  }
});

test("saveCourse posts without id and puts complete body with seo", async () => {
  clearAdminTokens();
  setAdminTokens(tokens);
  try {
    const base = buildCoursePayload({
      slug: "acting",
      departmentId: "dep-1",
      title: "بازیگری",
      latin: "ACTING",
      description: "توضیح",
      level: "مقدماتی",
      duration: "۴۸ جلسه",
      iconKey: "Drama",
      contentHtml: "<p>متن</p>",
      syllabusText: "تمرین",
      faq: [{ question: "پرسش", answer: "پاسخ" }],
      instructorIdsText: "ins-1",
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      status: "DRAFT",
    });
    const created = { id: "crs-1", ...base } as Course;
    const post = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/courses");
      assert.equal(init?.method, "POST");
    }, created);
    assert.deepEqual(await saveCourse(post, base), created);
    const put = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/courses/crs-1");
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.deepEqual(body.instructorIds, ["ins-1"]);
      assert.ok(typeof body.seo === "object" && body.seo !== null);
    }, created);
    assert.deepEqual(await saveCourse(put, { ...base, id: "crs-1" }), created);
  } finally {
    clearAdminTokens();
  }
});

test("listCourses filters by department on the client", async () => {
  const items = [
    { id: "c1", departmentId: "dep-1" },
    { id: "c2", departmentId: "dep-2" },
  ] as Course[];
  const fetcher = jsonFetcher((url, init) => {
    assert.equal(url, "/api/admin/courses");
    assert.equal(init?.method, "GET");
  }, { items });
  assert.equal((await listCourses(fetcher)).items.length, 2);
  assert.deepEqual((await listCourses(fetcher, "dep-1")).items.map((c) => c.id), ["c1"]);
  assert.deepEqual((await listCourses(fetcher, "")).items.length, 2);
});

test("listLeads passes cursor and filters through query and returns nextCursor", async () => {
  const page = { items: [{ id: "lead-1" }], nextCursor: "cursor-2" };
  const fetcher = jsonFetcher((url, init) => {
    assert.equal(init?.method, "GET");
    const parsed = new URL(url, "https://frontend.example");
    assert.equal(parsed.pathname, "/api/admin/leads");
    assert.equal(parsed.searchParams.get("status"), "NEW");
    assert.equal(parsed.searchParams.get("courseId"), "crs-1");
    assert.equal(parsed.searchParams.get("limit"), "5");
    assert.equal(parsed.searchParams.get("cursor"), "cursor-1");
  }, page);
  const result = await listLeads(fetcher, {
    status: "NEW",
    courseId: "crs-1",
    limit: 5,
    cursor: "cursor-1",
  });
  assert.deepEqual(result, page);
  const bare = jsonFetcher((url) => {
    assert.equal(url, "/api/admin/leads");
  }, { items: [], nextCursor: null });
  assert.deepEqual(await listLeads(bare), { items: [], nextCursor: null });
});

test("detail remove and lead status use exact proxy paths and verbs", async () => {
  const dep = { id: "dep-1" } as Department;
  const depGet = jsonFetcher((url, init) => {
    assert.equal(url, "/api/admin/departments/dep-1");
    assert.equal(init?.method, "GET");
  }, dep);
  assert.deepEqual(await getDepartment(depGet, "dep-1"), dep);
  const depDel = jsonFetcher((url, init) => {
    assert.equal(url, "/api/admin/departments/dep-1");
    assert.equal(init?.method, "DELETE");
  }, dep);
  assert.deepEqual(await removeDepartment(depDel, "dep-1"), dep);
  const course = { id: "crs-1" } as Course;
  const courseGet = jsonFetcher((url, init) => {
    assert.equal(url, "/api/admin/courses/crs-1");
    assert.equal(init?.method, "GET");
  }, course);
  assert.deepEqual(await getCourse(courseGet, "crs-1"), course);
  const courseDel = jsonFetcher((url, init) => {
    assert.equal(url, "/api/admin/courses/crs-1");
    assert.equal(init?.method, "DELETE");
  }, course);
  assert.deepEqual(await removeCourse(courseDel, "crs-1"), course);
  const deps = jsonFetcher((url, init) => {
    assert.equal(url, "/api/admin/departments");
    assert.equal(init?.method, "GET");
  }, { items: [dep] });
  assert.deepEqual(await listDepartments(deps), { items: [dep] });
  const statusRes = { id: "lead-1", status: "CONTACTED" };
  const patch = jsonFetcher((url, init) => {
    assert.equal(url, "/api/admin/leads/lead-1/status");
    assert.equal(init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(init?.body)), { status: "CONTACTED" });
  }, statusRes);
  assert.deepEqual(await setLeadStatus(patch, "lead-1", "CONTACTED"), statusRes);
});

test("instructor category tag and post helpers use exact proxy paths and verbs", async () => {
  clearAdminTokens();
  setAdminTokens(tokens);
  try {
    const instructor = { id: "ins-1" } as Instructor;
    const insList = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/instructors");
      assert.equal(init?.method, "GET");
    }, { items: [instructor] });
    assert.deepEqual(await listInstructors(insList), { items: [instructor] });
    const insGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/instructors/ins-1");
      assert.equal(init?.method, "GET");
    }, instructor);
    assert.deepEqual(await getInstructor(insGet, "ins-1"), instructor);
    const insBase = buildInstructorPayload({
      slug: "master",
      name: "استاد",
      bio: "توضیح",
      image: "",
      status: "DRAFT",
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      seoNoindex: false,
    });
    const insPost = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/instructors");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.ok(typeof body.seo === "object" && body.seo !== null);
    }, instructor);
    assert.deepEqual(await saveInstructor(insPost, insBase), instructor);
    const insPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/instructors/ins-1");
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.equal(body.slug, "master");
    }, instructor);
    assert.deepEqual(
      await saveInstructor(insPut, { ...insBase, id: "ins-1" }),
      instructor,
    );
    const insDel = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/instructors/ins-1");
      assert.equal(init?.method, "DELETE");
    }, instructor);
    assert.deepEqual(await removeInstructor(insDel, "ins-1"), instructor);

    const category = { id: "cat-1" } as Category;
    const catList = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/categories");
      assert.equal(init?.method, "GET");
    }, { items: [category] });
    assert.deepEqual(await listCategories(catList), { items: [category] });
    const catGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/categories/cat-1");
      assert.equal(init?.method, "GET");
    }, category);
    assert.deepEqual(await getCategory(catGet, "cat-1"), category);
    const catBase = buildCategoryPayload({ slug: "cinema", title: "سینما" });
    const catPost = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/categories");
      assert.equal(init?.method, "POST");
      assert.equal("id" in (JSON.parse(String(init?.body)) as Record<string, unknown>), false);
    }, category);
    assert.deepEqual(await saveCategory(catPost, catBase), category);
    const catPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/categories/cat-1");
      assert.equal(init?.method, "PUT");
    }, category);
    assert.deepEqual(await saveCategory(catPut, { ...catBase, id: "cat-1" }), category);
    const catDel = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/categories/cat-1");
      assert.equal(init?.method, "DELETE");
    }, category);
    assert.deepEqual(await removeCategory(catDel, "cat-1"), category);

    const tag = { id: "tag-1" } as Tag;
    const tagList = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/tags");
      assert.equal(init?.method, "GET");
    }, { items: [tag] });
    assert.deepEqual(await listTags(tagList), { items: [tag] });
    const tagGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/tags/tag-1");
      assert.equal(init?.method, "GET");
    }, tag);
    assert.deepEqual(await getTag(tagGet, "tag-1"), tag);
    const tagBase = buildTagPayload({ slug: "montage", title: "مونتاژ" });
    const tagPost = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/tags");
      assert.equal(init?.method, "POST");
      assert.equal("id" in (JSON.parse(String(init?.body)) as Record<string, unknown>), false);
    }, tag);
    assert.deepEqual(await saveTag(tagPost, tagBase), tag);
    const tagPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/tags/tag-1");
      assert.equal(init?.method, "PUT");
    }, tag);
    assert.deepEqual(await saveTag(tagPut, { ...tagBase, id: "tag-1" }), tag);
    const tagDel = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/tags/tag-1");
      assert.equal(init?.method, "DELETE");
    }, tag);
    assert.deepEqual(await removeTag(tagDel, "tag-1"), tag);

    const post = { id: "post-1" } as Post;
    const postList = jsonFetcher((url, init) => {
      assert.equal(init?.method, "GET");
      const parsed = new URL(url, "https://frontend.example");
      assert.equal(parsed.pathname, "/api/admin/posts");
      assert.equal(parsed.searchParams.get("category"), "cinema");
      assert.equal(parsed.searchParams.get("tag"), "montage");
      assert.equal(parsed.searchParams.get("limit"), "5");
      assert.equal(parsed.searchParams.get("cursor"), "cursor-1");
    }, { items: [post], nextCursor: "cursor-2" });
    assert.deepEqual(
      await listPosts(
        postList,
        { category: "cinema", tag: "montage", limit: 5, cursor: "cursor-1" },
      ),
      { items: [post], nextCursor: "cursor-2" },
    );
    const postBare = jsonFetcher((url) => {
      assert.equal(url, "/api/admin/posts");
    }, { items: [], nextCursor: null });
    assert.deepEqual(await listPosts(postBare), { items: [], nextCursor: null });
    const postGet = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/posts/post-1");
      assert.equal(init?.method, "GET");
    }, post);
    assert.deepEqual(await getPost(postGet, "post-1"), post);
    const postBase = buildPostPayload({
      slug: "p",
      title: "t",
      excerpt: "e",
      contentHtml: "<p>x</p>",
      categoryId: "",
      tagIdsText: "tag-1",
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      status: "DRAFT",
    });
    const postPost = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/posts");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.deepEqual(body.tagIds, ["tag-1"]);
    }, post);
    assert.deepEqual(await savePost(postPost, postBase), post);
    const postPut = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/posts/post-1");
      assert.equal(init?.method, "PUT");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal("id" in body, false);
      assert.ok(typeof body.seo === "object" && body.seo !== null);
    }, post);
    assert.deepEqual(await savePost(postPut, { ...postBase, id: "post-1" }), post);
    const postDel = jsonFetcher((url, init) => {
      assert.equal(url, "/api/admin/posts/post-1");
      assert.equal(init?.method, "DELETE");
    }, post);
    assert.deepEqual(await removePost(postDel, "post-1"), post);
  } finally {
    clearAdminTokens();
  }
});

test("post and course payloads normalize blank cover ids to null", () => {
  const basePost = {
    slug: "p",
    title: "t",
    excerpt: "e",
    contentHtml: "<p>x</p>",
    tagIdsText: "",
    seoTitle: "",
    seoDescription: "",
    seoCanonicalUrl: "",
    status: "DRAFT" as const,
  };
  assert.equal(buildPostPayload({ ...basePost, categoryId: "" }).coverMediaId, null);
  assert.equal(buildPostPayload({ ...basePost, coverMediaId: "  " }).coverMediaId, null);
  assert.equal(buildPostPayload({ ...basePost }).coverMediaId, null);
  assert.equal(buildPostPayload({ ...basePost, coverMediaId: " media-1 " }).coverMediaId, "media-1");
  const baseCourse = {
    slug: "c",
    departmentId: "d",
    title: "t",
    latin: "L",
    description: "desc",
    level: "lvl",
    duration: "dur",
    iconKey: "Drama" as const,
    contentHtml: "<p>x</p>",
    syllabusText: "",
    faq: [],
    instructorIdsText: "",
    seoTitle: "",
    seoDescription: "",
    seoCanonicalUrl: "",
    status: "DRAFT" as const,
  };
  assert.equal(buildCoursePayload({ ...baseCourse }).coverMediaId, null);
  assert.equal(buildCoursePayload({ ...baseCourse, coverMediaId: "" }).coverMediaId, null);
  assert.equal(buildCoursePayload({ ...baseCourse, coverMediaId: " media-9 " }).coverMediaId, "media-9");
  assert.equal(buildCoursePayload({ ...baseCourse }).customPath, null);
  assert.equal(buildCoursePayload({ ...baseCourse, customPath: "  " }).customPath, null);
  assert.equal(buildCoursePayload({ ...baseCourse, customPath: "/training-courses/فن-بیان/" }).customPath, "training-courses/فن-بیان");
});

test("upload pre-check rejects empty unknown-type and oversized files", () => {
  assert.equal(uploadFileError({ size: 0, type: "image/jpeg" }), "empty");
  assert.equal(uploadFileError({ size: -5, type: "image/jpeg" }), "empty");
  assert.equal(uploadFileError({ size: 10, type: "application/pdf" }), "unsupported_type");
  assert.equal(uploadFileError({ size: 10, type: "" }), "unsupported_type");
  assert.equal(uploadFileError({ size: 10, type: "image/gif" }), "unsupported_type");
  assert.equal(uploadFileError({ size: 12 * 1024 * 1024, type: "video/mp4" }), null);
  assert.equal(uploadFileError({ size: 12 * 1024 * 1024 + 1, type: "image/png" }), "too_large");
  for (const mime of ["image/jpeg", "image/png", "image/webp", "video/mp4"])
    assert.equal(uploadFileError({ size: 1024, type: mime }), null);
});

test("uploadMedia posts FormData without a content-type override", async () => {
  clearAdminTokens();
  setAdminTokens(tokens);
  try {
    const media = { id: "media-9", storageKey: "uploads/abc.jpg" } as Media;
    const file = new Blob(["bytes"], { type: "image/jpeg" });
    const fetcher = (async (url: string, init?: RequestInit) => {
      assert.equal(url, "/api/admin/media/upload/");
      assert.equal(init?.method, "POST");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.cache, "no-store");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer access-1");
      assert.equal(headers.get("x-csrf-token"), "csrf-1");
      assert.equal(headers.get("content-type"), null);
      assert.ok(init?.body instanceof FormData);
      const form = init?.body as FormData;
      assert.ok(form.get("file") instanceof Blob);
      assert.equal(form.get("alt"), "کاور");
      return Response.json(media, { status: 201 });
    }) as typeof fetch;
    assert.deepEqual(await uploadMedia(fetcher, file, "کاور"), media);
    const failing = (async () => Response.json({ error: "x" }, { status: 413 })) as typeof fetch;
    await assert.rejects(uploadMedia(failing, file, ""), /body_too_large/);
  } finally {
    clearAdminTokens();
  }
});
