import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { CatalogCache, CatalogController, CatalogRepository, CatalogService } from '../src/catalog/catalog.module';
import { Database, RedisStore } from '../src/infrastructure/infrastructure.module';

const updatedAt = new Date('2026-01-01T00:00:00Z');
const department = { id: 'cmf0000000000000000000001', slug: 'film', label: 'Film', latin: 'Film', description: '', updatedAt, status: 'PUBLISHED', deletedAt: null, publishedAt: updatedAt };
const course = { id: 'cmf0000000000000000000002', slug: 'acting', title: 'Acting', latin: 'Acting', department, description: '', level: 'Beginner', duration: '10h', iconKey: 'Drama', contentHtml: '<p>Acting</p>', syllabus: ['Basics'], faq: [{ question: 'When?', answer: 'Now', position: 0 }], instructors: [{ instructor: { id: 'teacher', slug: 'teacher', name: 'Teacher', bio: '', image: null, deletedAt: null } }], seoTitle: null, seoDescription: null, canonicalUrl: null, noindex: false, updatedAt, publishedAt: updatedAt, status: 'PUBLISHED', deletedAt: null };
async function fixture(ids = [course.id, 'cmf0000000000000000000003']) {
  const calls: Prisma.CourseFindManyArgs[] = [];
  const filters: unknown[] = [];
  const redirects = new Map<string, string | null>();
  const state = { version: 1, revisionReads: 0, department: structuredClone(department), courses: ids.map((id) => ({ ...structuredClone(course), id })) };
  const entries = new Map<string, { value: string; expiresAt: number }>();
  const reads: string[] = [];
  const writes: { key: string; ttl: number }[] = [];
  const deletes: string[] = [];
  const redis = { client: {
    get: async (key: string) => {
      reads.push(key);
      const entry = entries.get(key);
      return entry && entry.expiresAt > Date.now() ? entry.value : null;
    },
    set: async (key: string, value: string, mode: string, ttl: number) => {
      assert.equal(mode, 'EX');
      writes.push({ key, ttl });
      entries.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      return 'OK';
    },
    del: async (key: string) => { deletes.push(key); return Number(entries.delete(key)); },
  } };
  const matches = (row: typeof department | typeof course, where: Prisma.CourseWhereInput | Prisma.DepartmentWhereInput = {}) => {
    const until = (where.publishedAt as Prisma.DateTimeNullableFilter | undefined)?.lte;
    return (!where.status || row.status === where.status) && (where.deletedAt !== null || row.deletedAt === null)
      && (!until || (row.publishedAt !== null && row.publishedAt <= until)) && (!where.slug || row.slug === where.slug);
  };
  const visibleCourses = (where: Prisma.CourseWhereInput = {}) => state.courses.filter((row) => matches(row, where) && matches(state.department, where.department as Prisma.CourseWhereInput));
  const db = {
    contentRevision: { findUnique: async (args: Prisma.ContentRevisionFindUniqueArgs) => {
      assert.deepEqual(args, { where: { id: 1 }, select: { version: true } });
      state.revisionReads++;
      return { version: state.version };
    } },
    department: {
      findMany: async (args: Prisma.DepartmentFindManyArgs) => { filters.push(args.where); return matches(state.department, args.where) ? [state.department] : []; },
      findFirst: async (args: Prisma.DepartmentFindFirstArgs) => { filters.push(args.where); return matches(state.department, args.where) ? state.department : null; },
    },
    course: {
      findMany: async (args: Prisma.CourseFindManyArgs) => {
        calls.push(args);
        const after = (args.where?.id as Prisma.StringFilter | undefined)?.gt;
        return visibleCourses(args.where).filter((row) => !after || row.id > after).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, args.take ?? undefined);
      },
      findFirst: async (args: Prisma.CourseFindFirstArgs) => { filters.push(args.where); return visibleCourses(args.where)[0] ?? null; },
    },
    redirect: { findUnique: async ({ where }: Prisma.RedirectFindUniqueArgs) => redirects.has(where.source!) ? { destination: redirects.get(where.source!) } : null },
  };
  const module = await Test.createTestingModule({ controllers: [CatalogController], providers: [CatalogService, CatalogRepository, CatalogCache, { provide: Database, useValue: db }, { provide: RedisStore, useValue: redis }] }).compile();
  const app = module.createNestApplication();
  await app.init();
  return { app, calls, filters, redirects, state, db, redis, entries, reads, writes, deletes, service: module.get(CatalogService), hide: () => { state.department.status = 'DRAFT'; state.version++; }, get: (path: string) => request(app.getHttpServer()).get(`/public/${path}`) };
}

