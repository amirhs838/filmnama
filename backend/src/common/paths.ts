import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Editor-defined public URLs ("custom paths"), stored WITHOUT leading slash,
// e.g. "training-courses/فن-بیان". Served by the frontend catch-all route.

// First URL segments owned by the stack itself (static routes, hubs, API).
// A custom path starting with one of these would be shadowed and can never
// render, so it is rejected at write time with a 409.
export const RESERVED_FIRST_SEGMENTS = [
  'admin', 'api', 'courses', 'blog', 'instructors', 'gallery', 'works', 'search',
  'about', 'about-us', 'contact', 'contact-us', 'faq', 'professors', 'training-course',
  'استادها', 'ساخته-های-فیلم-نما', 'گالری-ویدیوهای-دورهها',
  // System-ish names that must never become content URLs (media API prefix,
  // settings singleton, admin subsections reachable without the admin prefix
  // in some deployments).
  'media', 'settings', 'leads', 'login', 'users', 'reports', 'departments',
  'categories', 'tags', 'posts', 'albums',
  'robots.txt', 'sitemap.xml', 'wp-sitemap.xml', 'icon.png', 'favicon.ico', '_next',
] as const;

const SEGMENT = '[A-Za-z0-9_\\u0600-\\u06FF.-]+';
const PATH_PATTERN = new RegExp(`^${SEGMENT}(?:/${SEGMENT}){0,4}$`);

/** First segments that can never host a custom path (stack-owned routes). */
export function isCustomFirstSegmentAllowed(path: string): boolean {
  const first = path.split('/')[0] ?? '';
  if (first === '.' || first === '..') return false;
  return !(RESERVED_FIRST_SEGMENTS as readonly string[]).includes(first.toLowerCase());
}

export function normalizeCustomPath(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') throw new BadRequestShape();
  const cleaned = raw.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
  if (!cleaned) return null;
  return cleaned;
}

export class BadRequestShape extends Error {}

export const customPathSchema = z.string().min(1).max(200).refine(
  (value) => PATH_PATTERN.test(value) && !value.split('/').some((segment) => segment === '.' || segment === '..'),
  'Invalid custom path',
).refine((value) => isCustomFirstSegmentAllowed(value), 'Custom path is reserved');

/** Optional custom path input: absent/blank becomes null (no custom URL). */
export const customPathInput = z.unknown().transform((value, ctx) => {
  let normalized: string | null;
  try {
    normalized = normalizeCustomPath(value);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid custom path' });
    return z.NEVER;
  }
  if (normalized === null) return null;
  const parsed = customPathSchema.safeParse(normalized);
  if (!parsed.success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error.issues[0]?.message ?? 'Invalid custom path' });
    return z.NEVER;
  }
  return parsed.data;
});

export type CustomPathOwner = 'course' | 'instructor' | 'post' | 'portfolioItem';

/**
 * Reject a custom path already taken by another entity, a CMS canonical path
 * concept, or a redirect row. Runs inside the caller's transaction.
 */
export async function assertCustomPathFree(
  tx: Prisma.TransactionClient,
  self: { owner: CustomPathOwner; id: string | null },
  path: string,
): Promise<void> {
  const full = `/${path}`;
  const redirect = await tx.redirect.findUnique({ where: { source: full }, select: { id: true } });
  if (redirect) throw new ConflictException('Custom path is reserved');
  const checks: Array<Promise<unknown>> = [
    tx.course.findFirst({ where: { customPath: path, ...(self.owner === 'course' && self.id ? { id: { not: self.id } } : {}) }, select: { id: true } }),
    tx.instructor.findFirst({ where: { customPath: path, ...(self.owner === 'instructor' && self.id ? { id: { not: self.id } } : {}) }, select: { id: true } }),
    tx.post.findFirst({ where: { customPath: path, ...(self.owner === 'post' && self.id ? { id: { not: self.id } } : {}) }, select: { id: true } }),
    tx.portfolioItem.findFirst({ where: { customPath: path, ...(self.owner === 'portfolioItem' && self.id ? { id: { not: self.id } } : {}) }, select: { id: true } }),
  ];
  const found = await Promise.all(checks);
  if (found.some(Boolean)) throw new ConflictException('Custom path is reserved');
}

/**
 * Keep the redirect table consistent when a custom path changes: the old
 * custom URL permanently points at the replacement (or nowhere when cleared).
 */
export async function syncCustomPathRedirect(
  tx: Prisma.TransactionClient,
  oldPath: string | null,
  newPath: string | null,
): Promise<Set<string>> {
  const paths = new Set<string>();
  if (oldPath === newPath) {
    if (newPath) paths.add(`/${newPath}`);
    return paths;
  }
  if (oldPath) {
    paths.add(`/${oldPath}`);
    await tx.redirect.upsert({
      where: { source: `/${oldPath}` },
      create: { source: `/${oldPath}`, destination: newPath ? `/${newPath}` : null },
      update: { destination: newPath ? `/${newPath}` : null },
    });
  }
  if (newPath) paths.add(`/${newPath}`);
  return paths;
}
