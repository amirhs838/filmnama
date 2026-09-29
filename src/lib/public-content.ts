import "server-only";
import { cache } from "react";
import { backendUrl, contentSource } from "./content-config";
import {
  isSlug,
  normalizeSearchLimit,
  normalizeSearchQuery,
  normalizeSearchTypesParam,
  parseAlbumDetail,
  parseAlbums,
  parseCategories,
  parseInstructor,
  parseInstructors,
  parsePost,
  parsePostPage,
  parseSearchPage,
  parseSettings,
  parseTags,
  parseWork,
  parseWorks,
  type AlbumDetailDto,
  type AlbumDto,
  type BlogTaxonomyDto,
  type InstructorDto,
  type PostDto,
  type SearchItemDto,
  type SettingsDto,
  type WorkDto,
} from "./content-contract";

async function fetchJson(path: string, tag: string): Promise<{ status: number; json: unknown } | null> {
  const url = new URL(path, backendUrl());
  try {
    const response = await fetch(url, {
      next: { revalidate: 3600, tags: [tag] },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return { status: response.status, json: await response.json() };
  } catch {
    return null;
  }
}

async function fetchOne<T>(path: string, tag: string, parse: (value: unknown) => T): Promise<T | null> {
  const result = await fetchJson(path, tag);
  if (!result) return null;
  try {
    return parse(result.json);
  } catch {
    return null;
  }
}

const mockInstructorFallback: InstructorDto[] = [
  { id: "mock", slug: "mock", name: "", bio: "", image: null, customPath: null, updatedAt: "2026-01-01T00:00:00.000Z" },
];
void mockInstructorFallback;

async function mockInstructors(): Promise<InstructorDto[]> {
  const { instructors } = await import("@/data/instructors");
  return instructors
    .filter((person) => isSlug(person.id))
    .map((person) => ({
      id: person.id.slice(0, 100),
      slug: person.id,
      name: person.name.slice(0, 200),
      bio: person.bio.slice(0, 5000),
      image: typeof person.image === "string" && person.image.length <= 500 ? person.image : null,
      customPath: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
}

export const getInstructors = cache(async (): Promise<InstructorDto[]> => {
  if (contentSource() === "mock") return mockInstructors();
  backendUrl();
  const result = await fetchJson("public/instructors", "instructors");
  if (!result) return [];
  try {
    return parseInstructors(result.json);
  } catch {
    return [];
  }
});

export const getInstructor = cache(async (slugValue: string): Promise<InstructorDto | null> => {
  if (!isSlug(slugValue)) return null;
  if (contentSource() === "mock") return (await mockInstructors()).find((item) => item.slug === slugValue) ?? null;
  backendUrl();
  const item = await fetchOne(`public/instructors/${slugValue}`, "instructors", parseInstructor);
  return item && item.slug === slugValue ? item : null;
});

export const getPosts = cache(async (filters?: { category?: string; tag?: string }): Promise<PostDto[]> => {
  const category = filters?.category;
  const tag = filters?.tag;
  if (category !== undefined && !isSlug(category)) return [];
  if (tag !== undefined && !isSlug(tag)) return [];
  if (contentSource() === "mock") return [];
  backendUrl();
  const items: PostDto[] = [];
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (category) query.set("category", category);
    if (tag) query.set("tag", tag);
    if (cursor) query.set("cursor", cursor);
    const result = await fetchJson(`public/posts?${query}`, "blog");
    if (!result) return items.length ? items : [];
    let page: { items: PostDto[]; nextCursor: string | null };
    try {
      page = parsePostPage(result.json);
    } catch {
      return items.length ? items : [];
    }
    for (const item of page.items) {
      if ((category && item.category !== category) || seenIds.has(item.id)) return items;
      seenIds.add(item.id);
      items.push(item);
    }
    cursor = page.nextCursor;
    if (cursor) {
      if (seenCursors.has(cursor) || seenCursors.size >= 100) return items;
      seenCursors.add(cursor);
    }
  } while (cursor);
  return items;
});

export const getPost = cache(async (slugValue: string): Promise<PostDto | null> => {
  if (!isSlug(slugValue)) return null;
  if (contentSource() === "mock") return null;
  backendUrl();
  const item = await fetchOne(`public/posts/${slugValue}`, "blog", parsePost);
  return item && item.slug === slugValue ? item : null;
});

export const getCategories = cache(async (): Promise<BlogTaxonomyDto[]> => {
  if (contentSource() === "mock") return [];
  backendUrl();
  const result = await fetchJson("public/categories", "blog");
  if (!result) return [];
  try {
    return parseCategories(result.json);
  } catch {
    return [];
  }
});

export const getTags = cache(async (): Promise<BlogTaxonomyDto[]> => {
  if (contentSource() === "mock") return [];
  backendUrl();
  const result = await fetchJson("public/tags", "blog");
  if (!result) return [];
  try {
    return parseTags(result.json);
  } catch {
    return [];
  }
});

export const getAlbums = cache(async (): Promise<AlbumDto[]> => {
  if (contentSource() === "mock") return [];
  backendUrl();
  const result = await fetchJson("public/albums", "gallery");
  if (!result) return [];
  try {
    return parseAlbums(result.json);
  } catch {
    return [];
  }
});

export const getAlbum = cache(async (slugValue: string): Promise<AlbumDetailDto | null> => {
  if (!isSlug(slugValue)) return null;
  if (contentSource() === "mock") return null;
  backendUrl();
  const item = await fetchOne(`public/albums/${slugValue}`, "gallery", parseAlbumDetail);
  return item && item.slug === slugValue ? item : null;
});

export const getWorks = cache(async (filters?: { category?: string }): Promise<WorkDto[]> => {
  const category = filters?.category;
  if (category !== undefined && (typeof category !== "string" || !category.trim() || category.length > 100)) return [];
  if (contentSource() === "mock") return [];
  backendUrl();
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  const suffix = query.toString();
  const result = await fetchJson(`public/works${suffix ? `?${suffix}` : ""}`, "works");
  if (!result) return [];
  try {
    const items = parseWorks(result.json);
    return category ? items.filter((item) => item.category === category) : items;
  } catch {
    return [];
  }
});

export const getWork = cache(async (slugValue: string): Promise<WorkDto | null> => {
  if (!isSlug(slugValue)) return null;
  if (contentSource() === "mock") return null;
  backendUrl();
  const item = await fetchOne(`public/works/${slugValue}`, "works", parseWork);
  return item && item.slug === slugValue ? item : null;
});

export const getSettings = cache(async (): Promise<SettingsDto | null> => {
  if (contentSource() === "mock") return null;
  backendUrl();
  return fetchOne("public/settings", "settings", parseSettings);
});

export async function getSearch(
  q: unknown,
  options?: { types?: string | string[]; limit?: number },
): Promise<SearchItemDto[]> {
  const query = normalizeSearchQuery(q);
  if (query === null) return [];
  const types = normalizeSearchTypesParam(options?.types);
  if (types === null) return [];
  const limit = normalizeSearchLimit(options?.limit);
  if (contentSource() === "mock") return [];
  const url = new URL("public/search", backendUrl());
  url.searchParams.set("q", query);
  if (types !== undefined) url.searchParams.set("types", types);
  if (limit !== undefined) url.searchParams.set("limit", String(limit));
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    return parseSearchPage(await response.json()).items;
  } catch {
    return [];
  }
}
