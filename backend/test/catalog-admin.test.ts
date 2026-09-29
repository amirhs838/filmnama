import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ContentStatus, Course, Department, Prisma } from '@prisma/client';
import request from 'supertest';
import { AdminCatalogModule, AdminCatalogRepository, AdminCatalogService, AdminCoursesController, AdminDepartmentsController } from '../src/catalog/admin.module';
import { CatalogRepository } from '../src/catalog/catalog.module';
import { AuthModule } from '../src/auth/auth.module';
import { AccessGuard, AuthRequest } from '../src/auth/guards';
import { courseSchema, DepartmentInput, departmentSchema } from '../src/common/validation';
import { Database } from '../src/infrastructure/infrastructure.module';

const now = new Date('2026-01-01T00:00:00Z');
const seo = { title: null, description: null, canonicalUrl: null, noindex: false };
const departmentInput: DepartmentInput = { slug: 'film', label: 'Film', latin: 'Film', description: '', status: 'DRAFT' };
const courseInput = courseSchema.parse({ slug: 'acting', departmentId: 'seed-film', title: 'Acting', latin: 'Acting', description: '', level: 'Beginner', duration: '10h', iconKey: 'Drama', contentHtml: '<p>Acting</p>', syllabus: ['Basics'], faq: [{ question: 'When?', answer: 'Now' }], instructorIds: ['seed-teacher'], seo, status: 'DRAFT' });
function department(id = 'seed-film', slug = 'film'): Department {
  return { id, slug, label: 'Film', latin: 'Film', description: '', locale: 'fa', status: 'DRAFT', seoTitle: null, seoDescription: null, canonicalUrl: null, noindex: false, publishedAt: null, deletedAt: null, createdAt: now, updatedAt: now };
}
function course(id = 'seed-acting', slug = 'acting'): Course {
  return { id, slug, departmentId: 'seed-film', title: 'Acting', latin: 'Acting', description: '', level: 'Beginner', duration: '10h', iconKey: 'Drama', contentHtml: '', syllabus: [], locale: 'fa', status: 'DRAFT', seoTitle: null, seoDescription: null, canonicalUrl: null, noindex: false, publishedAt: null, deletedAt: null, createdAt: now, updatedAt: now, coverMediaId: null, customPath: null };
}
type Faq = { courseId: string; question: string; answer: string; position: number };
type InstructorLink = { courseId: string; instructorId: string; position: number };
type State = {
  departments: Department[]; courses: Course[]; faq: Faq[]; links: InstructorLink[];
  instructors: { id: string; status: ContentStatus; deletedAt: Date | null }[];
  redirects: { source: string; destination: string | null }[];
  audits: Prisma.AuditLogUncheckedCreateInput[]; version: number;
  outbox: { version: number; paths: string[] }[];
};
type Where = { id?: string; slug?: string; departmentId?: string; deletedAt?: null; status?: ContentStatus; publishedAt?: { lte: Date }; department?: Where };
type CourseData = Partial<Course> & {
  department?: { connect: { id: string } };
  faq?: { create: Omit<Faq, 'courseId'>[] };
  instructors?: { create: { instructor: { connect: { id: string } }; position: number }[] };
};
function fixture() {
  let state: State = { departments: [department(), department('seed-art', 'art')], courses: [course()], faq: [{ courseId: 'seed-acting', question: 'Old?', answer: 'Old', position: 0 }], links: [{ courseId: 'seed-acting', instructorId: 'seed-teacher', position: 0 }], instructors: [{ id: 'seed-teacher', status: 'DRAFT', deletedAt: null }], redirects: [], audits: [], version: 0, outbox: [] };
  let serialCalls = 0;
  let active = false;
  let failOutbox = false;
  const instructorFilters: unknown[] = [];
  const mutation = () => assert.equal(active, true, 'all writes must use Database.serial transaction');
  const matches = (row: Department | Course, where: Where = {}): boolean => {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.slug !== undefined && row.slug !== where.slug) return false;
    if (where.departmentId !== undefined && (!('departmentId' in row) || row.departmentId !== where.departmentId)) return false;
    if (where.deletedAt === null && row.deletedAt !== null) return false;
    if (where.status && row.status !== where.status) return false;
    if (where.publishedAt && (!row.publishedAt || row.publishedAt > where.publishedAt.lte)) return false;
    if (where.department && (!('departmentId' in row) || !state.departments.some((d) => d.id === row.departmentId && matches(d, where.department)))) return false;
    return true;
  };
  const projectCourse = (row: Course, select?: Prisma.CourseSelect) => {
    const args = select?.instructors as Prisma.Course$instructorsArgs | undefined;
    const filter = args?.where?.instructor as Prisma.InstructorWhereInput | undefined;
    return { ...row, department: state.departments.find((d) => d.id === row.departmentId)!, faq: state.faq.filter((f) => f.courseId === row.id).sort((a, b) => a.position - b.position), instructors: state.links.filter((link) => link.courseId === row.id).filter((link) => state.instructors.some((i) => i.id === link.instructorId && (!filter || (i.deletedAt === null && (!filter.status || i.status === filter.status))))).sort((a, b) => a.position - b.position).map((link) => ({ ...link, instructor: state.instructors.find((i) => i.id === link.instructorId) })) };
  };
  const unique = () => { throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '6.19.0' }); };
  const saveDepartment = (data: Partial<Department>, id?: string) => {
    mutation();
    const previous = id ? state.departments.find((d) => d.id === id)! : department(`department-${state.departments.length}`);
    const row = { ...previous, ...data, updatedAt: new Date() };
    if (state.departments.some((d) => d.id !== row.id && d.slug === row.slug)) unique();
    if (id) state.departments = state.departments.filter((d) => d.id !== id);
    state.departments.push(row);
    return row;
  };
  const saveCourse = (data: CourseData, id?: string, select?: Prisma.CourseSelect) => {
    mutation();
    const { department: relation, faq, instructors, ...scalars } = data;
    const previous = id ? state.courses.find((c) => c.id === id)! : course(`course-${state.courses.length}`);
    const row = { ...previous, ...scalars, departmentId: relation?.connect.id ?? previous.departmentId, updatedAt: new Date() };
    if (state.courses.some((c) => c.id !== row.id && c.departmentId === row.departmentId && c.slug === row.slug)) unique();
    if (id) state.courses = state.courses.filter((c) => c.id !== id);
    state.courses.push(row);
    for (const item of faq?.create ?? []) state.faq.push({ ...item, courseId: row.id });
    for (const item of instructors?.create ?? []) state.links.push({ courseId: row.id, instructorId: item.instructor.connect.id, position: item.position });
    return projectCourse(row, select);
  };
  const tx = {
    department: {
      findFirst: async ({ where }: { where: Where }) => state.departments.find((d) => matches(d, where)) ?? null,
      findMany: async ({ where }: { where: Where }) => state.departments.filter((d) => matches(d, where)),
      create: async ({ data }: { data: Partial<Department> }) => saveDepartment(data),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Department> }) => saveDepartment(data, where.id),
    },
    course: {
      findFirst: async ({ where, select }: { where: Where; select?: Prisma.CourseSelect }) => { const row = state.courses.find((c) => matches(c, where)); return row ? projectCourse(row, select) : null; },
      findMany: async ({ where, select }: { where: Where; select?: Prisma.CourseSelect }) => state.courses.filter((c) => matches(c, where)).map((c) => projectCourse(c, select)),
      count: async ({ where }: { where: Where }) => state.courses.filter((c) => matches(c, where)).length,
      create: async ({ data, select }: { data: CourseData; select?: Prisma.CourseSelect }) => saveCourse(data, undefined, select),
      update: async ({ where, data, select }: { where: { id: string }; data: CourseData; select?: Prisma.CourseSelect }) => saveCourse(data, where.id, select),
    },
    instructor: { findMany: async ({ where }: { where: { id: { in: string[] }; deletedAt: null } }) => { instructorFilters.push(where); return state.instructors.filter((i) => where.id.in.includes(i.id) && i.deletedAt === where.deletedAt); } },
    courseFaq: { deleteMany: async ({ where }: { where: { courseId: string } }) => { mutation(); state.faq = state.faq.filter((f) => f.courseId !== where.courseId); } },
    courseInstructor: { deleteMany: async ({ where }: { where: { courseId: string } }) => { mutation(); state.links = state.links.filter((i) => i.courseId !== where.courseId); } },
    redirect: {
      findUnique: async ({ where }: { where: { source: string } }) => state.redirects.find((r) => r.source === where.source) ?? null,
      findMany: async ({ where }: { where: { destination: string } }) => state.redirects.filter((r) => r.destination === where.destination),
      updateMany: async ({ where, data }: { where: { destination: string }; data: { destination: string | null } }) => { mutation(); for (const r of state.redirects) if (r.destination === where.destination) r.destination = data.destination; },
      upsert: async ({ where, create, update }: { where: { source: string }; create: { source: string; destination: string | null }; update: { destination: string | null } }) => { mutation(); const row = state.redirects.find((r) => r.source === where.source); if (row) row.destination = update.destination; else state.redirects.push(create); },
    },
    auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => { mutation(); state.audits.push(data); } },
    contentRevision: { upsert: async (args: Prisma.ContentRevisionUpsertArgs) => { mutation(); assert.deepEqual(args.where, { id: 1 }); assert.deepEqual(args.create, { id: 1, version: 1 }); assert.deepEqual(args.update, { version: { increment: 1 } }); return { version: ++state.version }; } },
    revalidationOutbox: { create: async ({ data }: { data: { version: number; paths: string[] } }) => { mutation(); if (failOutbox) throw new Error('outbox unavailable'); state.outbox.push(data); } },
  };
  const db = { ...tx, serial: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
    serialCalls++;
    const before = structuredClone(state);
    active = true;
    try { return await operation(tx as unknown as Prisma.TransactionClient); }
    catch (error) { state = before; throw error; }
    finally { active = false; }
  } } as unknown as Database;
  const repo = new AdminCatalogRepository(db);
  return { db, repo, service: new AdminCatalogService(repo), publicRepo: new CatalogRepository(db), get state() { return state; }, get serialCalls() { return serialCalls; }, instructorFilters, failOutbox: () => { failOutbox = true; } };
}

