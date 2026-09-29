import { Controller, Get, Header, Injectable, Module, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { SchemaPipe } from '../common/validation';
import { Database } from '../infrastructure/infrastructure.module';

// Public search caching choice: no Redis caching. Search is derived from live
// catalog/blog/instructor rows and must reflect publishes immediately; it also
// has high cardinality (free-text q x types x limit) with low hit rate, so a
// versioned cache like catalog would add invalidation complexity for no benefit.
// All responses send `Cache-Control: no-store` explicitly, and
// src/security/runtime.ts also forces no-store for /api/v1/public/search.
// Revalidation: none (search is derived; item pages revalidate via their own
// content revisions).
//
// Total-work cap: `limit` applies overall. Each kind fetches up to `limit` rows
// (parameterized Prisma queries, no raw SQL), then results are concatenated in
// canonical kind order (courses, posts, instructors) with title-asc within kind
// and sliced to `limit`. Worst case is 3*limit rows scanned (max 60).

export const SEARCH_TYPES = ['courses', 'posts', 'instructors'] as const;
export type SearchTypeParam = (typeof SEARCH_TYPES)[number];

const searchRawSchema = z
  .object({
    q: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(100)),
    types: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();

export const searchQuerySchema = searchRawSchema.transform((value, ctx) => {
  let types: SearchTypeParam[];
  if (value.types === undefined) {
    types = [...SEARCH_TYPES];
  } else {
    const parts = value.types.split(',');
    const seen = new Set<SearchTypeParam>();
    for (const raw of parts) {
      const part = raw.trim();
      if ((SEARCH_TYPES as readonly string[]).includes(part)) {
        seen.add(part as SearchTypeParam);
      } else {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid request' });
        return z.NEVER;
      }
    }
    if (seen.size === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid request' });
      return z.NEVER;
    }
    types = SEARCH_TYPES.filter((kind) => seen.has(kind));
  }
  return { q: value.q, types, limit: value.limit };
});

export type SearchInput = z.infer<typeof searchQuerySchema>;

/**
 * Persian-friendly normalization: trim, replace ZWNJ (U+200C) with a space,
 * collapse all whitespace runs, split into terms, cap at 5. Each term must
 * match (AND) while fields within a term match with OR. Using a space split
 * after ZWNJ replacement means "می‌خواهم" behaves like "می خواهم" (two AND
 * terms), which is the contract's "replace ZWNJ with space" option.
 */
export function normalizeSearchTerms(input: string): string[] {
  const replaced = input.replace(/\u200C/g, ' ');
  const collapsed = replaced.trim().replace(/\s+/g, ' ');
  if (!collapsed) return [];
  return collapsed.split(' ').filter((term) => term.length > 0).slice(0, 5);
}

const courseSearchSelect = {
  title: true,
  latin: true,
  description: true,
  slug: true,
  department: { select: { slug: true } },
  coverMedia: { select: { id: true, alt: true, deletedAt: true } },
} satisfies Prisma.CourseSelect;

const postSearchSelect = {
  title: true,
  slug: true,
  excerpt: true,
  coverMedia: { select: { id: true, alt: true, deletedAt: true } },
} satisfies Prisma.PostSelect;

const instructorSearchSelect = {
  name: true,
  slug: true,
  bio: true,
} satisfies Prisma.InstructorSelect;

type CourseSearchRow = Prisma.CourseGetPayload<{ select: typeof courseSearchSelect }>;
type PostSearchRow = Prisma.PostGetPayload<{ select: typeof postSearchSelect }>;
type InstructorSearchRow = Prisma.InstructorGetPayload<{ select: typeof instructorSearchSelect }>;

function courseWhere(terms: string[], now: Date): Prisma.CourseWhereInput {
  return {
    status: 'PUBLISHED',
    deletedAt: null,
    publishedAt: { lte: now },
    department: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now } },
    ...(terms.length
      ? {
          AND: terms.map((term) => ({
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { latin: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
            ],
          })),
        }
      : {}),
  };
}

function postWhere(terms: string[], now: Date): Prisma.PostWhereInput {
  return {
    status: 'PUBLISHED',
    deletedAt: null,
    publishedAt: { lte: now },
    ...(terms.length
      ? {
          AND: terms.map((term) => ({
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { excerpt: { contains: term, mode: 'insensitive' } },
            ],
          })),
        }
      : {}),
  };
}

