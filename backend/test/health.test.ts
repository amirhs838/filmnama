import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthModule } from '../src/health/health.module';

test('Nest serves the versioned liveness endpoint', async () => {
  const module = await Test.createTestingModule({ imports: [HealthModule] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  try {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok' });
  } finally {
    await app.close();
  }
});
