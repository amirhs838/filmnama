import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { HttpException, Logger } from '@nestjs/common';
import { Request, Response as ExpressResponse } from 'express';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { CatalogCache } from '../src/catalog/catalog.module';
import { Config } from '../src/infrastructure/config';
import { Database, RedisStore } from '../src/infrastructure/infrastructure.module';
import { RevalidationService, signRevalidation } from '../src/infrastructure/revalidation.module';
import { RateLimiter, rateLimitScript } from '../src/security/rate-limiter';

function config(overrides: Record<string, string | undefined> = {}) {
  const original = process.env;
  process.env = {
    NODE_ENV: 'development', LOCAL_POSTGRES_ONLY: 'true', DATABASE_URL: 'postgresql://localhost:55432/test',
    REDIS_URL: 'redis://localhost:6379', JWT_SECRET: 'j'.repeat(32), CSRF_SECRET: 'c'.repeat(32),
    ALLOWED_ORIGINS: 'https://admin.example.test', NEXT_REVALIDATE_URL: 'https://web.example.test/revalidate',
    NEXT_REVALIDATE_SECRET: 'r'.repeat(32), ...overrides,
  };
  try { return new Config(); }
  finally { process.env = original; }
}

function limiterFixture(disabled: boolean | undefined = true) {
  const redis = { disabled, client: { eval: async (): Promise<unknown> => { throw new Error('Redis unavailable'); } } } as unknown as RedisStore;
  const logger = { warn: () => undefined } as unknown as PinoLogger;
  const limiter = new RateLimiter(redis, logger);
  const headers = new Map<string, unknown>();
  const res = { setHeader: (key: string, value: unknown) => headers.set(key, value) } as unknown as ExpressResponse;
  const check = (path = '/api/v1/public/departments', ip = '127.0.0.1') => limiter.check({ path, ip } as Request, res);
  return { redis, limiter, headers, check };
}

const status = (code: number) => (error: unknown) => error instanceof HttpException && error.getStatus() === code;

test('local PostgreSQL mode requires explicit true and development, rejecting production and test', () => {
  assert.equal(config().localPostgresOnly, true);
  for (const NODE_ENV of ['development', 'production', 'test']) {
    assert.equal(config({ NODE_ENV, LOCAL_POSTGRES_ONLY: 'false' }).localPostgresOnly, false);
    const defaults = config({ NODE_ENV, LOCAL_POSTGRES_ONLY: undefined });
    assert.equal(defaults.value.LOCAL_POSTGRES_ONLY, 'false');
    assert.equal(defaults.localPostgresOnly, false);
  }
  for (const NODE_ENV of ['production', 'test']) assert.throws(() => config({ NODE_ENV }), /LOCAL_POSTGRES_ONLY requires development/);
  for (const flag of ['TRUE', '1', 'yes', '']) assert.throws(() => config({ LOCAL_POSTGRES_ONLY: flag }));
});

test('local RedisStore never connects and catalog reads load fresh without any cache', async (t) => {
  const connect = t.mock.method(Redis.prototype, 'connect', async () => undefined);
  const redis = new RedisStore(config());
  const commands = t.mock.method(redis.client, 'sendCommand', async () => { throw new Error('Unexpected Redis command'); });
  try {
    assert.equal(redis.disabled, true);
    assert.equal(redis.client.options.lazyConnect, true);
    assert.equal(redis.client.options.enableOfflineQueue, false);
    assert.equal(redis.client.status, 'wait');
    const cache = new CatalogCache({} as Database, redis);
    let version = 0;
    const load = async () => ({ version: ++version });
    assert.deepEqual(await cache.read('departments', null, load), { version: 1 });
    assert.deepEqual(await cache.read('departments', null, load), { version: 2 });
    await assert.rejects(cache.read('departments', null, async () => { throw new Error('Database unavailable'); }));
    await new RateLimiter(redis, { warn: () => undefined } as unknown as PinoLogger).check({ path: '/', ip: '127.0.0.1' } as Request, {} as ExpressResponse);
    await setImmediate();
    assert.equal(connect.mock.callCount(), 0);
    assert.equal(commands.mock.callCount(), 0);
  } finally { await redis.onModuleDestroy(); }
});

