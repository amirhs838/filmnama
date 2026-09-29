import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { Config } from '../src/infrastructure/config';
import { Database, RedisStore } from '../src/infrastructure/infrastructure.module';
import { configureApp } from '../src/security/runtime';
import { RateLimiter, isPublicSearchPath, rateLimitScript } from '../src/security/rate-limiter';
import { hash } from '../src/common/validation';
import {
  PublicSearchController,
  SearchRepository,
  SearchService,
  normalizeSearchTerms,
  searchQuerySchema,
} from '../src/search/search.module';
import { testConfig } from './auth.fixture';

const past = new Date('2025-01-01T00:00:00Z');
const future = new Date('2027-01-01T00:00:00Z');

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  latin: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  deletedAt: Date | null;
  publishedAt: Date | null;
  department: { slug: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; deletedAt: Date | null; publishedAt: Date | null };
  coverMedia: { id: string; alt: string; deletedAt: Date | null } | null;
};

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  deletedAt: Date | null;
  publishedAt: Date | null;
  coverMedia: { id: string; alt: string; deletedAt: Date | null } | null;
};

type InstructorRow = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  deletedAt: Date | null;
};

function course(patch: Partial<CourseRow> & { id: string }): CourseRow {
  return {
    slug: patch.id,
    title: `Title ${patch.id}`,
    latin: `Latin ${patch.id}`,
    description: `Description ${patch.id}`,
    status: 'PUBLISHED',
    deletedAt: null,
    publishedAt: past,
    department: { slug: 'film', status: 'PUBLISHED', deletedAt: null, publishedAt: past },
    coverMedia: null,
    ...patch,
  } as CourseRow;
}

function post(patch: Partial<PostRow> & { id: string }): PostRow {
  return {
    slug: patch.id,
    title: `Title ${patch.id}`,
    excerpt: `Excerpt ${patch.id}`,
    status: 'PUBLISHED',
    deletedAt: null,
    publishedAt: past,
    coverMedia: null,
    ...patch,
  } as PostRow;
}

function instructor(patch: Partial<InstructorRow> & { id: string }): InstructorRow {
  return {
    slug: patch.id,
    name: `Name ${patch.id}`,
    bio: `Bio ${patch.id}`,
    status: 'PUBLISHED',
    deletedAt: null,
    ...patch,
  } as InstructorRow;
}

function containsInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// In-memory Prisma-like filtering that mirrors the repository's AND/OR +
// visibility semantics. It also lets tests assert the generated where shapes.
function matchesCourse(row: CourseRow, where: Prisma.CourseWhereInput): boolean {
  if (where.status !== undefined && row.status !== where.status) return false;
  if (where.deletedAt === null && row.deletedAt !== null) return false;
  const lte = (where.publishedAt as Prisma.DateTimeNullableFilter | undefined)?.lte;
  if (lte && (!row.publishedAt || row.publishedAt > lte)) return false;
  const dept = where.department as Prisma.DepartmentWhereInput | undefined;
  if (dept) {
    if (dept.status !== undefined && row.department.status !== dept.status) return false;
    if (dept.deletedAt === null && row.department.deletedAt !== null) return false;
    const deptLte = (dept.publishedAt as Prisma.DateTimeNullableFilter | undefined)?.lte;
    if (deptLte && (!row.department.publishedAt || row.department.publishedAt > deptLte)) return false;
  }
  const and = (where.AND as Array<{ OR: Array<Record<string, { contains: string; mode?: string }>> }> | undefined) ?? [];
  for (const termFilter of and) {
    const ors = termFilter.OR ?? [];
    // Each OR entry must use insensitive contains (Persian-friendly ILIKE).
    for (const entry of ors) {
      for (const value of Object.values(entry)) {
        assert.equal(value.mode, 'insensitive');
        assert.equal(typeof value.contains, 'string');
      }
    }
    const matched = ors.some((entry) => {
      if (entry.title) return containsInsensitive(row.title, entry.title.contains);
      if (entry.latin) return containsInsensitive(row.latin, entry.latin.contains);
      if (entry.description) return containsInsensitive(row.description, entry.description.contains);
      return false;
    });
    if (!matched) return false;
  }
  return true;
}