function assertMutation(f: ReturnType<typeof fixture>, action: string, entityType: string, entityId: string) {
  assert.deepEqual(f.state.audits.at(-1), { actorId: 'actor', action, entityType, entityId, metadata: entityType === 'Course' ? { slug: f.state.courses.find((c) => c.id === entityId)!.slug, status: f.state.courses.find((c) => c.id === entityId)!.status, departmentId: f.state.courses.find((c) => c.id === entityId)!.departmentId } : { slug: f.state.departments.find((d) => d.id === entityId)!.slug, status: f.state.departments.find((d) => d.id === entityId)!.status } });
  assert.equal(f.state.version, f.state.audits.length);
  const batches = f.state.outbox.filter((o) => o.version === f.state.version);
  assert.ok(batches.length);
  assert.ok(batches.every((o) => o.paths.length > 0 && o.paths.length <= 100));
  const paths = batches.flatMap((o) => o.paths);
  assert.equal(paths.length, new Set(paths).size);
  assert.ok(paths.includes('/') && paths.includes('/courses'));
  return paths;
}

test('department rename redirects every child including deleted records, collapses aliases and batches invalidation', async () => {
  const f = fixture();
  for (let i = 0; i < 105; i++) f.state.courses.push({ ...course(`child-${i}`, `child-${i}`), deletedAt: i === 0 ? now : null });
  f.state.redirects.push({ source: '/courses/old-film', destination: '/courses/film' }, { source: '/courses/old-film/old-acting', destination: '/courses/film/acting' });
  await f.repo.updateDepartment('actor', 'seed-film', { ...departmentInput, slug: 'cinema' });
  assert.equal(f.serialCalls, 1);
  assert.equal(f.state.departments.find((d) => d.id === 'seed-film')!.slug, 'cinema');
  assert.equal(f.state.redirects.find((r) => r.source === '/courses/old-film')!.destination, '/courses/cinema');
  assert.equal(f.state.redirects.find((r) => r.source === '/courses/old-film/old-acting')!.destination, '/courses/cinema/acting');
  for (const c of f.state.courses) assert.equal(f.state.redirects.find((r) => r.source === `/courses/film/${c.slug}`)!.destination, `/courses/cinema/${c.slug}`);
  const paths = assertMutation(f, 'UPDATE', 'Department', 'seed-film');
  assert.ok(paths.includes('/courses/old-film/old-acting') && paths.includes('/courses/cinema/child-104'));
  assert.equal(f.state.outbox.length, 3);
});