function instructorWhere(terms: string[]): Prisma.InstructorWhereInput {
  return {
    status: 'PUBLISHED',
    deletedAt: null,
    ...(terms.length
      ? {
          AND: terms.map((term) => ({
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { bio: { contains: term, mode: 'insensitive' } },
            ],
          })),
        }
      : {}),
  };
}

function coverDto(cover: { id: string; alt: string; deletedAt: Date | null } | null) {
  if (!cover || cover.deletedAt) return null;
  return { id: cover.id, url: `/api/v1/public/media/${cover.id}/file`, alt: cover.alt };
}

function courseItem(row: CourseSearchRow) {
  const cover = (row as unknown as { coverMedia?: { id: string; alt: string; deletedAt: Date | null } | null }).coverMedia ?? null;
  return {
    kind: 'course' as const,
    title: row.title,
    latin: row.latin || null,
    excerpt: row.description || null,
    path: `/courses/${row.department.slug}/${row.slug}`,
    coverMedia: coverDto(cover),
  };
}

function postItem(row: PostSearchRow) {
  const cover = (row as unknown as { coverMedia?: { id: string; alt: string; deletedAt: Date | null } | null }).coverMedia ?? null;
  return {
    kind: 'post' as const,
    title: row.title,
    latin: null,
    excerpt: row.excerpt || null,
    path: `/blog/${row.slug}`,
    coverMedia: coverDto(cover),
  };
}

function instructorItem(row: InstructorSearchRow) {
  return {
    kind: 'instructor' as const,
    title: row.name,
    latin: null,
    excerpt: row.bio || null,
    path: `/instructors/${row.slug}`,
    coverMedia: null,
  };
}

@Injectable()
export class SearchRepository {
  constructor(private readonly db: Database) {}
  searchCourses(terms: string[], now: Date, take: number) {
    return this.db.course.findMany({
      where: courseWhere(terms, now),
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      take,
      select: courseSearchSelect,
    });
  }
  searchPosts(terms: string[], now: Date, take: number) {
    return this.db.post.findMany({
      where: postWhere(terms, now),
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      take,
      select: postSearchSelect,
    });
  }
  searchInstructors(terms: string[], take: number) {
    return this.db.instructor.findMany({
      where: instructorWhere(terms),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take,
      select: instructorSearchSelect,
    });
  }
}

@Injectable()
export class SearchService {
  constructor(private readonly repo: SearchRepository) {}
  async search(input: SearchInput) {
    const terms = normalizeSearchTerms(input.q);
    if (terms.length === 0) return { items: [] };
    const now = new Date();
    const take = input.limit;
    const wanted = new Set<SearchTypeParam>(input.types);
    const [courses, posts, instructors] = await Promise.all([
      wanted.has('courses') ? this.repo.searchCourses(terms, now, take) : Promise.resolve([] as CourseSearchRow[]),
      wanted.has('posts') ? this.repo.searchPosts(terms, now, take) : Promise.resolve([] as PostSearchRow[]),
      wanted.has('instructors') ? this.repo.searchInstructors(terms, take) : Promise.resolve([] as InstructorSearchRow[]),
    ]);
    const items = [...courses.map(courseItem), ...posts.map(postItem), ...instructors.map(instructorItem)].slice(0, take);
    return { items };
  }
}

class SearchCoverMediaDto {
  id!: string;
  url!: string;
  alt!: string;
}

class SearchItemDto {
  kind!: string;
  title!: string;
  latin!: string | null;
  excerpt!: string | null;
  path!: string;
  coverMedia!: SearchCoverMediaDto | null;
}

class SearchListDto {
  items!: SearchItemDto[];
}

@ApiTags('public-search')
@Controller('public')
export class PublicSearchController {
  constructor(private readonly search: SearchService) {}
  @Get('search')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Trimmed free-text query, 1..100 chars after trim' })
  @ApiQuery({ name: 'types', required: false, type: String, description: 'Comma subset of courses,posts,instructors (default all)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Overall result cap 1..20 (default 10)' })
  @ApiOkResponse({ type: SearchListDto })
  run(@Query(new SchemaPipe(searchQuerySchema)) query: SearchInput) {
    return this.search.search(query);
  }
}

@Module({ controllers: [PublicSearchController], providers: [SearchRepository, SearchService], exports: [SearchService] })
export class SearchModule {}
