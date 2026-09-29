import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { AccessGuard } from '../src/auth/guards';
import { courseSchema, hash, mediaSchema, postSchema } from '../src/common/validation';
import { Config, resolveMediaDir } from '../src/infrastructure/config';
import { Database, InfrastructureModule, RedisStore } from '../src/infrastructure/infrastructure.module';
import { configureApp } from '../src/security/runtime';
import { SecurityModule } from '../src/security/security.module';
import { AdminMediaController, MediaRepository, MediaService, PublicMediaController, resolveMediaFile } from '../src/media/media.module';
import { BlogRepository, BlogService } from '../src/blog/blog.module';
import { AdminCatalogRepository } from '../src/catalog/admin.module';
import { origin, testConfig } from './auth.fixture';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const GIF_1X1 = Buffer.from('R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs=', 'base64');
const FAKE_PNG = Buffer.from('this is not a real png file, just text');
const SVG_BYTES = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');
const MP4_MINIMAL = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32]),
  Buffer.alloc(100),
]);
const CSRF = 'valid-csrf-token-for-tests';

type MediaRow = { id: string; storageKey: string; mimeType: string; size: number; alt: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null };

function mediaFixture() {
  const state = { media: [] as MediaRow[], audits: [] as unknown[], version: 0, outbox: [] as { version: number; paths: string[] }[] };
  let seq = 0;
  const mutation = () => undefined;
  void mutation;
  const unique = (): never => { throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '6.19.0' }); };
  const tx = {
    media: {
      findFirst: async ({ where }: { where: { id: string; deletedAt?: null } }) => state.media.find((r) => r.id === where.id && (where.deletedAt !== null || r.deletedAt === null)) ?? null,
      findMany: async ({ where, take }: { where: { deletedAt: null; mimeType?: string; id?: { gt: string } }; take?: number }) =>
        state.media.filter((r) => r.deletedAt === null && (where.mimeType === undefined || r.mimeType === where.mimeType) && (!where.id || r.id > where.id.gt)).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, take),
      create: async ({ data }: { data: { storageKey: string; mimeType: string; size: number; alt: string } }) => {
        if (state.media.some((r) => r.storageKey === data.storageKey)) unique();
        const row: MediaRow = { id: `med-${++seq}`, storageKey: data.storageKey, mimeType: data.mimeType, size: data.size, alt: data.alt, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
        state.media.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: { alt?: string; deletedAt?: Date } }) => {
        const row = state.media.find((r) => r.id === where.id);
        if (!row) throw new Prisma.PrismaClientKnownRequestError('Missing', { code: 'P2025', clientVersion: '6.19.0' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    galleryItem: { count: async () => 0 },
    portfolioItem: { count: async () => 0 },
    post: { count: async () => 0 },
    course: { count: async () => 0 },
    auditLog: { create: async ({ data }: { data: unknown }) => { state.audits.push(data); } },
    contentRevision: { upsert: async () => ({ version: ++state.version }) },
    revalidationOutbox: { create: async ({ data }: { data: { version: number; paths: string[] } }) => { state.outbox.push(data); } },
  };
  const db = { ...tx, serial: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => operation(tx as unknown as Prisma.TransactionClient) } as unknown as Database;
  return { state, tx, db };
}

async function httpFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'filmnama-media-'));
  const config = testConfig();
  (config as unknown as { mediaDir: string }).mediaDir = tempDir;
  const f = mediaFixture();
  const users: Record<string, { id: string; role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'BLOG_EDITOR'; sessionId: string; csrfHash: string }> = {
    'admin-token': { id: 'admin', role: 'SUPER_ADMIN', sessionId: 's', csrfHash: hash(CSRF) },
    'manager-token': { id: 'manager', role: 'CONTENT_MANAGER', sessionId: 's', csrfHash: hash(CSRF) },
    'editor-token': { id: 'editor', role: 'BLOG_EDITOR', sessionId: 's', csrfHash: hash(CSRF) },
  };
  const module = await Test.createTestingModule({
    imports: [InfrastructureModule, SecurityModule],
    controllers: [AdminMediaController, PublicMediaController],
    providers: [MediaRepository, MediaService, AccessGuard, Reflector, AuthService, Config],
  })
    .overrideProvider(Config).useValue(config)
    .overrideProvider(Database).useValue(f.db)
    .overrideProvider(RedisStore).useValue({ client: { eval: async () => [0, 0] } })
    .overrideProvider(AuthService).useValue({ authenticate: async (token: string) => { const found = users[token]; if (!found) throw new (await import('@nestjs/common').then((m) => m.UnauthorizedException))(); return found; } })
    .compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  const http = request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}`, Origin: origin, 'X-CSRF-Token': CSRF });
  return { app, http, auth, config, tempDir, ...f, cleanup: async () => { await app.close(); await rm(tempDir, { recursive: true, force: true }); } };
}

test('upload roles: 401 without token, 403 for blog editor, 200 for manager/admin', async () => {
  const f = await httpFixture();
  try {
    assert.deepEqual(Reflect.getMetadata('roles', AdminMediaController), ['SUPER_ADMIN', 'CONTENT_MANAGER']);
    await f.http.post('/api/v1/admin/media/upload').set('Origin', origin).attach('file', PNG_1X1, 'a.png').expect(401);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('editor-token')).attach('file', PNG_1X1, 'a.png').expect(403);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', PNG_1X1, 'a.png').field('alt', 'Still').expect(201);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('admin-token')).attach('file', PNG_1X1, 'b.png').expect(201);
    assert.equal(f.state.media.length, 2);
    assert.equal(f.state.media[0]!.alt, 'Still');
    assert.equal(f.state.media[1]!.alt, '');
  } finally { await f.cleanup(); }
});

test('mime sniffing: real png passes, fake png/svg/gif rejected with 400', async () => {
  const f = await httpFixture();
  try {
    const ok = await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', PNG_1X1, 'real.png').expect(201);
    assert.equal(ok.body.mimeType, 'image/png');
    assert.match(ok.body.storageKey as string, /^uploads\/[a-f0-9]+\.png$/);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', FAKE_PNG, 'fake.png').expect(400);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', SVG_BYTES, 'vector.svg').expect(400);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', GIF_1X1, 'anim.gif').expect(400);
    // Client mimetype/filename are never trusted: send png bytes as .jpg with spoofed type.
    const spoofed = await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', PNG_1X1, { filename: 'evil.jpg', contentType: 'image/jpeg' }).expect(201);
    assert.equal(spoofed.body.mimeType, 'image/png');
    // mp4 magic bytes are accepted for upload (covers still reject video later).
    const mp4 = await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', MP4_MINIMAL, 'clip.mp4').expect(201);
    assert.equal(mp4.body.mimeType, 'video/mp4');
    assert.match(mp4.body.storageKey as string, /^uploads\/[a-f0-9]+\.mp4$/);
  } finally { await f.cleanup(); }
});

test('size limit maps to 413 and alt longer than 500 is 400', async () => {
  const f = await httpFixture();
  try {
    const big = Buffer.alloc(13 * 1024 * 1024, 0);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', big, 'big.png').expect(413);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', PNG_1X1, 'a.png').field('alt', 'x'.repeat(501)).expect(400);
    await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).field('alt', 'no file').expect(400);
  } finally { await f.cleanup(); }
});

test('JSON-only still enforced on metadata POST, multipart allowed only for upload', async () => {
  const f = await httpFixture();
  try {
    // Metadata POST with non-JSON is rejected.
    await f.http.post('/api/v1/admin/media').set(f.auth('manager-token')).set('Content-Type', 'text/plain').send('hello').expect(415);
    // Metadata POST with multipart is also rejected (exemption is upload-only).
    await f.http.post('/api/v1/admin/media').set(f.auth('manager-token')).field('storageKey', 'uploads/x.png').expect(415);
    // Metadata POST with JSON still works.
    await f.http.post('/api/v1/admin/media').set({ ...f.auth('manager-token'), 'Content-Type': 'application/json' }).send({ storageKey: 'uploads/meta.png', mimeType: 'image/png', size: 10, alt: '' }).expect(201);
    // Upload with JSON (no multipart) is rejected.
    await f.http.post('/api/v1/admin/media/upload').set({ ...f.auth('manager-token'), 'Content-Type': 'application/json' }).send({}).expect(415);
  } finally { await f.cleanup(); }
});

test('serve streams bytes with sniffed content-type, immutable cache, etag and 404s', async () => {
  const f = await httpFixture();
  try {
    const created = await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', PNG_1X1, 'cover.png').expect(201);
    const id = created.body.id as string;
    const url = `/api/v1/public/media/${id}/file`;
    assert.equal(created.body.mimeType, 'image/png');
    const served = await f.http.get(url).expect(200);
    assert.equal(served.headers['content-type'], 'image/png');
    assert.equal(served.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.match(served.headers['etag'] as string, /^"[a-f0-9]{64}"$/);
    assert.deepEqual(Buffer.from(served.body as unknown as ArrayBuffer), PNG_1X1);
    // No no-store on immutable bytes.
    assert.ok(!(served.headers['cache-control'] as string).includes('no-store'));
    await f.http.get('/api/v1/public/media/missing-id/file').expect(404);
    // Deleted media is 404.
    await f.http.delete(`/api/v1/admin/media/${id}`).set({ ...f.auth('manager-token'), 'Content-Type': 'application/json' }).send({}).expect(200);
    await f.http.get(url).expect(404);
    // File absent on disk is 404 even when the row is live.
    const second = await f.http.post('/api/v1/admin/media/upload').set(f.auth('manager-token')).attach('file', PNG_1X1, 'gone.png').expect(201);
    const secondId = second.body.id as string;
    const storageKey = second.body.storageKey as string;
    await unlink(join(f.tempDir, storageKey.split('/')[1] as string));
    await f.http.get(`/api/v1/public/media/${secondId}/file`).expect(404);
  } finally { await f.cleanup(); }
});

test('cover wiring: admin/public DTOs expose path-only url, video cover rejected', async () => {
  // Post cover validation reuses image-only guard.
  const mediaRows = [
    { id: 'img-1', mimeType: 'image/png', deletedAt: null },
    { id: 'vid-1', mimeType: 'video/mp4', deletedAt: null },
  ];
  const tx = {
    category: { findFirst: async () => ({ id: 'cat-1' }) },
    tag: { findMany: async () => [] },
    media: { findFirst: async ({ where }: { where: { id: string } }) => mediaRows.find((m) => m.id === where.id) ?? null },
    post: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const coverId = (data['coverMedia'] as { connect?: { id: string } } | undefined)?.connect?.id ?? (data['coverMediaId'] as string | null | undefined) ?? null;
        return { id: 'p1', slug: data['slug'], coverMediaId: coverId, coverMedia: coverId === 'img-1' ? { id: 'img-1', alt: 'Alt', deletedAt: null } : null, category: null, tags: [], status: 'DRAFT', seoTitle: null, seoDescription: null, canonicalUrl: null, noindex: false, publishedAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
      },
    },
    postTag: { deleteMany: async () => undefined },
    auditLog: { create: async () => undefined },
    contentRevision: { upsert: async () => ({ version: 1 }) },
    revalidationOutbox: { create: async () => undefined },
  };
  const db = { ...tx, serial: async <T>(op: (c: Prisma.TransactionClient) => Promise<T>) => op(tx as unknown as Prisma.TransactionClient) } as unknown as Database;
  const repo = new BlogRepository(db);
  const service = new BlogService(repo);
  const base = postSchema.parse({ slug: 'hello', title: 'Hello', excerpt: '', contentHtml: '<p>x</p>', tagIds: [], status: 'DRAFT' });
  assert.equal(base.coverMediaId, null);
  const withImage = postSchema.parse({ ...base, coverMediaId: 'img-1', slug: 'with-cover' });
  const dto = await service.createPost('actor', withImage);
  assert.equal((dto as unknown as { coverMediaId: string | null }).coverMediaId, 'img-1');
  assert.deepEqual(dto.coverMedia, { id: 'img-1', url: '/api/v1/public/media/img-1/file', alt: 'Alt' });
  assert.ok(!(dto.coverMedia.url as string).startsWith('http'));
  await assert.rejects(repo.createPost('actor', postSchema.parse({ ...base, slug: 'bad-video', coverMediaId: 'vid-1' })), BadRequestException);
  await assert.rejects(repo.createPost('actor', postSchema.parse({ ...base, slug: 'bad-missing', coverMediaId: 'nope' })), BadRequestException);
  // over-long cover id is a schema 400.
  assert.equal(postSchema.safeParse({ ...base, coverMediaId: 'x'.repeat(101) }).success, false);
  // Course schema accepts the same cover field and rejects video via repository guard.
  const courseTx = {
    department: { findFirst: async () => ({ id: 'dep-1', slug: 'film' }) },
    instructor: { findMany: async () => [] },
    media: tx.media,
    course: { findFirst: async () => null },
    courseFaq: { deleteMany: async () => undefined },
    courseInstructor: { deleteMany: async () => undefined },
    redirect: { findUnique: async () => null, findMany: async () => [], updateMany: async () => undefined, upsert: async () => undefined },
    auditLog: tx.auditLog,
    contentRevision: tx.contentRevision,
    revalidationOutbox: tx.revalidationOutbox,
  };
  const courseDb = { ...courseTx, serial: async <T>(op: (c: Prisma.TransactionClient) => Promise<T>) => op(courseTx as unknown as Prisma.TransactionClient) } as unknown as Database;
  const courseRepo = new AdminCatalogRepository(courseDb);
  const courseBase = courseSchema.parse({ slug: 'acting', departmentId: 'dep-1', title: 'Acting', latin: 'Acting', description: '', level: 'L', duration: 'D', iconKey: 'Drama', contentHtml: '<p>x</p>', syllabus: [], faq: [], instructorIds: [], seo: { title: null, description: null, canonicalUrl: null, noindex: false }, status: 'DRAFT' });
  assert.equal(courseBase.coverMediaId, null);
  await assert.rejects(courseRepo.createCourse('actor', courseSchema.parse({ ...courseBase, slug: 'video-cover', coverMediaId: 'vid-1' })), BadRequestException);
});

test('orphan guard refuses DELETE when used as live post/course cover, allows after unlink', async () => {
  const f = mediaFixture();
  f.state.media.push({ id: 'cover-1', storageKey: 'uploads/cover-1.png', mimeType: 'image/png', size: 10, alt: '', createdAt: new Date(), updatedAt: new Date(), deletedAt: null });
  // Referenced by a live post cover.
  (f.tx.post as { count: () => Promise<number> }).count = async () => 1;
  await assert.rejects(f.db && new MediaRepository(f.db).remove('actor', 'cover-1'), ConflictException);
  (f.tx.post as { count: () => Promise<number> }).count = async () => 0;
  (f.tx.course as { count: () => Promise<number> }).count = async () => 1;
  await assert.rejects(new MediaRepository(f.db).remove('actor', 'cover-1'), ConflictException);
  (f.tx.course as { count: () => Promise<number> }).count = async () => 0;
  await new MediaRepository(f.db).remove('actor', 'cover-1');
});

test('no path traversal: storageKey with ../ rejected, file resolution stays inside MEDIA_DIR', async () => {
  const f = await httpFixture();
  try {
    assert.equal(mediaSchema.safeParse({ storageKey: '../evil.jpg', mimeType: 'image/png', size: 10, alt: '' }).success, false);
    assert.equal(mediaSchema.safeParse({ storageKey: '/abs.jpg', mimeType: 'image/png', size: 10, alt: '' }).success, false);
    assert.equal(mediaSchema.safeParse({ storageKey: 'a\\b.jpg', mimeType: 'image/png', size: 10, alt: '' }).success, false);
    await f.http.post('/api/v1/admin/media').set({ ...f.auth('manager-token'), 'Content-Type': 'application/json' }).send({ storageKey: '../evil.jpg', mimeType: 'image/png', size: 10, alt: '' }).expect(400);
    const inside = resolveMediaFile(f.tempDir, 'uploads/abc.png');
    assert.ok(inside.startsWith(f.tempDir));
    const neutralized = resolveMediaFile(f.tempDir, '../../etc/passwd');
    assert.ok(neutralized.startsWith(f.tempDir));
    assert.equal(neutralized, join(f.tempDir, 'passwd'));
    // MEDIA_DIR itself rejects traversal at config load.
    assert.throws(() => resolveMediaDir('../outside'), /Invalid media directory/);
  } finally { await f.cleanup(); }
});
