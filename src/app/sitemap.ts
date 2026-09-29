import type { MetadataRoute } from "next";
import { getCourses, getDepartments } from "@/lib/content";
import { getAlbums, getInstructors, getPosts, getWorks } from "@/lib/public-content";
import {
  albumPath,
  buildSitemapEntries,
  coursePath,
  instructorPath,
  postPath,
  workPath,
  type SitemapSourceItem,
} from "@/lib/content-contract";
import { siteOrigin } from "@/lib/content-seo";

export const revalidate = 3600;

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const [departments, courses, posts, instructors, albums, works] = await Promise.all([
    safe(() => getDepartments(), []),
    safe(() => getCourses(), []),
    safe(() => getPosts(), []),
    safe(() => getInstructors(), []),
    safe(() => getAlbums(), []),
    safe(() => getWorks(), []),
  ]);

  const items: SitemapSourceItem[] = [
    { path: "/" },
    { path: "/about/" },
    { path: "/contact/" },
    { path: "/about-us/" },
    { path: "/contact-us/" },
    { path: "/faq/" },
    { path: "/training-course/" },
    { path: "/professors/" },
    { path: "/استادها/" },
    { path: "/ساخته-های-فیلم-نما/" },
    { path: "/گالری-ویدیوهای-دورهها/" },
    { path: "/courses/" },
    { path: "/blog/" },
    { path: "/instructors/" },
    { path: "/gallery/" },
    { path: "/works/" },
    ...departments.map((item) => ({ path: `/courses/${item.slug}/`, updatedAt: item.updatedAt })),
    // Entities with an editor-defined custom path are listed under that URL.
    ...courses.map((item) => ({
      path: item.customPath ? `/${item.customPath}/` : coursePath(item),
      updatedAt: item.updatedAt,
      publishedAt: item.publishedAt,
    })),
    ...posts.map((item) => ({
      path: item.customPath ? `/${item.customPath}/` : postPath(item),
      updatedAt: item.updatedAt,
      publishedAt: item.publishedAt,
    })),
    ...instructors.map((item) => ({ path: item.customPath ? `/${item.customPath}/` : instructorPath(item), updatedAt: item.updatedAt })),
    ...albums.map((item) => ({ path: albumPath(item), updatedAt: item.updatedAt })),
    ...works.map((item) => ({ path: item.customPath ? `/${item.customPath}/` : workPath(item), updatedAt: item.updatedAt })),
  ];

  return buildSitemapEntries(origin, items);
}
