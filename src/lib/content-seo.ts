import "server-only";
import type { Metadata } from "next";
import { contentSource } from "./content-config";
import type { CourseDto } from "./content-contract";

export function siteOrigin(): string {
  const value = process.env.SITE_URL ?? (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("SITE_URL must be configured"); }
  if (!["https:", "http:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Invalid SITE_URL origin");
  return url.origin;
}

export function canonicalUrl(path: string, override?: string | null): string {
  const origin = siteOrigin();
  if (override) {
    try {
      const url = new URL(override, origin);
      if (url.origin === origin && !url.username && !url.password && !url.search && !url.hash) return url.href;
    } catch {}
  }
  return new URL(path, origin).href;
}

/**
 * When an entity owns an editor-defined custom path and no explicit SEO
 * canonical is set, the canonical URL follows the custom path so the CMS
 * address and the custom address never compete as duplicates.
 */
export function withCustomCanonical(meta: Metadata, customPath: string | null | undefined, seoCanonical?: string | null): Metadata {
  if (!customPath || seoCanonical) return meta;
  return { ...meta, alternates: { canonical: canonicalUrl(`/${customPath}/`) } };
}

export function contentMetadata(title: string, description: string, path: string, seo?: CourseDto["seo"], images?: string[]): Metadata {
  const noindex = contentSource() === "mock" || seo?.noindex === true;
  return {
    title: seo?.title ? { absolute: seo.title } : title,
    description: seo?.description || description,
    alternates: { canonical: canonicalUrl(path, seo?.canonicalUrl) },
    robots: { index: !noindex, follow: !noindex },
    ...(images && images.length > 0
      ? { openGraph: { images: images.map((url) => ({ url })) } }
      : {}),
  };
}