test('production and legacy config still eagerly connect Redis with original options', async (t) => {
  const connect = t.mock.method(Redis.prototype, 'connect', async () => undefined);
  for (const value of [config({ NODE_ENV: 'production', LOCAL_POSTGRES_ONLY: 'false' }), { value: { REDIS_URL: 'redis://localhost' } } as Config]) {
    const redis = new RedisStore(value);
    try {
      assert.equal(redis.disabled, false);
      assert.equal(redis.client.options.lazyConnect, false);
      assert.equal(redis.client.options.enableOfflineQueue, true);
      assert.equal(redis.client.options.maxRetriesPerRequest, 1);
      assert.equal(redis.client.options.connectTimeout, 3000);
      assert.equal(redis.client.options.commandTimeout, 3000);
    } finally { await redis.onModuleDestroy(); }
  }
  assert.equal(connect.mock.callCount(), 2);
});

test('local fixed windows retain all five policies, exact limits and Retry-After', async (t) => {
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  const policies = [
    { path: '/api/v1/public/departments', limit: 120, window: 60000, ip: () => 'one' },
    { path: '/api/v1/auth/csrf', limit: 30, window: 60000, ip: () => 'one' },
    { path: '/API/V1/AUTH/LOGIN/', limit: 10, window: 900000, ip: () => 'one' },
    { path: '/api/v1/auth/login', limit: 100, window: 60000, ip: (i: number) => `ip-${i}` },
    { path: '/api/v1/public/departments', limit: 3000, window: 60000, ip: (i: number) => `ip-${i}` },
  ];
  for (const policy of policies) {
    const { check, headers } = limiterFixture();
    for (let i = 0; i < policy.limit; i++) await check(policy.path, policy.ip(i));
    await assert.rejects(check(policy.path, policy.ip(policy.limit)), status(429));
    assert.equal(headers.get('Retry-After'), policy.window / 1000);
    now += policy.window - 1;
    await assert.rejects(check(policy.path, policy.ip(policy.limit)), status(429));
    assert.equal(headers.get('Retry-After'), 1);
    now++;
    await check(policy.path, policy.ip(policy.limit));
  }
});

test('local limiter caps at 10000 entries, fails closed without eviction and cleans expired windows', async (t) => {
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  const { limiter, check } = limiterFixture();
  for (let i = 0; i < 9999; i++) {
    if (i < 3000) await check('/', `ip-${i}`);
    else await assert.rejects(check('/', `ip-${i}`), status(429));
  }
  assert.equal(limiter['windows'].size, 10000);
  await assert.rejects(check('/', 'new-ip'), status(503));
  assert.equal(limiter['windows'].size, 10000);
  await assert.rejects(check('/', 'ip-0'), status(429));
  now += 60000;
  await check('/', 'new-ip');
  assert.equal(limiter['windows'].size, 2);
});

test('Redis limiter still executes the original script and fails closed without memory fallback', async (t) => {
  for (const disabled of [false, undefined]) {
    const { redis, check, headers, limiter } = limiterFixture(disabled);
    if (disabled === undefined) delete (redis as { disabled?: boolean }).disabled;
    const evaluate = t.mock.method(redis.client, 'eval', async (...args: unknown[]) => {
      assert.equal(args[0], rateLimitScript);
      assert.equal(args[1], 5);
      assert.deepEqual(args.slice(-10), [3000, 60000, 120, 60000, 30, 60000, 10, 900000, 100, 60000]);
      return [1, 30000];
    });
    await assert.rejects(check('/api/v1/auth/login'), status(429));
    assert.equal(headers.get('Retry-After'), 30);
    evaluate.mock.mockImplementation(async () => { throw new Error('Redis unavailable'); });
    await assert.rejects(check(), status(503));
    evaluate.mock.mockImplementation(async () => [2, 0]);
    await assert.rejects(check(), status(503));
    assert.equal(limiter['windows'].size, 0);
  }
});

