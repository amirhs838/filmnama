import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { origin, fixture, testConfig, cookies } from './auth.fixture';

test('admin access change requires SUPER_ADMIN role', async () => {
  const { app } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    const target = 'cmf0000000000000000000002';
    const granted = await request(app.getHttpServer()).patch(`/api/v1/admin/users/${target}/access`).set('Origin', origin).set('Authorization', `Bearer ${login.body.accessToken}`).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login)).type('json').send({ role: 'CONTENT_MANAGER', active: false });
    assert.equal(granted.status, 200);
    assert.deepEqual(granted.body, { id: target, role: 'CONTENT_MANAGER', active: false });
  } finally { await app.close(); }
});

test('rejects admin access change for non super admins', async () => {
  const { app } = await fixture({ role: 'BLOG_EDITOR' });
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    const forbidden = await request(app.getHttpServer()).patch('/api/v1/admin/users/cmf0000000000000000000002/access').set('Origin', origin).set('Authorization', `Bearer ${login.body.accessToken}`).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login)).type('json').send({ role: 'BLOG_EDITOR', active: true });
    assert.equal(forbidden.status, 403);
  } finally { await app.close(); }
});

test('rejects admin and auth endpoints when the caller is outside the allowlist', async () => {
  const config = testConfig({ ADMIN_IP_ALLOWLIST: '203.0.113.0/24' });
  const { app } = await fixture({ config });
  try {
    const denied = await request(app.getHttpServer()).patch('/api/v1/admin/users/abc/access').set('Origin', origin).type('json').send({ role: 'BLOG_EDITOR', active: true });
    assert.equal(denied.status, 403);
    const authDenied = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    assert.equal(authDenied.status, 403);
  } finally { await app.close(); }
});

test('blocks requests when the limiter rejects and fails closed when redis is unavailable', async () => {
  const { app, redis } = await fixture();
  try {
    redis.client.eval = async () => [1, 30000];
    const limited = await request(app.getHttpServer()).get('/api/v1/health/live');
    assert.equal(limited.status, 429);
    assert.ok(limited.headers['retry-after']);
    redis.client.eval = async () => { throw new Error('unavailable'); };
    const failing = await request(app.getHttpServer()).get('/api/v1/health/live');
    assert.equal(failing.status, 503);
  } finally { await app.close(); }
});

test('rejects requests with untrusted origins and json only bodies', async () => {
  const { app } = await fixture();
  try {
    const evil = await request(app.getHttpServer()).get('/api/v1/health/live').set('Origin', 'https://evil.example.test');
    assert.equal(evil.status, 403);
    const missing = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).type('json').send({ email: 'a@example.test', password: 'x' });
    assert.equal(missing.status, 403);
    const text = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Origin', origin).type('text').send('x');
    assert.equal(text.status, 415);
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const huge = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send('x'.repeat(100000));
    assert.equal(huge.status, 413);
  } finally { await app.close(); }
});
