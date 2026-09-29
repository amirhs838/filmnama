import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { isRemoteStorageKey } from '../src/media/media.module';
import { InternalRevalidationController, RevalidationService } from '../src/infrastructure/revalidation.module';
import { testConfig } from './auth.fixture';
import { Database } from '../src/infrastructure/infrastructure.module';

test('remote storage keys are blob URLs only', () => {
  assert.equal(isRemoteStorageKey('https://blob.vercel-storage.com/filmnama/x.jpg'), true);
  assert.equal(isRemoteStorageKey('uploads/x.jpg'), false);
  assert.equal(isRemoteStorageKey('/uploads/x.jpg'), false);
  assert.equal(isRemoteStorageKey(''), false);
});

function outboxFixture(deliver: (id: string) => Promise<void>) {
  const rows = [
    { id: 'rowA', paths: ['/', '/courses'], version: 1, deliveredAt: null as Date | null },
    { id: 'rowB', paths: ['/training-courses/x'], version: 2, deliveredAt: null as Date | null },
  ];
  const db = {
    revalidationOutbox: {
      findMany: async () => rows.filter((r) => !r.deliveredAt),
      findUnique: async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null,
      updateMany: async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row || row.deliveredAt) return { count: 0 };
        row.deliveredAt = new Date();
        return { count: 1 };
      },
    },
  };
  void deliver;
  return { rows, db: db as unknown as Database };
}

test('drainOnce delivers pending rows without redis workers', async (t) => {
  const secret = 's'.repeat(32);
  const config = testConfig({ NEXT_REVALIDATE_URL: 'https://web.example.test/revalidate/', NEXT_REVALIDATE_SECRET: secret, CRON_SECRET: 'c'.repeat(32) });
  const { rows, db } = outboxFixture(async () => undefined);
  const service = new RevalidationService(config, db);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  const result = await service.drainOnce(100);
  assert.deepEqual(result, { processed: 2, delivered: 2, failed: 0 });
  assert.ok(rows.every((r) => r.deliveredAt instanceof Date));
  const again = await service.drainOnce(100);
  assert.deepEqual(again, { processed: 0, delivered: 0, failed: 0 });
});

test('internal drain endpoint requires the cron bearer secret', async (t) => {
  const config = testConfig({ NEXT_REVALIDATE_URL: 'https://web.example.test/revalidate/', NEXT_REVALIDATE_SECRET: 'r'.repeat(32), CRON_SECRET: 'c'.repeat(32) });
  const { db } = outboxFixture(async () => undefined);
  const service = new RevalidationService(config, db);
  const controller = new InternalRevalidationController(service, config);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  const req = (auth?: string) => ({ headers: auth ? { authorization: auth } : {} }) as never;
  await assert.rejects(controller.drain(req()), UnauthorizedException);
  await assert.rejects(controller.drain(req('Bearer wrong')), UnauthorizedException);
  await assert.rejects(controller.drain(req('Token ' + 'c'.repeat(32))), UnauthorizedException);
  const ok = await controller.drain(req('Bearer ' + 'c'.repeat(32)));
  assert.deepEqual(ok, { processed: 2, delivered: 2, failed: 0 });
  const noSecret = new InternalRevalidationController(service, testConfig());
  await assert.rejects(noSecret.drain(req('Bearer ' + 'c'.repeat(32))), UnauthorizedException);
});