test('local outbox polls every five seconds, signs delivery, retries failures and never creates Redis workers', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const connect = t.mock.method(Redis.prototype, 'connect', async () => undefined);
  const warn = t.mock.method(Logger.prototype, 'warn', () => undefined);
  const local = config();
  const row = { id: 'coutbox', paths: ['/', '/courses/film'], version: 7, deliveredAt: null as Date | null };
  const outbox = {
    findMany: t.mock.fn(async (query: unknown) => {
      assert.deepEqual(query, { where: { deliveredAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 });
      return row.deliveredAt ? [] : [row];
    }),
    findUnique: async () => row,
    updateMany: t.mock.fn(async (query: unknown) => {
      const update = query as { where: unknown; data: { deliveredAt: Date } };
      assert.deepEqual(update.where, { id: row.id, version: 7, deliveredAt: null });
      assert.ok(update.data.deliveredAt instanceof Date);
      row.deliveredAt = update.data.deliveredAt;
      return { count: 1 };
    }),
  };
  let finish!: (response: Response) => void;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
    assert.equal(url, local.value.NEXT_REVALIDATE_URL);
    assert.equal(options.body, JSON.stringify({ paths: row.paths }));
    assert.equal(options.redirect, 'error');
    const headers = options.headers as Record<string, string>;
    assert.equal(headers['x-revalidate-signature'], signRevalidation(local.value.NEXT_REVALIDATE_SECRET, headers['x-revalidate-timestamp']!, options.body as string));
    return new Promise<Response>((resolve) => { finish = resolve; });
  });
  const service = new RevalidationService(local, { revalidationOutbox: outbox } as unknown as Database);
  try {
    service.onModuleInit();
    await setImmediate();
    assert.equal(service['queue'], undefined);
    assert.equal(service['worker'], undefined);
    assert.equal(connect.mock.callCount(), 0);
    t.mock.timers.tick(5000);
    await service.dispatch();
    assert.equal(outbox.findMany.mock.callCount(), 1);
    finish(new Response(null, { status: 503 }));
    await setImmediate();
    assert.equal(row.deliveredAt, null);
    assert.deepEqual(warn.mock.calls[0]!.arguments, ['Revalidation dispatch failed: Revalidation delivery failed']);
    t.mock.timers.tick(4999);
    assert.equal(fetchMock.mock.callCount(), 1);
    t.mock.timers.tick(1);
    await setImmediate();
    finish(new Response(null, { status: 204 }));
    await setImmediate();
    assert.ok(row.deliveredAt);
    assert.equal(outbox.updateMany.mock.callCount(), 1);
    t.mock.timers.tick(5000);
    await setImmediate();
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally { await service.onModuleDestroy(); }
  const polls = outbox.findMany.mock.callCount();
  t.mock.timers.tick(10000);
  await service.dispatch();
  assert.equal(outbox.findMany.mock.callCount(), polls);
  assert.equal(connect.mock.callCount(), 0);
});

test('local outbox delivers at most 100 rows per poll and recovers DB failures', async (t) => {
  t.mock.method(Logger.prototype, 'warn', () => undefined);
  const rows = Array.from({ length: 101 }, (_, i) => ({ id: `coutbox${i}`, paths: ['/'], version: 0, deliveredAt: null as Date | null }));
  let fail = true;
  const outbox = {
    findMany: async ({ take }: { take: number }) => {
      assert.equal(take, 100);
      if (fail) { fail = false; throw new Error('Database unavailable'); }
      return rows.filter((row) => !row.deliveredAt).slice(0, take);
    },
    findUnique: async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id),
    updateMany: async ({ where }: { where: { id: string } }) => { rows.find((row) => row.id === where.id)!.deliveredAt = new Date(); return { count: 1 }; },
  };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  const service = new RevalidationService(config(), { revalidationOutbox: outbox } as unknown as Database);
  try {
    await service.dispatch();
    assert.equal(fetchMock.mock.callCount(), 0);
    await service.dispatch();
    assert.equal(fetchMock.mock.callCount(), 100);
    await service.dispatch();
    assert.equal(fetchMock.mock.callCount(), 101);
  } finally { await service.onModuleDestroy(); }
});