test('history reservations reject creates and renames including a child destination, with no partial mutations', async () => {
  const cases = [
    { source: '/courses/cinema', run: (f: ReturnType<typeof fixture>) => f.repo.createDepartment('actor', { ...departmentInput, slug: 'cinema' }) },
    { source: '/courses/cinema', run: (f: ReturnType<typeof fixture>) => f.repo.updateDepartment('actor', 'seed-film', { ...departmentInput, slug: 'cinema' }) },
    { source: '/courses/cinema/acting', run: (f: ReturnType<typeof fixture>) => f.repo.updateDepartment('actor', 'seed-film', { ...departmentInput, slug: 'cinema' }) },
    { source: '/courses/film/new', run: (f: ReturnType<typeof fixture>) => f.repo.createCourse('actor', { ...courseInput, slug: 'new' }) },
    { source: '/courses/art/acting', run: (f: ReturnType<typeof fixture>) => f.repo.updateCourse('actor', 'seed-acting', { ...courseInput, departmentId: 'seed-art' }) },
  ];
  for (const item of cases) {
    const f = fixture();
    f.state.redirects.push({ source: item.source, destination: null });
    const before = structuredClone(f.state);
    await assert.rejects(item.run(f), ConflictException);
    assert.deepEqual(f.state, before);
    assert.equal(f.serialCalls, 1);
  }
});

