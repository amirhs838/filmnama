import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Lead, Prisma, Role } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthRepository } from '../src/auth/auth.repository';
import { hash } from '../src/common/validation';
import { Config } from '../src/infrastructure/config';
import { Database, RedisStore } from '../src/infrastructure/infrastructure.module';
import { RevalidationService } from '../src/infrastructure/revalidation.module';
import { leadListSchema, leadSchema, leadStatusSchema } from '../src/leads.dto';
import { LeadsRepository } from '../src/leads.module';
import { isPublicLeadsPath, RateLimiter } from '../src/security/rate-limiter';
import { configureApp } from '../src/security/runtime';
import { origin, testConfig } from './auth.fixture';

const payload = () => ({ submissionId: randomUUID(), name: ' Synthetic Lead ', phone: '+۹۸۹۱۲۳۴۵۶۷۸۹', consent: true });
const now = new Date('2026-01-01T00:00:00.000Z');
function fixture() {
  let rows: Lead[] = [];
  let audits: Prisma.AuditLogUncheckedCreateInput[] = [];
  let active = false;
  let failAudit = false;
  let courseVisible = true;
  let serialCalls = 0;
  const courseCalls: Prisma.CourseFindFirstArgs[] = [];
  const listCalls: Prisma.LeadFindManyArgs[] = [];
  const tx = {
    lead: {
      findUnique: async ({ where }: Prisma.LeadFindUniqueArgs) => rows.find((row) => row.id === where.id) ?? null,
      findFirst: async ({ where }: Prisma.LeadFindFirstArgs) => structuredClone(rows.find((row) => row.id === where?.id && row.deletedAt === null) ?? null),
      create: async ({ data }: { data: Prisma.LeadUncheckedCreateInput }) => {
        assert.ok(active);
        const row: Lead = { id: data.id!, name: data.name, phone: data.phone, email: data.email ?? null, message: data.message ?? null, courseId: data.courseId ?? null, status: 'NEW', consentAt: new Date(data.consentAt), locale: data.locale!, createdAt: now, updatedAt: now, deletedAt: null };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string; deletedAt: null }; data: { status: Lead['status'] } }) => {
        assert.ok(active);
        assert.equal(where.deletedAt, null);
        const row = rows.find((row) => row.id === where.id)!;
        row.status = data.status;
        return { id: row.id, status: row.status };
      },
      findMany: async (args: Prisma.LeadFindManyArgs) => {
        listCalls.push(args);
        assert.deepEqual(args.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
        assert.equal(args.where?.deletedAt, null);
        const where = args.where!;
        const position = where.OR?.[1];
        const result = rows.filter((row) => row.deletedAt === null && (!where.status || row.status === where.status) && (!where.courseId || row.courseId === where.courseId)
          && (!position || row.createdAt < (position.createdAt as Date) || (row.createdAt.getTime() === (position.createdAt as Date).getTime() && row.id < (position.id as Prisma.StringFilter).lt!)))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1)).slice(0, args.take!);
        return result.map(({ deletedAt: _deleted, ...row }) => { void _deleted; return row; });
      },
    },
    course: { findFirst: async (args: Prisma.CourseFindFirstArgs) => { courseCalls.push(args); return courseVisible ? { id: 'course' } : null; } },
    auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => { assert.ok(active); if (failAudit) throw new Error('Audit unavailable'); audits.push(data); } },
  };
  const db = { ...tx, serial: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
    serialCalls++;
    const before = structuredClone({ rows, audits });
    active = true;
    try { return await operation(tx as unknown as Prisma.TransactionClient); }
    catch (error) { rows = before.rows; audits = before.audits; throw error; }
    finally { active = false; }
  } } as unknown as Database;
  return { db, repo: new LeadsRepository(db), courseCalls, listCalls, get rows() { return rows; }, get audits() { return audits; }, get serialCalls() { return serialCalls; }, hideCourse() { courseVisible = false; }, failAudit() { failAudit = true; } };
}

