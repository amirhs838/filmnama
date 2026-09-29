import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { Job, Queue } from 'bullmq';
import { Config } from '../src/infrastructure/config';
import { Database } from '../src/infrastructure/infrastructure.module';
import { revalidationBody, RevalidationService, signRevalidation } from '../src/infrastructure/revalidation.module';

const secret = 'test-secret-for-revalidation-signing';
function fixture() {
  const row = { id: 'coutbox', paths: ['/', '/courses/film'], version: 7, deliveredAt: null as Date | null };
  const outbox = {
    findUnique: async (query: unknown) => { assert.deepEqual(query, { where: { id: row.id } }); return row; },
    findMany: async (query: unknown) => { assert.deepEqual(query, { where: { deliveredAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 }); return [row]; },
    updateMany: async (query: unknown) => { assert.deepEqual(query, { where: { id: row.id, version: 7, deliveredAt: null }, data: { deliveredAt: assertDate(query) } }); row.deliveredAt = new Date(); return { count: 1 }; },
  };
  const config = { value: { NEXT_REVALIDATE_URL: 'https://webhook.invalid/api/revalidate', NEXT_REVALIDATE_SECRET: secret } } as Config;
  return { row, outbox, service: new RevalidationService(config, { revalidationOutbox: outbox } as unknown as Database) };
}
function assertDate(query: unknown) {
  const date = (query as { data: { deliveredAt: Date } }).data.deliveredAt;
  assert.ok(date instanceof Date);
  return date;
}

test('signs the exact raw body and validates bounded allowlisted paths', () => {
  const body = revalidationBody(['/', '/courses/film']);
  assert.equal(body, '{"paths":["/","/courses/film"]}');
  assert.equal(signRevalidation(secret, '1700000000', body), createHmac('sha256', secret).update(`1700000000.${body}`).digest('hex'));
  assert.notEqual(signRevalidation(secret, '1700000000', body), signRevalidation(secret, '1700000000', `${body} `));
  for (const paths of [null, [], [1], ['/admin'], ['//example.com'], ['/courses/../admin'], ['/courses?x=1'], ['/courses/%2f'], Array(101).fill('/'), Array(100).fill(`/courses/${'a'.repeat(200)}`)]) assert.throws(() => revalidationBody(paths));
});

test('loads trusted DB paths, signs HTTP and guards duplicate deliveries', async (t) => {
  const { service, row } = fixture();
  const request = t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
    assert.equal(url, 'https://webhook.invalid/api/revalidate');
    assert.equal(options.body, revalidationBody(row.paths));
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, 'POST');
    assert.ok(options.signal instanceof AbortSignal);
    const headers = options.headers as Record<string, string>;
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['x-revalidate-signature'], signRevalidation(secret, headers['x-revalidate-timestamp']!, options.body as string));
    assert.equal(row.deliveredAt, null);
    return new Response(null, { status: 204 });
  });
  await service.deliver({ id: row.id, data: { paths: ['/admin'] } } as Job);
  assert.ok(row.deliveredAt);
  await service.deliver({ id: row.id });
  assert.equal(request.mock.callCount(), 1);
});

test('HTTP and DB failures remain retryable without leaking error details', async (t) => {
  const { service, row, outbox } = fixture();
  const request = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(service.deliver({ id: row.id }), /^Error: Revalidation delivery failed$/);
  assert.equal(row.deliveredAt, null);
  request.mock.mockImplementation(async () => { throw new Error('sensitive URL'); });
  await assert.rejects(service.deliver({ id: row.id }), /^Error: Revalidation delivery failed$/);
  request.mock.mockImplementation(async () => new Response(null, { status: 204 }));
  const update = t.mock.method(outbox, 'updateMany', async () => { throw new Error('sensitive DB detail'); });
  await assert.rejects(service.deliver({ id: row.id }), /^Error: Revalidation delivery failed$/);
  assert.equal(row.deliveredAt, null);
  update.mock.restore();
  await service.deliver({ id: row.id });
  row.deliveredAt = null;
  row.paths = ['/admin'];
  await assert.rejects(service.deliver({ id: row.id }));
  assert.equal(request.mock.callCount(), 4);
});

test('dispatcher deduplicates, waits for failed-job cooldown and recovers exhaustion', async (t) => {
  const { service, row } = fixture();
  let existing: Job | undefined = undefined;
  const retry = t.mock.fn(async () => undefined);
  const queue = {
    getJob: async (id: string) => { assert.equal(id, row.id); return existing; },
    add: t.mock.fn(async (...args: unknown[]) => { assert.deepEqual(args, ['deliver', {}, { jobId: row.id, attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: false }]); return {} as Job; }),
  };
  await service.dispatch(queue as unknown as Queue);
  existing = { getState: async () => 'failed', finishedOn: Date.now(), retry } as unknown as Job;
  await service.dispatch(queue as unknown as Queue);
  assert.equal(retry.mock.callCount(), 0);
  existing.finishedOn = Date.now() - 61000;
  await service.dispatch(queue as unknown as Queue);
  assert.equal(retry.mock.callCount(), 1);
  existing.getState = async () => 'active';
  await service.dispatch(queue as unknown as Queue);
  assert.equal(queue.add.mock.callCount(), 1);
  assert.equal(retry.mock.callCount(), 1);
  await service.onModuleDestroy();
  await service.dispatch(queue as unknown as Queue);
  assert.equal(queue.add.mock.callCount(), 1);
});