test('unique constraints still reserve deleted records and roll back redirects on conflicts', async () => {
  const f = fixture();
  f.state.departments.push({ ...department('deleted-dept', 'deleted'), deletedAt: now });
  f.state.courses.push({ ...course('deleted-course', 'taken'), deletedAt: now });
  const before = structuredClone(f.state);
  await assert.rejects(f.repo.createDepartment('actor', { ...departmentInput, slug: 'deleted' }), ConflictException);
  await assert.rejects(f.repo.createCourse('actor', { ...courseInput, slug: 'taken' }), ConflictException);
  await assert.rejects(f.repo.updateCourse('actor', 'seed-acting', { ...courseInput, slug: 'taken' }), ConflictException);
  await assert.rejects(f.repo.updateDepartment('actor', 'seed-film', { ...departmentInput, slug: 'art' }), ConflictException);
  assert.deepEqual(f.state, before);
});

test('course move and slug update replace relations, collapse aliases, and allow draft instructors', async () => {
  const f = fixture();
  f.state.redirects.push({ source: '/courses/ancient/acting', destination: '/courses/film/acting' });
  await f.repo.updateCourse('actor', 'seed-acting', { ...courseInput, departmentId: 'seed-art', slug: 'stage', faq: [{ question: 'New?', answer: 'Yes' }, { question: 'Next?', answer: 'Soon' }] });
  assert.deepEqual(f.state.faq, [{ courseId: 'seed-acting', question: 'New?', answer: 'Yes', position: 0 }, { courseId: 'seed-acting', question: 'Next?', answer: 'Soon', position: 1 }]);
  assert.deepEqual(f.state.links, [{ courseId: 'seed-acting', instructorId: 'seed-teacher', position: 0 }]);
  assert.deepEqual(f.instructorFilters, [{ id: { in: ['seed-teacher'] }, deletedAt: null }]);
  assert.equal(f.state.redirects.find((r) => r.source === '/courses/ancient/acting')!.destination, '/courses/art/stage');
  const paths = assertMutation(f, 'UPDATE', 'Course', 'seed-acting');
  for (const path of ['/courses/film', '/courses/art', '/courses/film/acting', '/courses/art/stage', '/courses/ancient/acting']) assert.ok(paths.includes(path));
  await f.repo.updateCourse('actor', 'seed-acting', { ...courseInput, departmentId: 'seed-art', slug: 'performance', faq: [], instructorIds: [] });
  assert.equal(f.state.redirects.find((r) => r.source === '/courses/film/acting')!.destination, '/courses/art/performance');
  assert.deepEqual(f.state.faq, []);
  assert.deepEqual(f.state.links, []);
  await assert.rejects(f.repo.updateCourse('actor', 'seed-acting', courseInput), ConflictException);
});