test('lead input is strict, consent is literal true, digits/prefixes and blanks normalize', () => {
  const input = payload();
  for (const phone of ['۰۹۱۲۳۴۵۶۷۸۹', '٠٩١٢٣٤٥٦٧٨٩', '+989123456789', '00989123456789', ' 09123456789 ']) {
    assert.deepEqual(leadSchema.parse({ ...input, phone, email: ' ', message: '\n', courseId: '' }), { submissionId: input.submissionId, name: 'Synthetic Lead', phone: '09123456789', email: null, message: null, courseId: null, consent: true });
  }
  assert.equal(leadSchema.parse({ ...input, email: ' SYNTHETIC@EXAMPLE.TEST ' }).email, 'synthetic@example.test');
  assert.equal(leadSchema.parse({ ...input, submissionId: input.submissionId.toUpperCase() }).submissionId, input.submissionId);
  for (const patch of [
    { consent: false }, { consent: 'true' }, { consent: 1 }, { consent: undefined }, { consentAt: now }, { locale: 'en' }, { status: 'CLOSED' },
    { submissionId: 'invalid' }, { name: ' a ' }, { name: 'a'.repeat(101) }, { name: 2 }, { phone: 9123456789 },
    { phone: '+9809123456789' }, { phone: '9123456789' }, { phone: '02112345678' }, { phone: '0912 345 6789' }, { phone: '091234567890' },
    { email: null }, { email: 'bad' }, { email: `${'a'.repeat(250)}@test.test` }, { message: null }, { message: 'a'.repeat(2001) }, { courseId: null }, { courseId: 'a'.repeat(101) },
  ]) assert.equal(leadSchema.safeParse({ ...input, ...patch }).success, false, JSON.stringify(patch));
  for (const value of [null, [], 'text']) assert.equal(leadSchema.safeParse(value).success, false);
  assert.ok(leadSchema.safeParse({ ...input, name: 'a'.repeat(100), message: 'a'.repeat(2000), courseId: 'a'.repeat(100) }).success);
  for (const status of ['NEW', 'CONTACTED', 'CLOSED']) assert.ok(leadStatusSchema.safeParse({ status }).success);
  for (const value of [{ status: 'new' }, { status: 'NEW', name: 'other' }, {}]) assert.equal(leadStatusSchema.safeParse(value).success, false);
});

test('submission uses serial, returns no identifiers, replays normalized input before visibility, and conflicts generically', async () => {
  const f = fixture();
  const input = leadSchema.parse({ ...payload(), courseId: 'course' });
  const before = Date.now();
  assert.deepEqual(await f.repo.submit(input), { accepted: true });
  assert.ok(f.rows[0]!.consentAt.getTime() >= before && f.rows[0]!.consentAt.getTime() <= Date.now());
  assert.equal(f.rows[0]!.locale, 'fa');
  assert.equal(f.rows[0]!.id, input.submissionId);
  assert.equal(f.serialCalls, 1);
  const cutoff = (f.courseCalls[0]!.where!.publishedAt as Prisma.DateTimeNullableFilter).lte;
  assert.deepEqual(f.courseCalls[0], { where: { id: 'course', status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: cutoff }, department: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: cutoff } } }, select: { id: true } });
  f.hideCourse();
  await f.repo.updateStatus('actor', input.submissionId, { status: 'CLOSED' });
  f.rows[0]!.deletedAt = now;
  const saved = structuredClone(f.rows[0]);
  assert.deepEqual(await f.repo.submit(input), { accepted: true });
  assert.deepEqual(f.rows, [saved]);
  assert.equal(f.courseCalls.length, 1);
  for (const patch of [{ name: 'Other' }, { phone: '09999999999' }, { email: 'other@example.test' }, { message: 'other' }, { courseId: 'other' }]) await assert.rejects(f.repo.submit({ ...input, ...patch }), ConflictException);
  await assert.rejects(f.repo.submit({ ...input, submissionId: randomUUID() }), BadRequestException);
  assert.deepEqual(f.audits, [
    { entityType: 'Lead', entityId: input.submissionId, action: 'CREATE', metadata: { status: 'NEW' } },
    { actorId: 'actor', entityType: 'Lead', entityId: input.submissionId, action: 'UPDATE', metadata: { previousStatus: 'NEW', status: 'CLOSED' } },
  ]);
});

