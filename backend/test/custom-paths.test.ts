import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import {
  assertCustomPathFree,
  customPathInput,
  normalizeCustomPath,
  RESERVED_FIRST_SEGMENTS,
  syncCustomPathRedirect,
} from '../src/common/paths';
import { validRevalidationPath } from '../src/common/validation';
import { PathsService } from '../src/paths/paths.module';

test('normalizeCustomPath trims slashes and blanks to null', () => {
  assert.equal(normalizeCustomPath(null), null);
  assert.equal(normalizeCustomPath(undefined), null);
  assert.equal(normalizeCustomPath(''), null);
  assert.equal(normalizeCustomPath('   '), null);
  assert.equal(normalizeCustomPath('///'), null);
  assert.equal(normalizeCustomPath('training-courses/فن-بیان'), 'training-courses/فن-بیان');
  assert.equal(normalizeCustomPath('/training-courses/فن-بیان/'), 'training-courses/فن-بیان');
  assert.equal(normalizeCustomPath('a//b'), 'a/b');
  assert.throws(() => normalizeCustomPath(42), Error);
});

test('customPathInput accepts latin/Persian nesting and rejects reserved shapes', () => {
  const schema = z.object({ customPath: customPathInput.optional() }).strict();
  assert.equal(schema.parse({}).customPath, undefined);
  assert.equal(schema.parse({ customPath: '' }).customPath, null);
  assert.equal(schema.parse({ customPath: '  ' }).customPath, null);
  assert.equal(schema.parse({ customPath: '/training-courses/فن-بیان/' }).customPath, 'training-courses/فن-بیان');
  assert.equal(schema.parse({ customPath: '2022/09/26/مراحل-تدوین-فیلم' }).customPath, '2022/09/26/مراحل-تدوین-فیلم');
  assert.equal(schema.parse({ customPath: 'teacher-of-filmnama/استاد-جدید' }).customPath, 'teacher-of-filmnama/استاد-جدید');
  for (const bad of ['blog/x', 'courses/a/b', 'admin', 'api/v1', 'استادها', 'x'.repeat(201), 'a/b/c/d/e/f', 'has space/x', '../x', 'a//b/c']) {
    if (bad === 'a//b/c') {
      // collapsed by normalization, then valid
      assert.equal(schema.parse({ customPath: bad }).customPath, 'a/b/c');
      continue;
    }
    assert.equal(schema.safeParse({ customPath: bad }).success, false, bad);
  }
  assert.ok(RESERVED_FIRST_SEGMENTS.includes('blog'));
});

test('assertCustomPathFree rejects taken paths and allows self on update', async () => {
  const calls: string[] = [];
  const tx = {
    redirect: { findUnique: async ({ where }: { where: { source: string } }) => (where.source === '/taken-redirect' ? { id: 'r1' } : null) },
    course: { findFirst: async () => null },
    instructor: { findFirst: async () => null },
    post: { findFirst: async ({ where }: { where: Record<string, unknown> }) => (where.customPath === 'taken-post' ? { id: 'p1' } : null) },
    portfolioItem: { findFirst: async () => null },
  };
  await assert.rejects(assertCustomPathFree(tx as never, { owner: 'post', id: null }, 'taken-redirect'), ConflictException);
  await assert.rejects(assertCustomPathFree(tx as never, { owner: 'post', id: null }, 'taken-post'), ConflictException);
  await assertCustomPathFree(tx as never, { owner: 'post', id: null }, 'free-path');
  void calls;
  const selfTx = {
    redirect: { findUnique: async () => null },
    course: { findFirst: async () => null },
    instructor: { findFirst: async () => null },
    post: { findFirst: async ({ where }: { where: { customPath?: string; id?: { not: string } } }) => (where.customPath === 'mine' && where.id?.not === 'p1' ? null : { id: 'other' }) },
    portfolioItem: { findFirst: async () => null },
  };
  await assertCustomPathFree(selfTx as never, { owner: 'post', id: 'p1' }, 'mine');
});

test('syncCustomPathRedirect upserts only on change', async () => {
  const upserts: unknown[] = [];
  const tx = { redirect: { upsert: async (args: unknown) => { upserts.push(args); return {}; } } };
  assert.deepEqual(await syncCustomPathRedirect(tx as never, null, null), new Set());
  assert.deepEqual(await syncCustomPathRedirect(tx as never, 'a/b', 'a/b'), new Set(['/a/b']));
  assert.equal(upserts.length, 0);
  assert.deepEqual(await syncCustomPathRedirect(tx as never, 'a/b', 'c/d'), new Set(['/a/b', '/c/d']));
  assert.equal(upserts.length, 1);
  assert.deepEqual(await syncCustomPathRedirect(tx as never, 'a/b', null), new Set(['/a/b']));
  assert.equal(upserts.length, 2);
});

test('resolve endpoint serves published custom paths only', async () => {
  const past = new Date('2025-01-01T00:00:00Z');
  const db = {
    course: { findFirst: async ({ where }: { where: Record<string, unknown> }) => (where.customPath === 'training-courses/فن-بیان' ? { slug: 'fan', department: { slug: 'cinema' } } : null) },
    post: { findFirst: async () => null },
    instructor: { findFirst: async ({ where }: { where: Record<string, unknown> }) => (where.customPath === 'ostad-ali' ? { slug: 'ali' } : null) },
    portfolioItem: { findFirst: async () => null },
  };
  void past;
  const service = new PathsService(db as never);
  assert.deepEqual(await service.resolve('training-courses/فن-بیان'), { kind: 'course', department: 'cinema', slug: 'fan' });
  assert.deepEqual(await service.resolve('/ostad-ali/'), { kind: 'instructor', department: null, slug: 'ali' });
  await assert.rejects(service.resolve('missing'), NotFoundException);
  await assert.rejects(service.resolve('blog/x'), NotFoundException);
  await assert.rejects(service.resolve('../x'), NotFoundException);
});

test('revalidation accepts custom URL shapes for dispatch', () => {
  assert.equal(validRevalidationPath('/training-courses/فن-بیان/'), true);
  assert.equal(validRevalidationPath('/2022/09/26/مراحل-تدوین-فیلم'), true);
  assert.equal(validRevalidationPath('/courses'), true);
  assert.equal(validRevalidationPath('/blog/my-post'), true);
  assert.equal(validRevalidationPath('no-leading-slash'), false);
});