test('missing or deleted relations reject before writes; missing entities are not resurrected', async () => {
  for (const mode of ['missing-instructor', 'deleted-instructor', 'missing-department', 'deleted-department']) {
    const f = fixture();
    const input = { ...courseInput, slug: 'new' };
    if (mode === 'missing-instructor') input.instructorIds = ['seed-teacher', 'absent'];
    if (mode === 'deleted-instructor') f.state.instructors[0]!.deletedAt = now;
    if (mode === 'missing-department') input.departmentId = 'absent';
    if (mode === 'deleted-department') f.state.departments[0]!.deletedAt = now;
    const before = structuredClone(f.state);
    await assert.rejects(f.repo.createCourse('actor', input), mode.includes('instructor') ? BadRequestException : NotFoundException);
    await assert.rejects(f.repo.updateCourse('actor', 'seed-acting', input), mode.includes('instructor') ? BadRequestException : NotFoundException);
    assert.deepEqual(f.state, before);
  }
  const f = fixture();
  f.state.courses[0]!.deletedAt = now;
  await assert.rejects(f.repo.updateCourse('actor', 'seed-acting', courseInput), NotFoundException);
  await assert.rejects(f.repo.deleteCourse('actor', 'absent'), NotFoundException);
});

test('first publication timestamps persist across draft transitions and parent visibility invalidates child paths', async () => {
  const f = fixture();
  await f.repo.updateCourse('actor', 'seed-acting', { ...courseInput, status: 'PUBLISHED' });
  const first = f.state.courses[0]!.publishedAt;
  assert.ok(first instanceof Date);
  assert.equal(await f.publicRepo.course('film', 'acting', new Date()), null);
  const published = await f.repo.updateDepartment('actor', 'seed-film', { ...departmentInput, status: 'PUBLISHED' });
  const paths = assertMutation(f, 'UPDATE', 'Department', 'seed-film');
  assert.ok(paths.includes('/courses/film/acting'));
  const visible = await f.publicRepo.course('film', 'acting', new Date());
  assert.ok(visible);
  assert.deepEqual(visible.instructors, []);
  assert.deepEqual((await f.service.course('seed-acting')).instructorIds, ['seed-teacher']);
  await f.repo.updateDepartment('actor', 'seed-film', departmentInput);
  assert.ok(assertMutation(f, 'UPDATE', 'Department', 'seed-film').includes('/courses/film/acting'));
  assert.equal(await f.publicRepo.course('film', 'acting', new Date()), null);
  const republished = await f.repo.updateDepartment('actor', 'seed-film', { ...departmentInput, status: 'PUBLISHED' });
  assert.deepEqual(republished.publishedAt, published.publishedAt);
  await f.repo.updateCourse('actor', 'seed-acting', courseInput);
  assert.equal(await f.publicRepo.course('film', 'acting', new Date()), null);
  await f.repo.updateCourse('actor', 'seed-acting', { ...courseInput, status: 'PUBLISHED' });
  assert.deepEqual(f.state.courses[0]!.publishedAt, first);
});