test('a concurrent unique collision rechecks the winning submission inside serial', async () => {
  const f = fixture();
  const input = leadSchema.parse(payload());
  await f.repo.submit(input);
  const serial = f.db.serial.bind(f.db);
  let collision = true;
  f.db.serial = async (operation) => {
    if (collision) { collision = false; throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '6.19.0' }); }
    return serial(operation);
  };
  assert.deepEqual(await f.repo.submit(input), { accepted: true });
  assert.equal(f.rows.length, 1);
  assert.equal(f.audits.length, 1);
});

test('status and creation roll back on audit failure; missing/deleted leads stay hidden', async () => {
  const f = fixture();
  const input = leadSchema.parse(payload());
  await f.repo.submit(input);
  f.failAudit();
  await assert.rejects(f.repo.updateStatus('actor', input.submissionId, { status: 'CONTACTED' }), /Audit unavailable/);
  assert.equal(f.rows[0]!.status, 'NEW');
  await assert.rejects(f.repo.submit(leadSchema.parse(payload())), /Audit unavailable/);
  assert.equal(f.rows.length, 1);
  assert.equal(f.audits.length, 1);
  f.rows[0]!.deletedAt = now;
  await assert.rejects(f.repo.updateStatus('actor', input.submissionId, { status: 'CLOSED' }), NotFoundException);
  await assert.rejects(f.repo.updateStatus('actor', randomUUID(), { status: 'CLOSED' }), NotFoundException);
  assert.deepEqual(await f.repo.list(leadListSchema.parse({})), { items: [], nextCursor: null });
});

test('list uses createdAt/id keysets, bound filters, strict canonical cursors and capped limits', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) await f.repo.submit(leadSchema.parse({ ...payload(), courseId: 'course' }));
  f.rows[0]!.createdAt = new Date(now.getTime() + 1000);
  f.rows[1]!.status = 'CLOSED';
  f.rows[2]!.deletedAt = now;
  const query = { status: 'NEW', courseId: 'course', limit: '1' };
  const first = await f.repo.list(leadListSchema.parse(query));
  assert.equal(first.items[0]!.id, f.rows[0]!.id);
  assert.ok(first.nextCursor);
  const seen = [first.items[0]!.id];
  let cursor: string | null = first.nextCursor;
  f.rows[0]!.deletedAt = now;
  while (cursor) {
    const page = await f.repo.list(leadListSchema.parse({ ...query, cursor }));
    seen.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor;
  }
  assert.equal(seen.length, 3);
  assert.equal(new Set(seen).size, 3);
  const decoded = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString()) as Record<string, unknown>;
  for (const value of ['x', `${first.nextCursor}=`, Buffer.from('{}').toString('base64url'), ...[{ ...decoded, createdAt: 'invalid' }, { ...decoded, createdAt: '2026-02-30T00:00:00.000Z' }, { ...decoded, id: [] }, { ...decoded, extra: 1 }].map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))]) {
    await assert.rejects(async () => f.repo.list(leadListSchema.parse({ ...query, cursor: value })), (error: unknown) => error instanceof BadRequestException || (error instanceof Error && error.name === 'ZodError'));
  }
  await assert.rejects(f.repo.list(leadListSchema.parse({ ...query, status: 'CLOSED', cursor: first.nextCursor })), BadRequestException);
  await assert.rejects(f.repo.list(leadListSchema.parse({ ...query, courseId: 'other', cursor: first.nextCursor })), BadRequestException);
  for (const value of [{ limit: '101' }, { limit: '0' }, { limit: '-1' }, { limit: '1.5' }, { limit: ['1'] }, { limit: '' }, { limit: '1e2' }, { unknown: 'x' }, { status: 'bad' }, { courseId: '' }]) assert.equal(leadListSchema.safeParse(value).success, false);
  assert.equal(leadListSchema.parse({}).limit, 20);
  assert.equal(leadListSchema.parse({ limit: '100' }).limit, 100);
});