test('public DTOs project every frontend field without internal columns and serve validators', async () => {
  const f = await fixture();
  try {
    const departments = await f.get('departments').expect(200);
    assert.deepEqual(departments.body, { items: [{ id: department.id, slug: 'film', label: 'Film', latin: 'Film', description: '', updatedAt: updatedAt.toISOString() }] });
    assert.deepEqual((await f.get('departments/film').expect(200)).body, departments.body.items[0]);
    const result = await f.get('courses/film/acting').expect(200);
    assert.deepEqual(result.body, { id: course.id, slug: 'acting', title: 'Acting', latin: 'Acting', department: 'film', description: '', level: 'Beginner', duration: '10h', iconKey: 'Drama', contentHtml: '<p>Acting</p>', syllabus: ['Basics'], coverMedia: null, customPath: null, faq: [{ question: 'When?', answer: 'Now' }], instructors: [{ id: 'teacher', slug: 'teacher', name: 'Teacher', bio: '', image: null }], seo: { title: null, description: null, canonicalUrl: null, noindex: false }, updatedAt: updatedAt.toISOString(), publishedAt: updatedAt.toISOString() });
    assert.ok(result.headers['cache-control']);
    assert.ok(result.headers.etag);
    assert.match(result.headers['cache-control'], /^public,/);
    assert.equal(result.headers['last-modified'], updatedAt.toUTCString());
    assert.match(result.headers.etag!, /^"[a-f0-9]{64}"$/);
    await f.get('courses/film/acting').set('If-None-Match', result.headers.etag).expect(304);
    for (const filter of f.filters) {
      const where = filter as Prisma.CourseWhereInput;
      assert.equal(where.status, 'PUBLISHED');
      assert.equal(where.deletedAt, null);
      assert.ok((where.publishedAt as Prisma.DateTimeNullableFilter).lte instanceof Date);
      if (where.department) assert.deepEqual(where.department, { slug: 'film', status: 'PUBLISHED', deletedAt: null, publishedAt: where.publishedAt });
    }
    f.hide();
    await f.get('departments/film').expect(404);
    await f.get('courses/film/acting').expect(404);
  } finally { await f.app.close(); }
});

test('pagination uses id gt, limit+1, publication filters and department-bound strict cursors', async () => {
  const f = await fixture();
  try {
    const first = await f.get('courses?department=film&limit=1').expect(200);
    const cursor = first.body.nextCursor as string;
    assert.deepEqual(JSON.parse(Buffer.from(cursor, 'base64url').toString()), { id: course.id, department: 'film' });
    const second = await f.get(`courses?department=film&limit=1&cursor=${cursor}`).expect(200);
    assert.equal(second.body.nextCursor, null);
    assert.notEqual(second.body.items[0].id, first.body.items[0].id);
    const args = f.calls[1]!;
    assert.equal(args.take, 2);
    assert.deepEqual(args.orderBy, { id: 'asc' });
    const now = (args.where!.publishedAt as Prisma.DateTimeNullableFilter).lte;
    assert.ok(now instanceof Date && now <= new Date());
    assert.deepEqual(args.where, { id: { gt: course.id }, status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now }, department: { slug: 'film', status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now } } });
    assert.equal(args.select?.status, undefined);
    assert.equal(args.select?.deletedAt, undefined);
    assert.deepEqual((args.select?.instructors as Prisma.Course$instructorsArgs).where, { instructor: { status: 'PUBLISHED', deletedAt: null } });
    for (const query of [`cursor=${cursor}`, `department=other&cursor=${cursor}`, 'cursor=bad', 'cursor=', 'cursor=e30', 'limit=0', 'limit=101', 'limit=1.5', 'department=Bad', 'unknown=1', 'department=film&department=other']) await f.get(`courses?${query}`).expect(400);
    assert.equal(f.calls.length, 2);
    f.hide();
    assert.deepEqual((await f.get('courses').expect(200)).body, { items: [], nextCursor: null });
  } finally { await f.app.close(); }
});