function matchesPost(row: PostRow, where: Prisma.PostWhereInput): boolean {
  if (where.status !== undefined && row.status !== where.status) return false;
  if (where.deletedAt === null && row.deletedAt !== null) return false;
  const lte = (where.publishedAt as Prisma.DateTimeNullableFilter | undefined)?.lte;
  if (lte && (!row.publishedAt || row.publishedAt > lte)) return false;
  const and = (where.AND as Array<{ OR: Array<Record<string, { contains: string; mode?: string }>> }> | undefined) ?? [];
  for (const termFilter of and) {
    const ors = termFilter.OR ?? [];
    for (const entry of ors) {
      for (const value of Object.values(entry)) assert.equal(value.mode, 'insensitive');
    }
    const matched = ors.some((entry) => {
      if (entry.title) return containsInsensitive(row.title, entry.title.contains);
      if (entry.excerpt) return containsInsensitive(row.excerpt, entry.excerpt.contains);
      return false;
    });
    if (!matched) return false;
  }
  return true;
}

function matchesInstructor(row: InstructorRow, where: Prisma.InstructorWhereInput): boolean {
  if (where.status !== undefined && row.status !== where.status) return false;
  if (where.deletedAt === null && row.deletedAt !== null) return false;
  const and = (where.AND as Array<{ OR: Array<Record<string, { contains: string; mode?: string }>> }> | undefined) ?? [];
  for (const termFilter of and) {
    const ors = termFilter.OR ?? [];
    for (const entry of ors) {
      for (const value of Object.values(entry)) assert.equal(value.mode, 'insensitive');
    }
    const matched = ors.some((entry) => {
      if (entry.name) return containsInsensitive(row.name, entry.name.contains);
      if (entry.bio) return containsInsensitive(row.bio, entry.bio.contains);
      return false;
    });
    if (!matched) return false;
  }
  return true;
}