async function httpFixture(localLimiter = false) {
  const f = fixture();
  const config = testConfig();
  const csrf = 'synthetic-csrf';
  const user = { id: 'synthetic-admin', role: 'SUPER_ADMIN' as Role };
  let live = true;
  let rateCalls = 0;
  const redis = { disabled: localLimiter, client: { eval: async () => { rateCalls++; return [0, 0]; } } };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Config).useValue(config)
    .overrideProvider(Database).useValue(f.db)
    .overrideProvider(RedisStore).useValue(redis)
    .overrideProvider(RevalidationService).useValue({})
    .overrideProvider(AuthRepository).useValue({ liveSession: async (id: string, userId: string) => live && id === 'session' && userId === user.id ? { id, user, csrfHash: hash(csrf) } : null })
    .compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  const token = jwt.sign({ sid: 'session' }, config.value.JWT_SECRET, { algorithm: 'HS256', subject: user.id, issuer: config.value.JWT_ISSUER, audience: config.value.JWT_AUDIENCE, expiresIn: '15m' });
  return { ...f, app, user, redis, headers: { Origin: origin, Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf }, revoke() { live = false; }, rateCalls: () => rateCalls };
}

test('AppModule leads enforce exact Origin/JSON, strict input, SUPER_ADMIN, live sessions and existing CSRF', async () => {
  const f = await httpFixture();
  const client = request(f.app.getHttpServer());
  const path = '/api/v1/public/leads';
  try {
    const input = payload();
    for (const suppliedOrigin of [undefined, 'null', `${origin}/`, 'https://evil.example.test']) {
      const req = client.post(path).send(input);
      if (suppliedOrigin) req.set('Origin', suppliedOrigin);
      const denied = await req.expect(403);
      assert.equal(denied.headers['cache-control'], 'no-store');
    }
    await client.post(path).set('Origin', origin).type('text').send('invalid').expect(415);
    await client.post(path).set('Origin', origin).type('json').send('{bad').expect(400);
    await client.post(path).set('Origin', origin).send({ ...input, consent: false }).expect(400);
    await client.post(path).set('Origin', origin).send({ ...input, extra: 'x' }).expect(400);
    const accepted = await client.post(path).set('Origin', origin).send(input).expect(201, { accepted: true });
    assert.equal(accepted.headers['cache-control'], 'no-store');
    await client.post(`${path}/`).set('Origin', origin).send({ ...input, phone: '09123456789' }).expect(201, { accepted: true });
    const conflict = await client.post(path).set('Origin', origin).send({ ...input, name: 'Different' }).expect(409);
    assert.equal(conflict.body.message, 'Conflict');
    assert.doesNotMatch(JSON.stringify(conflict.body), /Different|Synthetic|09123456789/);
    const admin = '/api/v1/admin/leads';
    const statusPath = `${admin}/${input.submissionId}/status`;
    await client.get(admin).expect(401);
    for (const role of ['CONTENT_MANAGER', 'BLOG_EDITOR'] as const) {
      f.user.role = role;
      await client.get(admin).set(f.headers).expect(403);
      await client.patch(statusPath).set(f.headers).send({ status: 'CONTACTED' }).expect(403);
    }
    f.user.role = 'SUPER_ADMIN';
    const list = await client.get(admin).set(f.headers).query({ limit: 1 }).expect(200);
    assert.equal(list.headers['cache-control'], 'no-store');
    assert.equal(list.body.items[0].id, input.submissionId);
    assert.deepEqual(Object.keys(list.body).sort(), ['items', 'nextCursor']);
    await client.get(admin).set(f.headers).query({ limit: 101 }).expect(400);
    await client.get(admin).set(f.headers).query({ cursor: 'not-a-cursor' }).expect(400);
    await client.patch(statusPath).set({ Origin: origin, Authorization: f.headers.Authorization }).send({ status: 'CONTACTED' }).expect(403);
    await client.patch(statusPath).set({ Authorization: f.headers.Authorization, 'X-CSRF-Token': f.headers['X-CSRF-Token'] }).send({ status: 'CONTACTED' }).expect(403);
    await client.patch(statusPath).set({ ...f.headers, 'X-CSRF-Token': 'wrong' }).send({ status: 'CONTACTED' }).expect(403);
    await client.patch(statusPath).set(f.headers).send({ status: 'CONTACTED', name: 'forbidden' }).expect(400);
    const updated = await client.patch(statusPath).set(f.headers).send({ status: 'CONTACTED' }).expect(200, { id: input.submissionId, status: 'CONTACTED' });
    assert.equal(updated.headers['cache-control'], 'no-store');
    f.revoke();
    await client.get(admin).set(f.headers).expect(401);
    await client.patch(statusPath).set(f.headers).send({ status: 'CLOSED' }).expect(401);
    assert.ok(f.rateCalls() > 0);
  } finally { await f.app.close(); }
});

