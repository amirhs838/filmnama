import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { parse } from 'dotenv';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { CourseInput, hash } from '../../src/common/validation';
import { Config } from '../../src/infrastructure/config';
import { Database, RedisStore } from '../../src/infrastructure/infrastructure.module';
import { RevalidationService } from '../../src/infrastructure/revalidation.module';
import { configureApp } from '../../src/security/runtime';
import { testConfig } from '../auth.fixture';

const adminEnvPath = 'D:/Temp/opencode/pgtest/admin.env';
const origin = 'http://localhost:3000';

function assertSanitized(value: unknown, expected: string) {
  assert.equal(typeof value, 'string');
  assert.doesNotMatch(value as string, /script|javascript:/i);
  assert.equal(value, expected);
}

test('real PostgreSQL catalog lifecycle: restoring an old slug returns 409 because history paths remain reserved', async (t) => {
  const databaseUrl = process.env.DATABASE_URL;
  let url: URL;
  try { url = new URL(databaseUrl ?? ''); }
  catch {
    t.skip('DATABASE_URL must identify the disposable local filmnama_test database on port 55432');
    return;
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || url.port !== '55432' || url.pathname !== '/filmnama_test'
    || url.hash || [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    t.skip('DATABASE_URL is not the disposable localhost/127.0.0.1:55432/filmnama_test database');
    return;
  }

  let credentialsFile: string;
  try { credentialsFile = await readFile(adminEnvPath, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    t.skip(`Real PostgreSQL catalog scenario requires admin credentials: ${adminEnvPath} is missing`);
    return;
  }
  const passwordLine = credentialsFile.match(/^\s*(?:export\s+)?ADMIN_PASSWORD\s*=\s*[^\r\n]*/m);
  const email = parse(credentialsFile).ADMIN_EMAIL?.trim().toLowerCase();
  const password = passwordLine ? parse(passwordLine[0]).ADMIN_PASSWORD : undefined;
  assert.ok(email && password, 'admin.env must contain ADMIN_EMAIL and ADMIN_PASSWORD');

  const unique = `${Date.now()}-${randomUUID().replace(/-/g, '')}`;
  const probeId = `itest-${unique}`;
  const slug = `e2e-${unique}`;
  const renamedSlug = `${slug}-2`;
  const paths = [`/courses/cinema/${slug}`, `/courses/cinema/${renamedSlug}`];
  const config = testConfig({ NODE_ENV: 'test', DATABASE_URL: databaseUrl, ALLOWED_ORIGINS: origin });
  config.origins.splice(0, config.origins.length, origin);
  const redis = { disabled: true, client: {
    get: async () => null, set: async () => undefined,
    del: async () => undefined, eval: async () => [0, 0],
  } };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Config).useValue(config)
    .overrideProvider(RedisStore).useValue(redis)
    .overrideProvider(RevalidationService).useValue({})
    .compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  const db = app.get(Database);
  let initialized = false;
  let sessionCsrfHash: string | undefined;
  try {
    configureApp(app);
    await app.init();
    initialized = true;
    const client = request.agent(app.getHttpServer());
    const departments = await client.get('/api/v1/public/departments').expect(200);
    const cinema = (departments.body.items as { id: string; slug: string }[]).find((item) => item.slug === 'cinema');
    assert.ok(cinema, 'seeded public departments must include cinema');
    await client.post('/api/v1/admin/courses').set('Origin', origin).send({}).expect(401);

    const csrf = await client.get('/api/v1/auth/csrf').set('Origin', origin).expect(200);
    assert.equal(typeof csrf.body.csrfToken, 'string');
    const login = await client.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send({ email, password }).expect(200);
    if (typeof login.body.csrfToken === 'string') sessionCsrfHash = hash(login.body.csrfToken);
    assert.equal(login.body.role, 'SUPER_ADMIN');
    assert.equal(typeof login.body.accessToken, 'string');
    assert.equal(typeof login.body.csrfToken, 'string');
    const headers = { Origin: origin, Authorization: `Bearer ${login.body.accessToken}`, 'X-CSRF-Token': login.body.csrfToken as string };
    const input: CourseInput = {
      slug, departmentId: cinema.id, title: probeId, latin: probeId,
      description: 'Disposable database integration course', level: 'Beginner', duration: '1h',
      iconKey: 'Aperture', status: 'PUBLISHED', coverMediaId: null,
      contentHtml: '<p>Safe content</p><script>alert(1)</script><a href="javascript:alert(1)">Link</a>',
      syllabus: ['Basics'], faq: [{ question: 'Who is this for?', answer: 'Integration tests' }],
      instructorIds: [], seo: { title: null, description: null, canonicalUrl: null, noindex: false },
    };
    const created = await client.post('/api/v1/admin/courses').set(headers).send(input).expect(201);
    assert.equal(typeof created.body.id, 'string');
    const courseId = created.body.id as string;
    const adminPath = `/api/v1/admin/courses/${courseId}`;
    assert.equal(created.body.slug, slug);
    assert.equal(created.body.status, 'PUBLISHED');
    assert.deepEqual(created.body.faq, input.faq);
    assert.deepEqual(created.body.instructorIds, []);
    assertSanitized(created.body.contentHtml, '<p>Safe content</p><a>Link</a>');
    const persisted = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { faq: true } });
    assert.equal(persisted.title, probeId);
    assert.equal(persisted.faq.length, 1);
    assertSanitized(persisted.contentHtml, '<p>Safe content</p><a>Link</a>');
    const detail = await client.get(`/api/v1/public/courses/cinema/${slug}`).expect(200);
    assert.equal(detail.body.slug, slug);
    assertSanitized(detail.body.contentHtml, '<p>Safe content</p><a>Link</a>');

    const renamedInput = { ...input, slug: renamedSlug };
    const renamed = await client.put(adminPath).set(headers).send(renamedInput).expect(200);
    assert.equal(renamed.body.slug, renamedSlug);
    await setTimeout(6000);
    const redirect = await client.get('/api/v1/public/redirects').query({ path: paths[0] }).expect(200);
    assert.equal(redirect.body.destination, paths[1]);
    await client.get(`/api/v1/public/courses/cinema/${slug}`).expect(404);
    const newDetail = await client.get(`/api/v1/public/courses/cinema/${renamedSlug}`).expect(200);
    assert.equal(newDetail.body.slug, renamedSlug);

    const reserved = await client.put(adminPath).set(headers).send(input).expect(409);
    assert.equal(reserved.body.statusCode, 409);
    assert.equal(reserved.body.message, 'Conflict');
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: courseId } })).slug, renamedSlug);
    assert.equal((await db.redirect.findUniqueOrThrow({ where: { source: paths[0]! } })).destination, paths[1]);
    await client.put(adminPath).set(headers).send({ ...renamedInput, unknownField: true }).expect(400);
    const updated = await client.put(adminPath).set(headers).send({
      ...renamedInput, contentHtml: '<p>Updated content</p><script>alert(2)</script><a href="javascript:alert(2)">Updated link</a>',
    }).expect(200);
    assertSanitized(updated.body.contentHtml, '<p>Updated content</p><a>Updated link</a>');
    assertSanitized((await db.course.findUniqueOrThrow({ where: { id: courseId } })).contentHtml, '<p>Updated content</p><a>Updated link</a>');

    const deleted = await client.delete(adminPath).set(headers).send({});
    assert.ok([200, 201].includes(deleted.status), `DELETE returned ${deleted.status}`);
    await client.get(`/api/v1/public/courses/cinema/${renamedSlug}`).expect(404);
    for (const path of paths) {
      const gone = await client.get('/api/v1/public/redirects').query({ path }).expect(200);
      assert.equal(gone.body.destination, null);
    }
  } finally {
    try {
      if (initialized) await db.serial(async (tx) => {
        const courses = await tx.course.findMany({ where: { title: probeId, slug: { in: [slug, renamedSlug] } }, select: { id: true } });
        const ids = courses.map(({ id }) => id);
        await tx.redirect.deleteMany({ where: { source: { in: paths } } });
        await tx.auditLog.deleteMany({ where: { entityType: 'Course', entityId: { in: ids } } });
        await tx.course.deleteMany({ where: { id: { in: ids } } });
        await tx.revalidationOutbox.deleteMany({ where: { paths: { hasSome: paths } } });
        if (sessionCsrfHash) {
          const sessions = await tx.refreshSession.findMany({ where: { csrfHash: sessionCsrfHash }, select: { id: true, userId: true, createdAt: true } });
          for (const session of sessions) {
            await tx.auditLog.deleteMany({ where: { actorId: session.userId, entityType: 'User', entityId: session.userId, action: 'LOGIN', createdAt: session.createdAt } });
          }
          await tx.refreshSession.deleteMany({ where: { id: { in: sessions.map(({ id }) => id) } } });
        }
        const revision = await tx.contentRevision.upsert({
          where: { id: 1 }, create: { id: 1, version: 1 },
          update: { version: { increment: 1 } }, select: { version: true },
        });
        await tx.revalidationOutbox.create({ data: { id: `${probeId}-cleanup`, version: revision.version, paths: ['/', '/courses', '/courses/cinema', ...paths] } });
      });
    } finally { await app.close(); }
  }
});
