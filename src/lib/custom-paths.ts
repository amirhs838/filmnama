import "server-only";
import { backendUrl } from "./content-config";
import { isCustomUrlPath, record } from "./content-contract";

export type CustomPathKind = "course" | "post" | "instructor" | "work";

export interface CustomPathResolution {
  kind: CustomPathKind;
  department: string | null;
  slug: string;
}

function parseResolution(value: unknown): CustomPathResolution {
  const v = record(value);
  const kind = v.kind;
  if (kind !== "course" && kind !== "post" && kind !== "instructor" && kind !== "work") throw new Error("Invalid path resolution");
  const slug = v.slug;
  if (typeof slug !== "string" || slug.length < 1 || slug.length > 80) throw new Error("Invalid path resolution");
  const department = v.department;
  if (kind === "course") {
    if (typeof department !== "string" || department.length < 1) throw new Error("Invalid path resolution");
    return { kind, department, slug };
  }
  return { kind, department: null, slug };
}

/**
 * Resolve an editor-defined custom path (e.g. "training-courses/فن-بیان")
 * to its owning published entity. Returns null when the shape is invalid
 * or nothing published owns the path.
 */
export async function resolveCustomPath(segments: string[]): Promise<CustomPathResolution | null> {
  const path = `/${segments.map((s) => decodeURIComponent(s)).join("/")}/`;
  if (!isCustomUrlPath(path)) return null;
  const url = new URL("public/paths/resolve", backendUrl());
  url.searchParams.set("path", path.replace(/^\/|\/$/g, ""));
  try {
    const response = await fetch(url, { next: { revalidate: 3600 }, redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error();
    return parseResolution(await response.json());
  } catch {
    throw new Error("Course content is temporarily unavailable");
  }
}