test('create publication and every soft delete atomically audit, revise and enqueue without orphaning children', async () => {
  const f = fixture();
  const before = structuredClone(f.state);
  await assert.rejects(f.repo.deleteDepartment('actor', 'seed-film'), ConflictException);
  assert.deepEqual(f.state, before);
  const draft = await f.repo.createDepartment('actor', { ...departmentInput, slug: 'draft' });
  assert.equal(draft.publishedAt, null);
  assertMutation(f, 'CREATE', 'Department', draft.id);
  const published = await f.repo.createDepartment('actor', { ...departmentInput, slug: 'published', status: 'PUBLISHED' });
  assert.ok(published.publishedAt instanceof Date);
  assertMutation(f, 'CREATE', 'Department', published.id);
  const created = await f.repo.createCourse('actor', { ...courseInput, slug: 'new', status: 'PUBLISHED' });
  assert.ok(created.publishedAt instanceof Date);
  assertMutation(f, 'CREATE', 'Course', created.id);
  f.state.redirects.push({ source: '/courses/old/new', destination: '/courses/film/new' });
  const deleted = await f.repo.deleteCourse('actor', created.id);
  assert.ok(deleted.deletedAt instanceof Date);
  assert.equal(f.state.redirects.find((r) => r.source === '/courses/old/new')!.destination, null);
  assertMutation(f, 'DELETE', 'Course', created.id);
  await assert.rejects(f.service.course(created.id), NotFoundException);
  assert.ok(!(await f.service.courses()).items.some((c) => c.id === created.id));
  await f.repo.deleteCourse('actor', 'seed-acting');
  const deletedDepartment = await f.repo.deleteDepartment('actor', 'seed-film');
  assert.ok(deletedDepartment.deletedAt instanceof Date);
  assertMutation(f, 'DELETE', 'Department', 'seed-film');
  await assert.rejects(f.service.department('seed-film'), NotFoundException);
  assert.ok(!(await f.service.departments()).items.some((d) => d.id === 'seed-film'));
  await assert.rejects(f.repo.createDepartment('actor', departmentInput), ConflictException);
});

test('outbox failure rolls back content, relation replacements, redirects, audit and revision for all mutations', async () => {
  const operations = [
    (f: ReturnType<typeof fixture>) => f.repo.createDepartment('actor', { ...departmentInput, slug: 'new' }),
    (f: ReturnType<typeof fixture>) => f.repo.updateDepartment('actor', 'seed-film', { ...departmentInput, slug: 'new' }),
    (f: ReturnType<typeof fixture>) => f.repo.deleteDepartment('actor', 'seed-art'),
    (f: ReturnType<typeof fixture>) => f.repo.createCourse('actor', { ...courseInput, slug: 'new' }),
    (f: ReturnType<typeof fixture>) => f.repo.updateCourse('actor', 'seed-acting', { ...courseInput, slug: 'new', instructorIds: [], faq: [] }),
    (f: ReturnType<typeof fixture>) => f.repo.deleteCourse('actor', 'seed-acting'),
  ];
  for (const operation of operations) {
    const f = fixture();
    const before = structuredClone(f.state);
    f.failOutbox();
    await assert.rejects(operation(f), /outbox unavailable/);
    assert.deepEqual(f.state, before);
    assert.equal(f.serialCalls, 1);
  }
});

