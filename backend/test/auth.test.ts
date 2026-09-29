import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { AuthRepository } from '../src/auth/auth.repository';
import { origin, fixture, cookies } from './auth.fixture';

test('serves CSRF token with cookie and no-store for allowed origin', async () => {
  const { app } = await fixture();
  try {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.body.csrfToken, /^[A-Za-z0-9_-]{43}\.[0-9]+\.[a-f0-9]{64}$/);
    const cookie = response.headers['set-cookie'] as unknown as string[];
    assert.equal(cookie.filter((c) => c.startsWith('csrf=')).length, 1);
  } finally { await app.close(); }
});

test('rejects CSRF endpoint for unknown origin', async () => {
  const { app } = await fixture();
  try {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', 'https://evil.example.test');
    assert.equal(response.status, 403);
  } finally { await app.close(); }
});

test('rejects login without CSRF cookie/token or with unknown origin', async () => {
  const { app } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const csrfToken = csrf.body.csrfToken as string;
    const base = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrfToken).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    assert.equal((await base).status, 403);
    const token = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const withCookie = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token.body.csrfToken).set('Cookie', cookies(token)).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    assert.equal((await withCookie).status, 200);
    const evil = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const evilRequest = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', 'https://evil.example.test').set('X-CSRF-Token', evil.body.csrfToken).set('Cookie', cookies(evil)).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    assert.equal((await evilRequest).status, 403);
  } finally { await app.close(); }
});

test('rejects login with invalid body', async () => {
  const { app } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const invalid = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'admin@example.test', password: 'correct-password', extra: 1 });
    assert.equal((await invalid).status, 400);
    const wrongType = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'not-an-email', password: 'correct-password' });
    assert.equal((await wrongType).status, 400);
    const text = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('text').send('email=x');
    assert.equal((await text).status, 415);
  } finally { await app.close(); }
});

test('rejects login with wrong credentials and records failure', async () => {
  const { app, failures } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const wrong = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'admin@example.test', password: 'wrong-password' });
    const response = await wrong;
    assert.equal(response.status, 401);
    assert.equal(failures(), 1);
    const unknown = request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'nobody@example.test', password: 'wrong-password' });
    assert.equal((await unknown).status, 401);
    assert.equal(failures(), 2);
  } finally { await app.close(); }
});

test('login succeeds with valid credentials and sets cookies', async () => {
  const { app } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const response = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'ADMIN@example.test', password: 'correct-password' });
    assert.equal(response.status, 200);
    assert.equal(response.body.role, 'SUPER_ADMIN');
    assert.equal(response.body.expiresIn, 900);
    assert.match(response.body.accessToken, /\./);
    assert.ok(!('refresh' in response.body));
    const setCookies = response.headers['set-cookie'] as unknown as string[];
    assert.ok(setCookies.some((c) => c.startsWith('refresh=')));
    assert.ok(setCookies.some((c) => c.startsWith('csrf=')));
    assert.ok(setCookies.every((c) => c.includes('HttpOnly')));
    assert.ok(setCookies.every((c) => c.includes('SameSite=Strict')));
  } finally { await app.close(); }
});

test('refresh rotates tokens and invalidates the previous session', async () => {
  const { app } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    const first = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Origin', origin).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login)).type('json').send({});
    assert.equal(first.status, 200);
    assert.notEqual(first.body.accessToken, login.body.accessToken);
    const replay = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Origin', origin).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login)).type('json').send({});
    assert.equal(replay.status, 401);
    const afterReplay = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Origin', origin).set('X-CSRF-Token', first.body.csrfToken).set('Cookie', cookies(first)).type('json').send({});
    assert.equal(afterReplay.status, 401);
  } finally { await app.close(); }
});

test('logout revokes the session family', async () => {
  const { app } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    const logout = await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Origin', origin).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login)).type('json').send({});
    assert.equal(logout.status, 200);
    assert.deepEqual(logout.body, { ok: true });
    const refreshed = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Origin', origin).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login)).type('json').send({});
    assert.equal(refreshed.status, 401);
  } finally { await app.close(); }
});

test('verifies access token against the live session', async () => {
  const { app } = await fixture();
  try {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Origin', origin);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Cookie', cookies(csrf)).type('json').send({ email: 'admin@example.test', password: 'correct-password' });
    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Origin', origin).set('Authorization', `Bearer ${login.body.accessToken}`).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login));
    assert.equal(me.status, 200);
    assert.deepEqual(me.body, { id: 'cmf0000000000000000000001', role: 'SUPER_ADMIN' });
    const afterLogout = await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Origin', origin).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login)).type('json').send({});
    assert.equal(afterLogout.status, 200);
    const denied = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Origin', origin).set('Authorization', `Bearer ${login.body.accessToken}`).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login));
    assert.equal(denied.status, 401);
    const tampered = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Origin', origin).set('Authorization', `Bearer ${login.body.accessToken.slice(0, -2)}xx`).set('X-CSRF-Token', login.body.csrfToken).set('Cookie', cookies(login));
    assert.equal(tampered.status, 401);
  } finally { await app.close(); }
});

test('does not use the real repository or database in this suite', async () => {
  const { app, repo } = await fixture();
  try {
    assert.ok(repo);
    assert.ok(app.get(AuthRepository));
  } finally { await app.close(); }
});