test('public lead limits run before body validation and cover case/trailing slash paths', async () => {
  const f = await httpFixture(true);
  try {
    const client = request(f.app.getHttpServer());
    for (let i = 0; i < 10; i++) await client.post(i % 2 ? '/API/V1/PUBLIC/LEADS/' : '/api/v1/public/leads').set('Origin', origin).send({}).expect(400);
    const denied = await client.post('/api/v1/public/leads').set('Origin', origin).send(payload()).expect(429);
    assert.equal(denied.headers['cache-control'], 'no-store');
    assert.ok(Number(denied.headers['retry-after']) > 0);
    assert.equal(f.rows.length, 0);
  } finally { await f.app.close(); }
});

test('lead limiter uses only hashed IP/global keys, exact budgets and fail-closed Redis', async () => {
  const calls: (string | number)[][] = [];
  const redis = { client: { eval: async (...args: (string | number)[]) => { calls.push(args); return [0, 0]; } } } as unknown as RedisStore;
  const limiter = new RateLimiter(redis, { warn: () => undefined } as unknown as PinoLogger);
  const req = { method: 'POST', path: '/api/v1/public/leads/', ip: '192.0.2.42', body: payload() } as unknown as Request;
  const res = { setHeader: () => undefined } as unknown as Response;
  await limiter.check(req, res);
  assert.deepEqual(calls[0]!.slice(1), [4, 'rate:{api}:global', `rate:{api}:ip:${hash(req.ip!)}`, `rate:{api}:leads:${hash(req.ip!)}`, 'rate:{api}:leads-global', 3000, 60000, 120, 60000, 10, 900000, 100, 60000]);
  assert.ok(isPublicLeadsPath('/API/v1/public/%6ceads/'));
  assert.equal(isPublicLeadsPath('/api/v1/public/leads/extra'), false);
  for (const method of ['GET', 'OPTIONS']) { await limiter.check({ ...req, method } as Request, res); assert.equal(calls.at(-1)![1], 2); }
  redis.client.eval = async () => { throw new Error('Unavailable'); };
  await assert.rejects(limiter.check(req, res), (error: unknown) => error instanceof Error && error.message === 'Service Unavailable');
  const local = new RateLimiter({ disabled: true } as RedisStore, {} as PinoLogger);
  for (let i = 0; i < 100; i++) await local.check({ ...req, ip: `192.0.2.${i}` } as Request, res);
  await assert.rejects(local.check({ ...req, ip: '192.0.2.200' } as Request, res), (error: unknown) => error instanceof Error && error.message === 'Too many requests');
});