test('controllers accept seed IDs, strict full PUTs, sanitize HTML and expose only explicit editable DTOs', async () => {
  const f = fixture();
  for (const controller of [AdminDepartmentsController, AdminCoursesController]) {
    assert.deepEqual(Reflect.getMetadata('roles', controller), ['SUPER_ADMIN', 'CONTENT_MANAGER']);
    assert.deepEqual(Reflect.getMetadata('__guards__', controller), [AccessGuard]);
  }
  assert.deepEqual(Reflect.getMetadata('imports', AdminCatalogModule), [AuthModule]);
  const module = await Test.createTestingModule({ controllers: [AdminDepartmentsController, AdminCoursesController], providers: [{ provide: AdminCatalogService, useValue: f.service }] }).overrideGuard(AccessGuard).useValue({ canActivate(context: ExecutionContext) { context.switchToHttp().getRequest<AuthRequest>().user = { id: 'actor', role: 'CONTENT_MANAGER', sessionId: 'session', csrfHash: '' }; return true; } }).compile();
  const app = module.createNestApplication();
  await app.init();
  try {
    const http = request(app.getHttpServer());
    const detail = await http.get('/admin/courses/seed-acting').expect(200);
    assert.equal(detail.headers['cache-control'], 'no-store');
    assert.deepEqual(Object.keys(detail.body).sort(), ['id', 'slug', 'departmentId', 'title', 'latin', 'description', 'level', 'duration', 'iconKey', 'contentHtml', 'syllabus', 'status', 'coverMediaId', 'coverMedia', 'faq', 'instructorIds', 'seo', 'customPath', 'publishedAt', 'createdAt', 'updatedAt', 'deletedAt'].sort());
    assert.deepEqual(detail.body.faq, [{ question: 'Old?', answer: 'Old' }]);
    const dept = await http.get('/admin/departments/seed-film').expect(200);
    assert.deepEqual(Object.keys(dept.body).sort(), ['id', 'slug', 'label', 'latin', 'description', 'status', 'seo', 'publishedAt', 'createdAt', 'updatedAt', 'deletedAt'].sort());
    await http.put('/admin/courses/seed-acting').send({ title: 'Partial' }).expect(400);
    await http.put('/admin/departments/seed-film').send({ slug: 'partial' }).expect(400);
    for (const extra of [{ id: 'injected' }, { deletedAt: now }, { publishedAt: now }, { department: {} }, { seo: { ...seo, unknown: true } }]) await http.post('/admin/courses').send({ ...courseInput, ...extra }).expect(400);
    await http.post('/admin/departments').send({ ...departmentInput, unexpected: true }).expect(400);
    await http.post('/admin/courses').send({ ...courseInput, instructorIds: ['seed-teacher', 'seed-teacher'] }).expect(400);
    assert.equal(f.serialCalls, 0);
    const updated = await http.put('/admin/courses/seed-acting').send({ ...courseInput, contentHtml: '<p onclick="bad()">Safe</p><script>bad()</script>', faq: [], instructorIds: [] }).expect(200);
    assert.equal(updated.body.contentHtml, '<p>Safe</p>');
    assert.deepEqual(updated.body.faq, []);
    assert.deepEqual(updated.body.instructorIds, []);
    assert.deepEqual((await http.get('/admin/courses').expect(200)).body.items[0], updated.body);
    await http.put('/admin/departments/seed-film').send({ ...departmentInput, seo: { ...seo, title: 'Custom' } }).expect(200);
    const replaced = await http.put('/admin/departments/seed-film').send(departmentInput).expect(200);
    assert.deepEqual(replaced.body.seo, seo);
    await http.post('/admin/departments').send({ ...departmentInput, slug: 'new' }).expect(201);
    await http.post('/admin/courses').send({ ...courseInput, slug: 'new' }).expect(201);
    await http.delete('/admin/departments/seed-film').expect(409);
    await http.delete('/admin/courses/seed-acting').expect(200);
    await http.get('/admin/courses/seed-acting').expect(404);
    await http.delete('/admin/departments/seed-art').expect(200);
    await http.get('/admin/departments').expect(200);
    assert.equal(departmentSchema.safeParse({ ...departmentInput, locale: 'en' }).success, false);
  } finally { await app.close(); }
});
