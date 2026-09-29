import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { parse } from 'dotenv';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { hash } from '../../src/common/validation';
import { Config } from '../../src/infrastructure/config';
import { Database, RedisStore } from '../../src/infrastructure/infrastructure.module';
import { RevalidationService } from '../../src/infrastructure/revalidation.module';
import { leadSchema } from '../../src/leads.dto';
import { LeadsRepository } from '../../src/leads.module';
import { configureApp } from '../../src/security/runtime';
import { testConfig } from '../auth.fixture';

const adminEnvPath = 'D:/Temp/opencode/pgtest/admin.env';
const origin = 'http://localhost:3000';

test('real PostgreSQL leads: concurrent idempotency, visibility, private pagination, CSRF and atomic status audit', async (t) => {
  const databaseUrl = process.env.DATABASE_URL;
  let url: URL;
  try { url = new URL(databaseUrl ?? ''); }
  catch { t.skip('Requires disposable localhost:55432/filmnama_test'); return; }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.port !== '55432' || url.pathname !== '/filmnama_test' || url.hash
    || [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    t.skip('Requires disposable localhost:55432/filmnama_test'); return;
  }
  let credentialsFile: string;
  try { credentialsFile = await readFile(adminEnvPath, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    t.skip('Requires runtime admin.env outside the repository'); return;
  }
  const passwordLine = credentialsFile.match(/^\s*(?:export\s+)?ADMIN_PASSWORD\s*=\s*[^\r\n]*/m);
  const email = parse(credentialsFile).ADMIN_EMAIL?.trim().toLowerCase();
  const password = passwordLine ? parse(passwordLine[0]).ADMIN_PASSWORD : undefined;
  assert.ok(email && password, 'admin.env must contain admin credentials');

  const unique = `lead-test-${randomUUID()}`;
  const departmentId = `${unique}-department`;
  const courseId = `${unique}-course`;
  const ids: string[] = [];
  const nextId = () => { const id = randomUUID(); ids.push(id); return id; };
  const config = testConfig({ DATABASE_URL: databaseUrl, ALLOWED_ORIGINS: origin });
  config.origins.splice(0, config.origins.length, origin);
  const db = new Database({ datasources: { db: { url: databaseUrl } } });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Config).useValue(config)
    .overrideProvider(Database).useValue(db)
    .overrideProvider(RedisStore).useValue({ disabled: true })
    .overrideProvider(RevalidationService).useValue({})
    .compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  let initialized = false;
  let sessionCsrfHash: string | undefined;
  try {
    configureApp(app);
    await app.init();
    initialized = true;
    const repo = app.get(LeadsRepository);
    const past = new Date(Date.now() - 60000);
    await db.department.create({ data: { id: departmentId, slug: departmentId, label: unique, latin: unique, status: 'PUBLISHED', publishedAt: past } });
    await db.course.create({ data: { id: courseId, departmentId, slug: courseId, title: unique, latin: unique, description: 'Synthetic integration fixture', level: 'Test', duration: 'Test', iconKey: 'Drama', status: 'PUBLISHED', publishedAt: past } });
    const client = request.agent(app.getHttpServer());
    const input = { submissionId: nextId(), name: ' Synthetic Integration ', phone: '+۹۸۹۱۲۳۴۵۶۷۸۹', email: ' SYNTHETIC@EXAMPLE.TEST ', message: ' ', courseId, consent: true };
    const path = '/api/v1/public/leads';
    const before = Date.now();
    const concurrent = await Promise.all([
      client.post(path).set('Origin', origin).send(input),
      client.post(path).set('Origin', origin).send({ ...input, phone: '00989123456789', message: '' }),
    ]);
    for (const response of concurrent) { assert.equal(response.status, 201); assert.deepEqual(response.body, { accepted: true }); assert.equal(response.headers['cache-control'], 'no-store'); }
    const persisted = await db.lead.findUniqueOrThrow({ where: { id: input.submissionId } });
    assert.equal(persisted.name, 'Synthetic Integration');
    assert.equal(persisted.phone, '09123456789');
    assert.equal(persisted.email, 'synthetic@example.test');
    assert.equal(persisted.message, null);
    assert.equal(persisted.locale, 'fa');
    assert.equal(persisted.status, 'NEW');
    assert.ok(persisted.consentAt.getTime() >= before && persisted.consentAt.getTime() <= Date.now());
    assert.equal(await db.lead.count({ where: { id: input.submissionId } }), 1);
    assert.equal(await db.auditLog.count({ where: { entityType: 'Lead', entityId: input.submissionId, action: 'CREATE' } }), 1);
    await client.post(path).set('Origin', origin).send({ ...input, name: 'Different' }).expect(409);
    await client.post(path).set('Origin', origin).send({ ...input, submissionId: nextId(), consent: false }).expect(400);
    await db.department.update({ where: { id: departmentId }, data: { status: 'DRAFT' } });
    await client.post(path).set('Origin', origin).send(input).expect(201, { accepted: true });
    await client.post(path).set('Origin', origin).send({ ...input, submissionId: nextId() }).expect(400);
    assert.deepEqual(await db.lead.findUniqueOrThrow({ where: { id: input.submissionId } }), persisted);
    await db.department.update({ where: { id: departmentId }, data: { status: 'PUBLISHED' } });

    const hiddenStates: Prisma.CourseUpdateInput[] = [{ status: 'DRAFT' }, { status: 'ARCHIVED' }, { deletedAt: past }, { publishedAt: null }, { publishedAt: new Date(Date.now() + 3600000) }];
    for (const data of hiddenStates) {
      await db.course.update({ where: { id: courseId }, data });
      await assert.rejects(repo.submit(leadSchema.parse({ ...input, submissionId: nextId() })), BadRequestException);
      await db.course.update({ where: { id: courseId }, data: { status: 'PUBLISHED', deletedAt: null, publishedAt: past } });
    }
    for (const data of hiddenStates as Prisma.DepartmentUpdateInput[]) {
      await db.department.update({ where: { id: departmentId }, data });
      await assert.rejects(repo.submit(leadSchema.parse({ ...input, submissionId: nextId() })), BadRequestException);
      await db.department.update({ where: { id: departmentId }, data: { status: 'PUBLISHED', deletedAt: null, publishedAt: past } });
    }
    await assert.rejects(repo.submit(leadSchema.parse({ ...input, submissionId: nextId(), courseId: `${unique}-missing` })), BadRequestException);
    const secondId = nextId();
    await repo.submit(leadSchema.parse({ ...input, submissionId: secondId }));
    await db.lead.updateMany({ where: { id: { in: [input.submissionId, secondId] } }, data: { createdAt: past } });

    const adminPath = '/api/v1/admin/leads';
    await client.get(adminPath).expect(401);
    const csrf = await client.get('/api/v1/auth/csrf').set('Origin', origin).expect(200);
    const login = await client.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send({ email, password }).expect(200);
    if (typeof login.body.csrfToken === 'string') sessionCsrfHash = hash(login.body.csrfToken);
    assert.equal(login.body.role, 'SUPER_ADMIN');
    assert.ok(sessionCsrfHash);
    const headers = { Origin: origin, Authorization: `Bearer ${login.body.accessToken}`, 'X-CSRF-Token': login.body.csrfToken as string };
    const first = await client.get(adminPath).set(headers).query({ courseId, status: 'NEW', limit: 1 }).expect(200);
    assert.equal(first.headers['cache-control'], 'no-store');
    assert.equal(first.body.items.length, 1);
    assert.ok(first.body.nextCursor);
    const last = await client.get(adminPath).set(headers).query({ courseId, status: 'NEW', limit: 1, cursor: first.body.nextCursor }).expect(200);
    assert.equal(last.body.nextCursor, null);
    assert.deepEqual(new Set([first.body.items[0].id, last.body.items[0].id]), new Set([input.submissionId, secondId]));
    assert.equal(first.body.items[0].id, [input.submissionId, secondId].sort().reverse()[0]);
    await client.get(adminPath).set(headers).query({ courseId, status: 'CLOSED', cursor: first.body.nextCursor }).expect(400);
    const statusPath = `${adminPath}/${input.submissionId}/status`;
    await client.patch(statusPath).set({ Origin: origin, Authorization: headers.Authorization }).send({ status: 'CONTACTED' }).expect(403);
    await client.patch(statusPath).set({ Authorization: headers.Authorization, 'X-CSRF-Token': headers['X-CSRF-Token'] }).send({ status: 'CONTACTED' }).expect(403);
    const updated = await client.patch(statusPath).set(headers).send({ status: 'CONTACTED' }).expect(200, { id: input.submissionId, status: 'CONTACTED' });
    assert.equal(updated.headers['cache-control'], 'no-store');
    assert.equal((await db.lead.findUniqueOrThrow({ where: { id: input.submissionId } })).status, 'CONTACTED');
    const session = await db.refreshSession.findFirstOrThrow({ where: { csrfHash: sessionCsrfHash } });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: 'Lead', entityId: input.submissionId, action: 'UPDATE' } });
    assert.equal(audit.actorId, session.userId);
    assert.deepEqual(audit.metadata, { previousStatus: 'NEW', status: 'CONTACTED' });
    assert.doesNotMatch(JSON.stringify(audit), /Synthetic Integration|09123456789|synthetic@example.test/);
    await db.lead.update({ where: { id: secondId }, data: { deletedAt: new Date() } });
    await client.patch(`${adminPath}/${secondId}/status`).set(headers).send({ status: 'CLOSED' }).expect(404);
    const hidden = await client.get(adminPath).set(headers).query({ courseId }).expect(200);
    assert.deepEqual(hidden.body.items.map((row: { id: string }) => row.id), [input.submissionId]);
    await db.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await client.get(adminPath).set(headers).expect(401);
  } finally {
    try {
      if (initialized) await db.serial(async (tx) => {
        await tx.auditLog.deleteMany({ where: { entityType: 'Lead', entityId: { in: ids } } });
        await tx.lead.deleteMany({ where: { id: { in: ids } } });
        await tx.course.deleteMany({ where: { id: courseId, departmentId, title: unique } });
        await tx.department.deleteMany({ where: { id: departmentId, label: unique } });
        if (sessionCsrfHash) {
          const sessions = await tx.refreshSession.findMany({ where: { csrfHash: sessionCsrfHash }, select: { id: true, userId: true, createdAt: true } });
          for (const session of sessions) await tx.auditLog.deleteMany({ where: { actorId: session.userId, entityType: 'User', entityId: session.userId, action: 'LOGIN', createdAt: session.createdAt } });
          await tx.refreshSession.deleteMany({ where: { id: { in: sessions.map(({ id }) => id) } } });
        }
      });
    } finally { await app.close(); }
  }
});
