import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import content from '../prisma/course-content.json';
import { main, seedContent } from '../prisma/seed';
import { cleanHtml, validRevalidationPath } from '../src/common/validation';

const ids = ['acting', 'cinematography', 'directing', 'makeup', 'editing', 'filmmaking', 'vfx', 'music', 'programming', 'ai', 'it', 'language'];

test('course content has exactly twelve complete, distinct Persian course entries', () => {
  assert.deepEqual(Object.keys(content).sort(), [...ids].sort());
  const questions = new Set<string>();
  for (const [id, course] of Object.entries(content)) {
    assert.deepEqual(Object.keys(course).sort(), ['contentHtml', 'faq', 'seoDescription', 'seoTitle', 'syllabus']);
    assert.equal(cleanHtml(course.contentHtml), course.contentHtml, id);
    assert.doesNotMatch(JSON.stringify(course), /\uFFFD|TODO|TBD|Lorem ipsum/i, id);
    const tags = course.contentHtml.match(/<[^>]+>/g) ?? [];
    assert.ok(tags.length > 0, id);
    const stack: string[] = [];
    for (const tag of tags) {
      assert.match(tag, /^<\/?(?:p|h3|ul|li)>$/, id);
      if (tag.startsWith('</')) assert.equal(stack.pop(), tag.slice(2, -1), id);
      else stack.push(tag.slice(1, -1));
    }
    assert.equal(stack.length, 0, id);
    const words = course.contentHtml.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
    assert.ok(words >= 220 && words <= 320, `${id}: ${words} HTML words`);
    for (const heading of ['مخاطب و پیش‌نیاز', 'دستاوردهای قابل سنجش', 'پروژه پیشنهادی و ارزیابی', 'تجهیزات و ادامه مسیر']) {
      assert.ok(course.contentHtml.includes(`<h3>${heading}</h3>`), `${id}: ${heading}`);
    }
    assert.equal((course.contentHtml.match(/<li>/g) ?? []).length, 3, id);
    assert.match(course.contentHtml, /آموزشگاه/, id);
    assert.equal(course.syllabus.length, 8, id);
    assert.equal(new Set(course.syllabus).size, 8, id);
    assert.ok(course.syllabus.every((item) => item.length >= 15 && /[آ-ی]/.test(item)), id);
    assert.equal(course.faq.length, 6, id);
    for (const faq of course.faq) {
      assert.deepEqual(Object.keys(faq).sort(), ['answer', 'question']);
      assert.ok(faq.question.length > 15 && faq.answer.length > 50, id);
      assert.doesNotMatch(faq.question + faq.answer, /[<>]/, id);
      const normalized = faq.question.normalize('NFKC').trim();
      assert.ok(!questions.has(normalized), `${id}: duplicate question`);
      questions.add(normalized);
    }
    assert.ok(course.seoTitle.length >= 25 && course.seoTitle.length <= 200, id);
    assert.ok(course.seoDescription.length >= 80 && course.seoDescription.length <= 400, id);
  }
  for (const field of ['contentHtml', 'seoTitle', 'seoDescription'] as const) {
    assert.equal(new Set(Object.values(content).map((course) => course[field])).size, 12, field);
  }
});

test('intermediate prerequisites and defensive-only IT scope remain explicit', () => {
  for (const id of ['directing', 'vfx', 'ai'] as const) assert.match(content[id].contentHtml, /سطح متوسط/, id);
  assert.match(content.it.contentHtml, /کاملاً دفاعی/);
  assert.match(content.it.contentHtml, /محیط آزمایشگاهی مجاز/);
  assert.match(content.it.contentHtml, /تمرین نفوذ، دور زدن دسترسی یا اختلال در این مسیر جای ندارد/);
});

