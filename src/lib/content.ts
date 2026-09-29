import "server-only";
import { cache } from "react";
import { backendUrl, contentSource } from "./content-config";
import { isSlug, parseCourse, parseCoursePage, parseDepartment, parseDepartments, parseRedirect, type CourseDto } from "./content-contract";

async function request<T>(path: string, parse: (value: unknown) => T, allowMissing = false): Promise<T | null> {
  const url = new URL(path, backendUrl());
  try {
    const response = await fetch(url, { next: { revalidate: 3600, tags: ["courses"] }, redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error();
    return parse(await response.json());
  } catch {
    throw new Error("Course content is temporarily unavailable");
  }
}

export const getDepartments = cache(async () => {
  if (contentSource() === "mock") return (await import("./mock-content")).mockDepartments;
  return (await request("public/departments", parseDepartments))!;
});

export const getDepartment = cache(async (slug: string) => {
  if (!isSlug(slug)) return null;
  if (contentSource() === "mock") return (await getDepartments()).find((item) => item.slug === slug) ?? null;
  const item = await request(`public/departments/${slug}`, parseDepartment, true);
  if (item && item.slug !== slug) throw new Error("Invalid department response");
  return item;
});

export const getCourses = cache(async (department?: string): Promise<CourseDto[]> => {
  if (department !== undefined && !isSlug(department)) return [];
  if (contentSource() === "mock") {
    const { mockCourses } = await import("./mock-content");
    return department ? mockCourses.filter((item) => item.department === department) : mockCourses;
  }
  const items: CourseDto[] = [];
  const seen = new Set<string>();
  const ids = new Set<string>();
  const paths = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (department) query.set("department", department);
    if (cursor) query.set("cursor", cursor);
    const page = (await request(`public/courses?${query}`, parseCoursePage))!;
    for (const item of page.items) {
      const path = `${item.department}/${item.slug}`;
      if ((department && item.department !== department) || ids.has(item.id) || paths.has(path)) throw new Error("Invalid course listing");
      ids.add(item.id);
      paths.add(path);
      items.push(item);
    }
    cursor = page.nextCursor;
    if (cursor) {
      if (seen.has(cursor) || seen.size >= 100) throw new Error("Invalid course pagination");
      seen.add(cursor);
    }
  } while (cursor);
  return items;
});

export const getCourse = cache(async (department: string, slug: string) => {
  if (!isSlug(department) || !isSlug(slug)) return null;
  if (contentSource() === "mock") return (await getCourses(department)).find((item) => item.slug === slug) ?? null;
  const item = await request(`public/courses/${department}/${slug}`, parseCourse, true);
  if (item && (item.department !== department || item.slug !== slug)) throw new Error("Invalid course response");
  return item;
});

export async function getRedirect(path: string): Promise<string | null> {
  if (contentSource() === "mock") return null;
  const query = new URLSearchParams({ path });
  return request(`public/redirects?${query}`, parseRedirect);
}
