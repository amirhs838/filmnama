import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthRepository } from '../src/auth/auth.repository';
import { Config } from '../src/infrastructure/config';
import { Database, RedisStore } from '../src/infrastructure/infrastructure.module';
import { RevalidationService } from '../src/infrastructure/revalidation.module';
import { createApp } from '../src/main';
import { origin, testConfig } from './auth.fixture';

test('AppModule wires HTTP routes with mocked infrastructure', async (t) => {
  const updatedAt = new Date('2026-01-01T00:00:00Z');
  const department = {
    id: 'cmf0000000000000000000001', slug: 'film', label: 'Film', latin: 'Film',
    description: 'Published film department', updatedAt, status: 'PUBLISHED',
    deletedAt: null, publishedAt: updatedAt, createdAt: updatedAt,
    seoTitle: 'Internal SEO title', seoDescription: null, canonicalUrl: null, noindex: false,
  };
  const calls: Prisma.DepartmentFindManyArgs[] = [];
  const db = {
    department: { findMany: async (args: Prisma.DepartmentFindManyArgs) => { calls.push(args); return [department]; } },
    contentRevision: { findUnique: async () => ({ version: 0 }) },
  };
  const redis = { client: { eval: async () => [0, 0], get: async () => null, set: async () => 'OK' } };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Config).useValue(testConfig())
    .overrideProvider(Database).useValue(db)
    .overrideProvider(RedisStore).useValue(redis)
    .overrideProvider(AuthRepository).useValue({})
    .overrideProvider(RevalidationService).useValue({})
    .compile();
  const app = await createApp(async () => module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false }));
  try {
    await t.test('public departments use publication filters and expose only the public DTO', async () => {
      const before = Date.now();
      const response = await request(app.getHttpServer()).get('/api/v1/public/departments').expect(200);
      const after = Date.now();
      assert.deepEqual(response.body, { items: [{
        id: department.id, slug: 'film', label: 'Film', latin: 'Film',
        description: 'Published film department', updatedAt: updatedAt.toISOString(),
      }] });
      assert.equal(calls.length, 1);
      const args = calls[0]!;
      const cutoff = (args.where?.publishedAt as Prisma.DateTimeNullableFilter | undefined)?.lte;
      assert.ok(cutoff instanceof Date);
      assert.ok(cutoff.getTime() >= before && cutoff.getTime() <= after);
      assert.deepEqual(args.where, { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: cutoff } });
      assert.deepEqual(args.select, { id: true, slug: true, label: true, latin: true, description: true, updatedAt: true });
    });
    await t.test('admin departments are registered and reject requests without a token', async () => {
      const before = calls.length;
      await request(app.getHttpServer()).get('/api/v1/admin/departments').expect(401);
      assert.equal(calls.length, before);
    });
    await t.test('CSRF endpoint accepts the configured origin', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin).expect(200);
      assert.equal(typeof response.body.csrfToken, 'string');
      assert.ok(response.body.csrfToken.length > 0);
      assert.equal(response.headers['access-control-allow-origin'], origin);
    });
    await t.test('liveness endpoint is registered', async () => {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200, { status: 'ok' });
    });
  } finally { await app.close(); }
});