type Row = {
  id: string;
  slug: string;
  departmentId: string;
  department: { slug: string };
  contentHtml: string;
  syllabus: string[];
  faq: { question: string; answer: string; position: number }[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: string;
  instructors: string[];
  title: string;
  deletedAt: Date | null;
};

function fixture(populated = true) {
  const rows = new Map<string, Row>();
  if (populated) for (const id of ids) {
    const departmentId = ids.indexOf(id) < 7 ? 'cinema' : 'tech';
    rows.set(id, { id, slug: id, departmentId, department: { slug: departmentId }, contentHtml: '<p>Editor content</p>', syllabus: ['Editor syllabus'], faq: [{ question: 'Editor question?', answer: 'Editor answer', position: 0 }], seoTitle: 'Editor title', seoDescription: 'Editor description', status: 'DRAFT', instructors: ['editor-instructor'], title: 'Editor course', deletedAt: null });
  }
  const writes: Prisma.CourseUpsertArgs[] = [];
  const outbox: { version: number; paths: string[] }[] = [];
  const revisions: Prisma.ContentRevisionUpsertArgs[] = [];
  const tx = {
    department: {
      findUnique: async ({ where }: Prisma.DepartmentFindUniqueArgs) => populated ? { id: where.slug } : null,
      upsert: async ({ where, update }: Prisma.DepartmentUpsertArgs) => { assert.deepEqual(update, {}); return { id: where.slug }; },
    },
    course: {
      findFirst: async ({ where }: Prisma.CourseFindFirstArgs) => {
        const filters = where?.OR ?? [];
        return [...rows.values()].find((row) => filters.some((filter) => filter.id === row.id || (filter.departmentId === row.departmentId && filter.slug === row.slug))) ?? null;
      },
      upsert: async (args: Prisma.CourseUpsertArgs) => {
        writes.push(structuredClone(args));
        const existing = rows.get(args.where.id!);
        const data = existing ? args.update : args.create;
        if (existing) {
          for (const key of Object.keys(data)) assert.ok(['contentHtml', 'syllabus', 'faq', 'seoTitle', 'seoDescription'].includes(key), key);
        }
        const { faq, ...fields } = data;
        const row = { ...existing, ...fields } as Row;
        if (faq) row.faq = structuredClone(faq.create) as Row['faq'];
        row.department = existing?.department ?? { slug: row.departmentId };
        rows.set(row.id, row);
        return row;
      },
    },
    contentRevision: { upsert: async (args: Prisma.ContentRevisionUpsertArgs) => { revisions.push(args); return { version: revisions.length }; } },
    revalidationOutbox: { create: async ({ data }: Prisma.RevalidationOutboxCreateArgs) => { outbox.push(data as { version: number; paths: string[] }); return data; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, rows, writes, outbox, revisions };
}

test('isolated acting completion fills empty fields and revalidates the actual edited path', async () => {
  const f = fixture();
  const acting = f.rows.get('acting')!;
  Object.assign(acting, { slug: 'acting-edited', departmentId: 'custom', department: { slug: 'custom' }, contentHtml: '  \n', syllabus: [], faq: [], seoTitle: null, seoDescription: null, status: 'ARCHIVED', deletedAt: new Date('2026-01-01') });
  const before = structuredClone(acting);
  await seedContent(f.tx, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0]!.where.id, 'acting');
  const saved = f.rows.get('acting')!;
  assert.equal(saved.contentHtml, cleanHtml(content.acting.contentHtml));
  assert.deepEqual(saved.syllabus, content.acting.syllabus);
  assert.deepEqual(saved.faq, content.acting.faq.map((faq, position) => ({ ...faq, position })));
  assert.equal(saved.seoTitle, content.acting.seoTitle);
  assert.equal(saved.seoDescription, content.acting.seoDescription);
  for (const key of ['slug', 'departmentId', 'department', 'status', 'instructors', 'title', 'deletedAt'] as const) assert.deepEqual(saved[key], before[key], key);
  assert.deepEqual(f.outbox, [{ version: 1, paths: ['/', '/courses', '/courses/custom', '/courses/custom/acting-edited'] }]);
  assert.deepEqual(f.revisions[0], { where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
  await seedContent(f.tx, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.outbox.length, 1);
});

test('completion is opt-in and preserves every existing value when disabled', async () => {
  const f = fixture();
  Object.assign(f.rows.get('acting')!, { contentHtml: '', syllabus: [], faq: [], seoTitle: null, seoDescription: null });
  const before = structuredClone(f.rows);
  await seedContent(f.tx);
  assert.deepEqual(f.rows, before);
  assert.equal(f.writes.length, 0);
  assert.equal(f.revisions.length, 0);
  assert.equal(f.outbox.length, 0);
});

test('opt-in preserves nonempty editor fields and only fills null SEO independently', async () => {
  const f = fixture();
  Object.assign(f.rows.get('acting')!, { seoTitle: '', seoDescription: null });
  const before = structuredClone(f.rows.get('acting')!);
  await seedContent(f.tx, true);
  assert.deepEqual(f.writes[0]!.update, { seoDescription: content.acting.seoDescription });
  assert.deepEqual(f.rows.get('acting'), { ...before, seoDescription: content.acting.seoDescription });
  assert.equal(f.writes.length, 1);
  assert.equal(f.revisions.length, 1);
});

test('existing complete courses cause no writes, revisions or outbox events', async () => {
  const f = fixture();
  const before = structuredClone(f.rows);
  await seedContent(f.tx, true);
  assert.deepEqual(f.rows, before);
  assert.equal(f.writes.length, 0);
  assert.equal(f.revisions.length, 0);
  assert.equal(f.outbox.length, 0);
});

test('slug-matched records keep database IDs and receive missing content only', async () => {
  const f = fixture();
  const acting = f.rows.get('acting')!;
  f.rows.delete('acting');
  Object.assign(acting, { id: 'custom-acting-id', contentHtml: '' });
  f.rows.set(acting.id, acting);
  await seedContent(f.tx, true);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0]!.where, { id: 'custom-acting-id' });
  assert.deepEqual(f.writes[0]!.update, { contentHtml: content.acting.contentHtml });
  assert.equal(f.rows.has('acting'), false);
});

test('new records receive complete sanitized content and ordered FAQs without opt-in', async () => {
  const f = fixture(false);
  await seedContent(f.tx);
  assert.equal(f.writes.length, 12);
  for (const [id, expected] of Object.entries(content)) {
    const saved = f.rows.get(id)!;
    assert.equal(saved.contentHtml, cleanHtml(expected.contentHtml));
    assert.deepEqual(saved.syllabus, expected.syllabus);
    assert.deepEqual(saved.faq, expected.faq.map((faq, position) => ({ ...faq, position })));
    assert.equal(saved.seoTitle, expected.seoTitle);
    assert.equal(saved.seoDescription, expected.seoDescription);
    assert.equal(saved.status, 'PUBLISHED');
    assert.equal(saved.slug, id);
    assert.ok(f.outbox[0]!.paths.includes(`/courses/${saved.department.slug}/${id}`));
  }
  assert.equal(f.revisions.length, 1);
  assert.equal(f.outbox.length, 1);
  assert.equal(f.outbox[0]!.paths.length, 16);
  assert.ok(f.outbox[0]!.paths.every(validRevalidationPath));
  assert.equal(new Set(f.outbox[0]!.paths).size, 16);
});

test('development guard rejects unsafe environments before creating a database client', async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, SEED_DEVELOPMENT: process.env.SEED_DEVELOPMENT, SEED_COMPLETE_CONTENT: process.env.SEED_COMPLETE_CONTENT };
  try {
    process.env.SEED_COMPLETE_CONTENT = 'true';
    for (const [nodeEnv, enabled] of [['production', 'true'], ['test', 'true'], ['development', 'false'], ['development', 'TRUE']]) {
      process.env.NODE_ENV = nodeEnv;
      process.env.SEED_DEVELOPMENT = enabled;
      await assert.rejects(main(), /Development seed is disabled/);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