test('seed slug IDs paginate and cursor IDs remain bounded and strict', async () => {
  const f = await fixture(['acting', 'cinematography', 'directing']);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  try {
    let cursor = '';
    for (const id of ['acting', 'cinematography', 'directing']) {
      const result = await f.get(`courses?limit=1${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
      assert.equal(result.body.items[0].id, id);
      cursor = result.body.nextCursor;
    }
    assert.equal(cursor, null);
    for (const id of ['A_9-z', 'a'.repeat(100)]) await f.get(`courses?cursor=${encode({ id, department: null })}`).expect(200);
    for (const value of [{ id: '', department: null }, { id: 'a'.repeat(101), department: null }, { id: 'bad/id', department: null }, { id: 'bad id', department: null }, { id: 1, department: null }, { id: 'acting' }, { id: 'acting', department: null, extra: true }]) await f.get(`courses?cursor=${encode(value)}`).expect(400);
  } finally { await f.app.close(); }
});

test('cache keys isolate routes, departments, limits and cursors and read DB version on every hit', async () => {
  const f = await fixture();
  try {
    const paths = ['departments', 'departments/film', 'courses', 'courses?department=film', 'courses?department=other', 'courses?limit=1', 'courses/film/acting'];
    for (const path of paths) {
      const first = await f.get(path).expect(200);
      const count = f.calls.length + f.filters.length;
      const second = await f.get(path).expect(200);
      assert.deepEqual(second.body, first.body);
      assert.equal(second.headers.etag, first.headers.etag);
      assert.equal(second.headers['last-modified'], first.headers['last-modified']);
      assert.equal(f.calls.length + f.filters.length, count);
    }
    assert.equal(f.state.revisionReads, paths.length * 2);
    assert.equal(f.writes.length, paths.length);
    assert.equal(new Set(f.writes.map(({ key }) => key)).size, paths.length);
    assert.ok(f.writes.every(({ key, ttl }) => /^catalog:v1:1:[a-f0-9]{64}$/.test(key) && ttl === 30));
    await f.get('courses/other/acting').expect(404);
    await f.get('courses/film/missing').expect(404);
    assert.equal(f.writes.length, paths.length);
  } finally { await f.app.close(); }
});

test('version bumps invalidate populated lists and details without leaking draft courses or parents', async () => {
  const f = await fixture(['acting']);
  try {
    const paths = ['departments', 'departments/film', 'courses', 'courses?department=film', 'courses/film/acting'];
    for (const path of paths) await f.get(path).expect(200);
    const oldKeys = [...f.entries.keys()];
    f.state.courses[0]!.status = 'DRAFT';
    f.state.version++;
    for (const path of ['courses', 'courses?department=film']) assert.deepEqual((await f.get(path).expect(200)).body, { items: [], nextCursor: null });
    await f.get('courses/film/acting').expect(404);
    f.state.courses[0]!.status = 'PUBLISHED';
    f.hide();
    assert.deepEqual((await f.get('departments').expect(200)).body, { items: [] });
    await f.get('departments/film').expect(404);
    assert.deepEqual((await f.get('courses').expect(200)).body, { items: [], nextCursor: null });
    await f.get('courses/film/acting').expect(404);
    assert.ok(oldKeys.every((key) => f.entries.has(key)));
    assert.ok(f.writes.some(({ key }) => key.startsWith('catalog:v1:2:')));
    assert.ok(f.writes.some(({ key }) => key.startsWith('catalog:v1:3:')));
  } finally { await f.app.close(); }
});

test('Redis read and write failures fall back to DB while DB failures propagate without stale fallback', async (t) => {
  const f = await fixture();
  try {
    await f.service.courses({ limit: 20 });
    const failure = new Error('database unavailable');
    const revision = t.mock.method(f.db.contentRevision, 'findUnique', async () => { throw failure; });
    await assert.rejects(f.service.courses({ limit: 20 }), (error) => error === failure);
    assert.equal(f.reads.length, 1);
    revision.mock.restore();
    t.mock.method(f.redis.client, 'get', async () => { throw new Error('redis unavailable'); });
    t.mock.method(f.redis.client, 'set', async () => { throw new Error('redis unavailable'); });
    assert.equal((await f.service.courses({ limit: 20 })).items.length, 2);
    assert.equal(f.calls.length, 2);
    t.mock.method(f.db.course, 'findMany', async () => { throw failure; });
    await assert.rejects(f.service.courses({ limit: 20 }), (error) => error === failure);
  } finally { await f.app.close(); }
});

test('malformed JSON is deleted best effort and reloaded from DB', async (t) => {
  const f = await fixture();
  try {
    const expected = await f.service.courses({ limit: 20 });
    const key = f.writes[0]!.key;
    f.entries.get(key)!.value = '{invalid';
    assert.deepEqual(await f.service.courses({ limit: 20 }), expected);
    assert.deepEqual(f.deletes, [key]);
    assert.equal(f.calls.length, 2);
    f.entries.get(key)!.value = '{invalid';
    t.mock.method(f.redis.client, 'del', async () => { throw new Error('delete failed'); });
    assert.deepEqual(await f.service.courses({ limit: 20 }), expected);
    assert.equal(f.calls.length, 3);
  } finally { await f.app.close(); }
});

test('future publication becomes visible after the 30-second TTL without a version bump or sliding expiry', async (t) => {
  const f = await fixture(['acting']);
  t.mock.timers.enable({ apis: ['Date'], now: updatedAt.getTime() });
  try {
    f.state.courses[0]!.publishedAt = new Date(Date.now() + 1000);
    assert.deepEqual(await f.service.courses({ limit: 20 }), { items: [], nextCursor: null });
    t.mock.timers.tick(29999);
    assert.deepEqual(await f.service.courses({ limit: 20 }), { items: [], nextCursor: null });
    assert.equal(f.calls.length, 1);
    assert.equal(f.writes.length, 1);
    t.mock.timers.tick(1);
    assert.equal((await f.service.courses({ limit: 20 })).items[0]!.id, 'acting');
    assert.equal(f.calls.length, 2);
    assert.equal(f.state.version, 1);
    assert.equal(f.state.revisionReads, 3);
  } finally { t.mock.timers.reset(); await f.app.close(); }
});

test('empty lists and redirects omit Last-Modified and redirects bypass Redis entirely', async () => {
  const f = await fixture();
  try {
    f.hide();
    for (const path of ['departments', 'courses', 'redirects?path=/courses/old']) {
      const result = await f.get(path).expect(200);
      assert.equal(result.headers['last-modified'], undefined);
      assert.match(result.headers.etag!, /^"[a-f0-9]{64}"$/);
      await f.get(path).set('If-Modified-Since', updatedAt.toUTCString()).expect(200);
    }
    const reads = f.reads.length;
    const writes = f.writes.length;
    const revisions = f.state.revisionReads;
    f.state.department.status = 'PUBLISHED';
    f.redirects.set('/courses/old', '/courses/film');
    const result = await f.get('redirects?path=/courses/old').expect(200);
    assert.equal(result.body.destination, '/courses/film');
    assert.equal(result.headers['last-modified'], undefined);
    f.state.department.status = 'DRAFT';
    assert.equal((await f.get('redirects?path=/courses/old').expect(200)).body.destination, null);
    assert.equal(f.reads.length, reads);
    assert.equal(f.writes.length, writes);
    assert.equal(f.state.revisionReads, revisions);
  } finally { await f.app.close(); }
});

test('redirects resolve at most ten safe local hops and require published final content', async () => {
  const f = await fixture();
  const resolve = async (path: string) => (await f.get(`redirects?path=${encodeURIComponent(path)}`).expect(200)).body.destination;
  try {
    f.redirects.set('/courses/old', '/courses/film');
    assert.equal(await resolve('/courses/old'), '/courses/film');
    f.redirects.set('/courses/film', '/courses/film/acting');
    assert.equal(await resolve('/courses/old'), '/courses/film/acting');
    f.hide();
    assert.equal(await resolve('/courses/old'), null);
    f.redirects.set('/courses/film/acting', '/courses/old');
    assert.equal(await resolve('/courses/old'), null);
    for (const target of ['https://example.test', '//example.test', '/courses/%2fexample', '/courses/../film', '/courses\\film', '/courses', null]) {
      f.redirects.set('/courses/old', target);
      assert.equal(await resolve('/courses/old'), null);
    }
    await f.get('redirects?path=%2F%2Fexample.test').expect(400);
  } finally { await f.app.close(); }
  const g = await fixture();
  try {
    for (let i = 0; i < 10; i++) g.redirects.set(`/courses/old-${i}`, i === 9 ? '/courses/film' : `/courses/old-${i + 1}`);
    assert.equal((await g.get('redirects?path=/courses/old-0')).body.destination, '/courses/film');
    g.redirects.set('/courses/film', '/courses/film/acting');
    assert.equal((await g.get('redirects?path=/courses/old-0')).body.destination, null);
    assert.equal((await g.get('redirects?path=/courses/missing')).body.destination, null);
  } finally { await g.app.close(); }
});