async function fixture(state?: { courses: CourseRow[]; posts: PostRow[]; instructors: InstructorRow[] }) {
  const data = state ?? { courses: [], posts: [], instructors: [] };
  const calls: { kind: string; args: Prisma.CourseFindManyArgs | Prisma.PostFindManyArgs | Prisma.InstructorFindManyArgs }[] = [];
  const db = {
    course: {
      findMany: async (args: Prisma.CourseFindManyArgs) => {
        calls.push({ kind: 'course', args });
        assert.deepEqual(args.orderBy, [{ title: 'asc' }, { id: 'asc' }]);
        assert.ok(typeof args.take === 'number');
        // Parameterized only: no raw query fields.
        assert.equal((args as Record<string, unknown>)['queryRaw'], undefined);
        const rows = data.courses.filter((row) => matchesCourse(row, args.where ?? {}));
        rows.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.id < b.id ? -1 : 1));
        return rows.slice(0, args.take).map((row) => ({
          title: row.title,
          latin: row.latin,
          description: row.description,
          slug: row.slug,
          department: { slug: row.department.slug },
          coverMedia: row.coverMedia,
        }));
      },
    },
    post: {
      findMany: async (args: Prisma.PostFindManyArgs) => {
        calls.push({ kind: 'post', args });
        assert.deepEqual(args.orderBy, [{ title: 'asc' }, { id: 'asc' }]);
        const rows = data.posts.filter((row) => matchesPost(row, args.where ?? {}));
        rows.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.id < b.id ? -1 : 1));
        return rows.slice(0, args.take).map((row) => ({
          title: row.title,
          slug: row.slug,
          excerpt: row.excerpt,
          coverMedia: row.coverMedia,
        }));
      },
    },
    instructor: {
      findMany: async (args: Prisma.InstructorFindManyArgs) => {
        calls.push({ kind: 'instructor', args });
        assert.deepEqual(args.orderBy, [{ name: 'asc' }, { id: 'asc' }]);
        const rows = data.instructors.filter((row) => matchesInstructor(row, args.where ?? {}));
        rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1));
        return rows.slice(0, args.take).map((row) => ({ name: row.name, slug: row.slug, bio: row.bio }));
      },
    },
  };
  const module = await Test.createTestingModule({
    controllers: [PublicSearchController],
    providers: [SearchService, SearchRepository, { provide: Database, useValue: db }],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  const get = (path: string) => request(app.getHttpServer()).get(`/public/${path}`);
  return { app, db, calls, data, get, service: module.get(SearchService) };
}

test('strict validation rejects empty, overlong, unknown types and unknown keys', async () => {
  const f = await fixture({ courses: [], posts: [], instructors: [] });
  try {
    await f.get('search?q=hello').expect(200);
    await f.get('search?q=hello&types=courses').expect(200);
    await f.get('search?q=hello&types=courses,posts').expect(200);
    await f.get('search?q=hello&types=courses,posts,instructors').expect(200);
    await f.get('search?q=hello&limit=1').expect(200);
    await f.get(`search?q=${'a'.repeat(100)}`).expect(200);
    for (const path of [
      'search',
      'search?q=',
      'search?q=%20%20%20',
      `search?q=${'a'.repeat(101)}`,
      'search?q=hello&types=unknown',
      'search?q=hello&types=courses,unknown',
      'search?q=hello&types=',
      'search?q=hello&types=courses,',
      'search?q=hello&types=,courses',
      'search?q=hello&types=courses,,posts',
      'search?q=hello&types=COURSES',
      'search?q=hello&unknown=1',
      'search?q=hello&limit=0',
      'search?q=hello&limit=21',
      'search?q=hello&limit=abc',
      'search?q=hello&limit=1.5',
    ]) {
      const result = await f.get(path).expect(400);
      assert.equal(result.body.statusCode, 400);
      assert.equal(result.body.message, 'Invalid request');
    }
    // q is trimmed: padded spaces still valid, empty-after-trim rejected above.
    await f.get('search?q=%20%20hello%20%20').expect(200);
  } finally {
    await f.app.close();
  }
});

test('ZWNJ and whitespace normalization splits into max 5 AND terms', () => {
  assert.deepEqual(normalizeSearchTerms('hello'), ['hello']);
  assert.deepEqual(normalizeSearchTerms('  hello   world  '), ['hello', 'world']);
  assert.deepEqual(normalizeSearchTerms('a\u200Cb'), ['a', 'b']);
  assert.deepEqual(normalizeSearchTerms('می\u200Cخواهم'), ['می', 'خواهم']);
  assert.deepEqual(normalizeSearchTerms('می خواهم'), ['می', 'خواهم']);
  assert.deepEqual(normalizeSearchTerms('a\t\nb  c'), ['a', 'b', 'c']);
  assert.deepEqual(normalizeSearchTerms('   '), []);
  assert.deepEqual(normalizeSearchTerms('a b c d e f g'), ['a', 'b', 'c', 'd', 'e']);
  // Schema trims q before length checks.
  assert.equal(searchQuerySchema.safeParse({ q: '  hello  ' }).success, true);
  assert.equal(searchQuerySchema.safeParse({ q: '  hello  ' }).success && searchQuerySchema.parse({ q: '  hello  ' }).q, 'hello');
  assert.equal(searchQuerySchema.safeParse({ q: '   ' }).success, false);
  assert.equal(searchQuerySchema.safeParse({ q: '' }).success, false);
});

test('ZWNJ query matches space-separated content (Persian-friendly)', async () => {
  const f = await fixture({
    courses: [course({ id: 'c1', title: 'می خواهم', latin: 'x', description: 'y' })],
    posts: [],
    instructors: [],
  });
  try {
    const zwnj = await f.get(`search?q=${encodeURIComponent('می\u200Cخواهم')}&types=courses`).expect(200);
    assert.equal(zwnj.body.items.length, 1);
    assert.equal(zwnj.body.items[0].title, 'می خواهم');
    const space = await f.get(`search?q=${encodeURIComponent('می خواهم')}&types=courses`).expect(200);
    assert.equal(space.body.items.length, 1);
    // Single ZWNJ-only term normalizes in the same way as the spaced form.
    assert.deepEqual(normalizeSearchTerms('می\u200Cخواهم'), normalizeSearchTerms('می خواهم'));
  } finally {
    await f.app.close();
  }
});

test('AND across terms with OR across searchable fields', async () => {
  const f = await fixture({
    courses: [
      course({ id: 'c-both', title: 'Alpha', latin: 'Other', description: 'Beta' }),
      course({ id: 'c-one', title: 'Alpha', latin: 'Other', description: 'Other' }),
      course({ id: 'c-latin', title: 'Other', latin: 'LatinFoo', description: 'Other' }),
    ],
    posts: [
      post({ id: 'p-both', title: 'Gamma', excerpt: 'Delta' }),
      post({ id: 'p-one', title: 'Gamma', excerpt: 'Other' }),
    ],
    instructors: [instructor({ id: 'i-bio', name: 'Other', bio: 'SpecialBio' })],
  });
  try {
    // Each term must match somewhere (AND); a row with only one term is excluded.
    const both = await f.get(`search?q=${encodeURIComponent('Alpha Beta')}&types=courses`).expect(200);
    assert.deepEqual(
      both.body.items.map((item: { title: string }) => item.title),
      ['Alpha'],
    );
    assert.equal(both.body.items.length, 1);
    // OR across fields: latin-only hit counts.
    const latin = await f.get('search?q=LatinFoo&types=courses').expect(200);
    assert.equal(latin.body.items.length, 1);
    // Post OR: excerpt-only hit counts, but single-term-missing row excluded.
    const postBoth = await f.get(`search?q=${encodeURIComponent('Gamma Delta')}&types=posts`).expect(200);
    assert.equal(postBoth.body.items.length, 1);
    assert.equal(postBoth.body.items[0].title, 'Gamma');
    // Instructor OR across name/bio.
    const bio = await f.get('search?q=SpecialBio&types=instructors').expect(200);
    assert.equal(bio.body.items.length, 1);
    // Verify the generated where uses AND of ORs with insensitive contains.
    const courseCall = f.calls.find((call) => call.kind === 'course');
    assert.ok(courseCall);
    const and = ((courseCall.args.where as Prisma.CourseWhereInput).AND as unknown[]) ?? [];
    assert.ok(and.length >= 1);
  } finally {
    await f.app.close();
  }
});

test('visibility filtering excludes draft, archived, deleted and future rows', async () => {
  const f = await fixture({
    courses: [
      course({ id: 'c-visible', title: 'Visible Course' }),
      course({ id: 'c-draft', title: 'Visible Course', status: 'DRAFT' }),
      course({ id: 'c-archived', title: 'Visible Course', status: 'ARCHIVED' }),
      course({ id: 'c-deleted', title: 'Visible Course', deletedAt: new Date() }),
      course({ id: 'c-future', title: 'Visible Course', publishedAt: future }),
      course({ id: 'c-dept-draft', title: 'Visible Course', department: { slug: 'film', status: 'DRAFT', deletedAt: null, publishedAt: past } }),
    ],
    posts: [
      post({ id: 'p-visible', title: 'Visible Post' }),
      post({ id: 'p-draft', title: 'Visible Post', status: 'DRAFT' }),
      post({ id: 'p-archived', title: 'Visible Post', status: 'ARCHIVED' }),
      post({ id: 'p-deleted', title: 'Visible Post', deletedAt: new Date() }),
      post({ id: 'p-future', title: 'Visible Post', publishedAt: future }),
    ],
    instructors: [
      instructor({ id: 'i-visible', name: 'Visible Instructor' }),
      instructor({ id: 'i-draft', name: 'Visible Instructor', status: 'DRAFT' }),
      instructor({ id: 'i-archived', name: 'Visible Instructor', status: 'ARCHIVED' }),
      instructor({ id: 'i-deleted', name: 'Visible Instructor', deletedAt: new Date() }),
    ],
  });
  try {
    const courses = await f.get(`search?q=${encodeURIComponent('Visible Course')}&types=courses`).expect(200);
    assert.equal(courses.body.items.length, 1);
    assert.equal(courses.body.items[0].path, '/courses/film/c-visible');
    const posts = await f.get(`search?q=${encodeURIComponent('Visible Post')}&types=posts`).expect(200);
    assert.equal(posts.body.items.length, 1);
    assert.equal(posts.body.items[0].path, '/blog/p-visible');
    const instructors = await f.get(`search?q=${encodeURIComponent('Visible Instructor')}&types=instructors`).expect(200);
    assert.equal(instructors.body.items.length, 1);
    assert.equal(instructors.body.items[0].path, '/instructors/i-visible');
    // Every query reuses PUBLISHED + deletedAt null + publishedAt<=now.
    for (const call of f.calls) {
      const where = call.args.where as Record<string, unknown>;
      assert.equal(where.status, 'PUBLISHED');
      assert.equal(where.deletedAt, null);
      if (call.kind !== 'instructor') {
        assert.ok(((where.publishedAt as Prisma.DateTimeNullableFilter).lte as Date) instanceof Date);
      }
    }
  } finally {
    await f.app.close();
  }
});

test('kind ordering is courses, posts, instructors with title asc and overall limit slicing', async () => {
  const f = await fixture({
    courses: [
      course({ id: 'c2', slug: 'c2', title: 'B Course', latin: 'x', description: 'shared' }),
      course({ id: 'c1', slug: 'c1', title: 'A Course', latin: 'x', description: 'shared' }),
      course({ id: 'c3', slug: 'c3', title: 'C Course', latin: 'x', description: 'shared' }),
    ],
    posts: [
      post({ id: 'p2', slug: 'p2', title: 'B Post', excerpt: 'shared' }),
      post({ id: 'p1', slug: 'p1', title: 'A Post', excerpt: 'shared' }),
    ],
    instructors: [
      instructor({ id: 'i2', slug: 'i2', name: 'B Instructor', bio: 'shared' }),
      instructor({ id: 'i1', slug: 'i1', name: 'A Instructor', bio: 'shared' }),
    ],
  });
  try {
    const all = await f.get('search?q=shared&limit=20').expect(200);
    assert.deepEqual(
      all.body.items.map((item: { kind: string; title: string }) => `${item.kind}:${item.title}`),
      ['course:A Course', 'course:B Course', 'course:C Course', 'post:A Post', 'post:B Post', 'instructor:A Instructor', 'instructor:B Instructor'],
    );
    // Limit slices overall after kind-ordered concat (courses first).
    const limited = await f.get('search?q=shared&limit=2').expect(200);
    assert.deepEqual(
      limited.body.items.map((item: { kind: string; title: string }) => `${item.kind}:${item.title}`),
      ['course:A Course', 'course:B Course'],
    );
    const four = await f.get('search?q=shared&limit=4').expect(200);
    assert.deepEqual(
      four.body.items.map((item: { kind: string }) => item.kind),
      ['course', 'course', 'course', 'post'],
    );
    // Each kind fetches up to `limit` (documented cap: 3*limit max, sliced overall).
    for (const call of f.calls.filter((call) => JSON.stringify(call.args).includes('shared'))) {
      void call;
    }
    const takeCalls = f.calls.filter((call) => call.kind === 'course');
    assert.ok(takeCalls.every((call) => (call.args.take as number) <= 20));
    // Contract shape: kind/title/latin/excerpt/path/coverMedia.
    const item = all.body.items[0] as Record<string, unknown>;
    assert.deepEqual(Object.keys(item).sort(), ['coverMedia', 'excerpt', 'kind', 'latin', 'path', 'title'].sort());
    assert.equal(item.kind, 'course');
    assert.equal(item.path, '/courses/film/c1');
    const postItem = all.body.items.find((entry: { kind: string }) => entry.kind === 'post') as Record<string, unknown>;
    assert.equal(postItem.latin, null);
    assert.equal(postItem.path, '/blog/p1');
    const instructorItem = all.body.items.find((entry: { kind: string }) => entry.kind === 'instructor') as Record<string, unknown>;
    assert.equal(instructorItem.latin, null);
    assert.equal(instructorItem.coverMedia, null);
    assert.equal(instructorItem.path, '/instructors/i1');
    // types subset restricts kinds.
    const onlyPosts = await f.get('search?q=shared&types=posts&limit=20').expect(200);
    assert.ok(onlyPosts.body.items.every((entry: { kind: string }) => entry.kind === 'post'));
    // Default limit is 10 and default types is all three.
    const parsed = searchQuerySchema.parse({ q: 'hello' });
    assert.equal(parsed.limit, 10);
    assert.deepEqual(parsed.types, ['courses', 'posts', 'instructors']);
  } finally {
    await f.app.close();
  }
});

test('search sends no-store and is role-free without auth', async () => {
  const f = await fixture({ courses: [course({ id: 'c1', title: 'Hello' })], posts: [], instructors: [] });
  try {
    const result = await f.get('search?q=Hello').expect(200);
    assert.equal(result.headers['cache-control'], 'no-store');
    // No guards or roles on the public controller (role-free, no auth required).
    assert.equal(Reflect.getMetadata('__guards__', PublicSearchController), undefined);
    assert.equal(Reflect.getMetadata('roles', PublicSearchController), undefined);
    // Repeated reads hit the DB every time (no Redis caching for search).
    const before = f.calls.length;
    await f.get('search?q=Hello').expect(200);
    assert.equal(f.calls.length > before, true);
  } finally {
    await f.app.close();
  }
});

test('search throttle uses 60 per IP and 600 global budgets with hashed keys', async () => {
  const evalCalls: unknown[][] = [];
  const redis = { disabled: false, client: { eval: async (...args: unknown[]) => (evalCalls.push(args), [0, 0] as unknown) } } as unknown as RedisStore;
  const logger = { warn: () => undefined } as unknown as PinoLogger;
  const limiter = new RateLimiter(redis, logger);
  const headers = new Map<string, unknown>();
  const res = { setHeader: (key: string, value: unknown) => headers.set(key, value) } as unknown as import('express').Response;
  const ip = '203.0.113.7';
  await limiter.check({ path: '/api/v1/public/search', method: 'GET', ip } as unknown as import('express').Request, res);
  assert.equal(evalCalls.length, 1);
  const [script, count, ...rest] = evalCalls[0] as unknown[];
  assert.equal(script, rateLimitScript);
  assert.equal(count, 4);
  const keys = (rest as unknown[]).slice(0, 4) as string[];
  const args = (rest as unknown[]).slice(4) as number[];
  assert.deepEqual(keys.slice(0, 2), ['rate:{api}:global', `rate:{api}:ip:${hash(ip)}`]);
  assert.deepEqual(keys.slice(2), [`rate:{api}:search:${hash(ip)}`, 'rate:{api}:search-global']);
  assert.deepEqual(args, [3000, 60000, 120, 60000, 60, 60000, 600, 60000]);
  // Non-search paths do not include search keys.
  evalCalls.length = 0;
  await limiter.check({ path: '/api/v1/public/posts', method: 'GET', ip } as unknown as import('express').Request, res);
  assert.equal((evalCalls[0] as unknown[])[1], 2);
  // Search helper matches the exact public path (case-insensitive, trailing slash ok).
  assert.equal(isPublicSearchPath('/api/v1/public/search'), true);
  assert.equal(isPublicSearchPath('/api/v1/public/search/'), true);
  assert.equal(isPublicSearchPath('/API/V1/PUBLIC/SEARCH'), true);
  assert.equal(isPublicSearchPath('/api/v1/public/search?q=x'), false);
  assert.equal(isPublicSearchPath('/api/v1/public/posts'), false);
  assert.equal(isPublicSearchPath('/api/v1/public/search/extra'), false);
});

test('search throttle returns 429 with Retry-After and fails closed', async () => {
  const status = (code: number) => (error: unknown) => error instanceof HttpException && error.getStatus() === code;
  const headers = new Map<string, unknown>();
  const res = { setHeader: (key: string, value: unknown) => headers.set(key, value) } as unknown as import('express').Response;
  const denied = { disabled: false, client: { eval: async () => [1, 45000] } } as unknown as RedisStore;
  await assert.rejects(
    new RateLimiter(denied, { warn: () => undefined } as unknown as PinoLogger).check(
      { path: '/api/v1/public/search', method: 'GET', ip: '10.0.0.1' } as unknown as import('express').Request,
      res,
    ),
    status(429),
  );
  assert.equal(headers.get('Retry-After'), 45);
  const failing = { disabled: false, client: { eval: async () => { throw new Error('unavailable'); } } } as unknown as RedisStore;
  await assert.rejects(
    new RateLimiter(failing, { warn: () => undefined } as unknown as PinoLogger).check(
      { path: '/api/v1/public/search', method: 'GET', ip: '10.0.0.1' } as unknown as import('express').Request,
      res,
    ),
    status(503),
  );
  // Local (Redis disabled) fixed windows also enforce search budgets before validation.
  const local = { disabled: true, client: { eval: async () => { throw new Error('must not call Redis'); } } } as unknown as RedisStore;
  const localLimiter = new RateLimiter(local, { warn: () => undefined } as unknown as PinoLogger);
  const localRes = { setHeader: (key: string, value: unknown) => headers.set(key, value) } as unknown as import('express').Response;
  for (let i = 0; i < 60; i++) {
    await localLimiter.check({ path: '/api/v1/public/search', method: 'GET', ip: '10.0.0.9' } as unknown as import('express').Request, localRes);
  }
  await assert.rejects(
    localLimiter.check({ path: '/api/v1/public/search', method: 'GET', ip: '10.0.0.9' } as unknown as import('express').Request, localRes),
    status(429),
  );
});

test('full runtime serves public search with no-store without auth', async () => {
  const db = {
    course: {
      findMany: async () => [{ title: 'Runtime Hello', latin: 'Latin', description: 'Desc', slug: 'c1', department: { slug: 'film' }, coverMedia: null }],
    },
    post: { findMany: async () => [] },
    instructor: { findMany: async () => [] },
  };
  const redis = { client: { eval: async () => [0, 0] } };
  const { InfrastructureModule } = await import('../src/infrastructure/infrastructure.module');
  const { SecurityModule } = await import('../src/security/security.module');
  const module = await Test.createTestingModule({
    imports: [InfrastructureModule, SecurityModule],
    controllers: [PublicSearchController],
    providers: [SearchService, SearchRepository],
  })
    .overrideProvider(Config)
    .useValue(testConfig())
    .overrideProvider(Database)
    .useValue(db)
    .overrideProvider(RedisStore)
    .useValue(redis)
    .compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  try {
    const result = await request(app.getHttpServer()).get('/api/v1/public/search?q=Runtime').expect(200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.body.items.length, 1);
    assert.equal(result.body.items[0].path, '/courses/film/c1');
  } finally {
    await app.close();
  }
});
