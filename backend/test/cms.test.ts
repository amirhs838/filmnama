import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { AccessGuard } from '../src/auth/guards';
import { categorySchema, instructorSchema, postSchema, tagSchema, validRevalidationPath } from '../src/common/validation';
import { Config } from '../src/infrastructure/config';
import { Database } from '../src/infrastructure/infrastructure.module';
import { testConfig } from './auth.fixture';
import { AdminInstructorsController, InstructorsModule, InstructorsRepository, InstructorsService, PublicInstructorsController } from '../src/instructors/instructors.module';
import { AdminCategoriesController, AdminPostsController, AdminTagsController, BlogModule, BlogRepository, BlogService, PublicBlogController } from '../src/blog/blog.module';

const past = new Date('2025-12-01T00:00:00Z');
const future = new Date('2027-01-01T00:00:00Z');
type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Instructor = { id: string; slug: string; name: string; bio: string; image: string | null; status: Status; customPath: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type Category = { id: string; slug: string; title: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type Tag = { id: string; slug: string; title: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type Post = {
  id: string; slug: string; title: string; excerpt: string; contentHtml: string; authorId: string; categoryId: string | null;
  status: Status; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; noindex: boolean;
  customPath: string | null;
  publishedAt: Date | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null;
};
type State = {
  instructors: Instructor[]; categories: Category[]; tags: Tag[]; posts: Post[]; postTags: { postId: string; tagId: string }[];
  audits: Prisma.AuditLogUncheckedCreateInput[]; version: number; outbox: { version: number; paths: string[] }[];
};
const instructor = (patch: Partial<Instructor> = {}): Instructor => ({ id: 'ins-pub', slug: 'sara', name: 'Sara Ahmadi', bio: 'Director', image: null, status: 'PUBLISHED', customPath: null, createdAt: past, updatedAt: past, deletedAt: null, ...patch });
const category = (patch: Partial<Category> = {}): Category => ({ id: 'cat-1', slug: 'news', title: 'News', createdAt: past, updatedAt: past, deletedAt: null, ...patch });
const tag = (patch: Partial<Tag> = {}): Tag => ({ id: 'tag-1', slug: 'cinema', title: 'Cinema', createdAt: past, updatedAt: past, deletedAt: null, ...patch });
const post = (patch: Partial<Post> = {}): Post => ({
  id: 'post-pub', slug: 'hello', title: 'Hello', excerpt: '', contentHtml: '<p>Hello</p>', authorId: 'editor-1',
  categoryId: 'cat-1', status: 'PUBLISHED', seoTitle: null, seoDescription: null, canonicalUrl: null, noindex: false,
  customPath: null,
  publishedAt: past, createdAt: past, updatedAt: past, deletedAt: null, ...patch,
});
const instructorInput = instructorSchema.parse({ slug: 'new-teacher', name: 'New Teacher', bio: 'Bio', status: 'DRAFT' });
const categoryInput = categorySchema.parse({ slug: 'events', title: 'Events' });
const tagInput = tagSchema.parse({ slug: 'montage', title: 'Montage' });
const postInput = postSchema.parse({ slug: 'new-post', title: 'New Post', excerpt: 'Excerpt', contentHtml: '<p>Body</p>', categoryId: 'cat-1', tagIds: ['tag-1'], status: 'DRAFT' });

function fixture() {
  const state: State = {
    instructors: [instructor(), instructor({ id: 'ins-draft', slug: 'draft-teacher', name: 'Draft Teacher', status: 'DRAFT' })],
    categories: [category()], tags: [tag(), tag({ id: 'tag-2', slug: 'acting', title: 'Acting' })],
    posts: [post(), post({ id: 'post-draft', slug: 'draft-post', status: 'PUBLISHED', publishedAt: null }), post({ id: 'post-arch', slug: 'old', status: 'ARCHIVED' }), post({ id: 'post-future', slug: 'future', publishedAt: future })],
    postTags: [{ postId: 'post-pub', tagId: 'tag-1' }],
    audits: [], version: 0, outbox: [],
  };
  // Draft/future/archived fixtures must not be publicly visible: only post-pub qualifies.
  state.posts.find((p) => p.id === 'post-draft')!.status = 'DRAFT';
  let serialCalls = 0;
  let active = false;
  let failOutbox = false;
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-new-${++seq}`;
  const mutation = () => assert.equal(active, true, 'all writes must use Database.serial transaction');
  const unique = (): never => { throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '6.19.0' }); };
  const projectPost = (row: Post) => ({
    ...row,
    category: row.categoryId ? { slug: state.categories.find((c) => c.id === row.categoryId)?.slug ?? 'missing' } : null,
    tags: state.postTags.filter((t) => t.postId === row.id).sort((a, b) => (a.tagId < b.tagId ? -1 : 1)).map((t) => ({ tagId: t.tagId })),
  });
  const matchPost = (row: Post, where: Record<string, unknown>): boolean => {
    const w = where as { id?: string | { gt: string }; slug?: string; status?: Status; deletedAt?: null; publishedAt?: { lte: Date }; categoryId?: string; category?: { slug: string; deletedAt: null }; tags?: { some: { tag: { slug: string; deletedAt: null } } } };
    if (typeof w.id === 'string' ? row.id !== w.id : w.id && !(row.id > w.id.gt)) return false;
    if (w.slug !== undefined && row.slug !== w.slug) return false;
    if (w.status !== undefined && row.status !== w.status) return false;
    if (w.deletedAt === null && row.deletedAt !== null) return false;
    if (w.publishedAt && (!row.publishedAt || row.publishedAt > w.publishedAt.lte)) return false;
    if (w.categoryId !== undefined && row.categoryId !== w.categoryId) return false;
    if (w.category && state.categories.find((c) => c.id === row.categoryId)?.slug !== w.category.slug) return false;
    if (w.tags) {
      const slugValue = w.tags.some.tag.slug;
      if (!state.postTags.some((t) => t.postId === row.id && state.tags.find((tagRow) => tagRow.id === t.tagId)?.slug === slugValue)) return false;
    }
    return true;
  };
  const saveInstructor = (data: Partial<Instructor>, id?: string) => {
    mutation();
    const previous = id ? state.instructors.find((r) => r.id === id)! : instructor({ id: nextId('ins'), slug: '', createdAt: new Date(), updatedAt: new Date() });
    const row = { ...previous, ...data, updatedAt: new Date() };
    if (state.instructors.some((r) => r.id !== row.id && r.slug === row.slug)) unique();
    if (id) state.instructors = state.instructors.filter((r) => r.id !== id);
    state.instructors.push(row);
    return row;
  };
  const saveCategory = (data: Partial<Category>, id?: string) => {
    mutation();
    const previous = id ? state.categories.find((r) => r.id === id)! : category({ id: nextId('cat'), slug: '', title: '', createdAt: new Date(), updatedAt: new Date() });
    const row = { ...previous, ...data, updatedAt: new Date() };
    if (state.categories.some((r) => r.id !== row.id && r.slug === row.slug)) unique();
    if (id) state.categories = state.categories.filter((r) => r.id !== id);
    state.categories.push(row);
    return row;
  };
  const saveTag = (data: Partial<Tag>, id?: string) => {
    mutation();
    const previous = id ? state.tags.find((r) => r.id === id)! : tag({ id: nextId('tag'), slug: '', title: '', createdAt: new Date(), updatedAt: new Date() });
    const row = { ...previous, ...data, updatedAt: new Date() };
    if (state.tags.some((r) => r.id !== row.id && r.slug === row.slug)) unique();
    if (id) state.tags = state.tags.filter((r) => r.id !== id);
    state.tags.push(row);
    return row;
  };
  type PostData = Partial<Post> & { author?: { connect: { id: string } }; category?: { connect: { id: string } }; tags?: { create: { tag: { connect: { id: string } } }[] } };
  const savePost = (data: PostData, id?: string) => {
    mutation();
    const { author, category: relation, tags: links, ...scalars } = data;
    const previous = id ? state.posts.find((r) => r.id === id)! : post({ id: nextId('post'), slug: '', authorId: '', publishedAt: null, createdAt: new Date(), updatedAt: new Date() });
    const row: Post = { ...previous, ...scalars, authorId: author?.connect.id ?? previous.authorId, categoryId: relation?.connect.id ?? previous.categoryId, updatedAt: new Date() };
    if (state.posts.some((r) => r.id !== row.id && r.slug === row.slug)) unique();
    if (id) state.posts = state.posts.filter((r) => r.id !== id);
    state.posts.push(row);
    for (const item of links?.create ?? []) state.postTags.push({ postId: row.id, tagId: item.tag.connect.id });
    return projectPost(row);
  };
  const tx = {
    instructor: {
      findFirst: async ({ where }: { where: { id?: string; slug?: string; status?: Status; deletedAt: null } }) => state.instructors.find((r) => (where.id === undefined || r.id === where.id) && (where.slug === undefined || r.slug === where.slug) && (where.status === undefined || r.status === where.status) && r.deletedAt === null) ?? null,
      findMany: async ({ where }: { where: { status?: Status; deletedAt: null } }) => state.instructors.filter((r) => (where.status === undefined || r.status === where.status) && r.deletedAt === null),
      create: async ({ data }: { data: Partial<Instructor> }) => saveInstructor(data),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Instructor> }) => saveInstructor(data, where.id),
    },
    category: {
      findFirst: async ({ where }: { where: { id: string; deletedAt?: null } }) => state.categories.find((r) => r.id === where.id && (where.deletedAt !== null || r.deletedAt === null)) ?? null,
      findMany: async ({ where }: { where: { deletedAt: null } }) => state.categories.filter((r) => r.deletedAt === (where.deletedAt ?? null ? undefined : null) || r.deletedAt === null),
      create: async ({ data }: { data: Partial<Category> }) => saveCategory(data),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Category> }) => saveCategory(data, where.id),
    },
    tag: {
      findFirst: async ({ where }: { where: { id: string; deletedAt?: null } }) => state.tags.find((r) => r.id === where.id && (where.deletedAt !== null || r.deletedAt === null)) ?? null,
      findMany: async ({ where }: { where?: { id?: { in: string[] }; deletedAt?: null } }) => state.tags.filter((r) => (!where?.id || where.id.in.includes(r.id)) && (where?.deletedAt !== null || r.deletedAt === null)),
      create: async ({ data }: { data: Partial<Tag> }) => saveTag(data),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Tag> }) => saveTag(data, where.id),
    },
    post: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => { const row = state.posts.find((r) => matchPost(r, where)); return row ? projectPost(row) : null; },
      findMany: async ({ where, take }: { where: Record<string, unknown>; take?: number }) => state.posts.filter((r) => matchPost(r, where)).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, take).map(projectPost),
      count: async ({ where }: { where: { categoryId: string; deletedAt: null } }) => state.posts.filter((r) => r.categoryId === where.categoryId && r.deletedAt === null).length,
      create: async ({ data }: { data: PostData }) => savePost(data),
      update: async ({ where, data }: { where: { id: string }; data: PostData }) => {
        const row = data.category === undefined ? data : 'disconnect' in (data.category as object) ? { ...data, categoryId: null, category: undefined } : data;
        return savePost(row, where.id);
      },
    },
    postTag: {
      count: async ({ where }: { where: { tagId: string } }) => state.postTags.filter((t) => t.tagId === where.tagId).length,
      deleteMany: async ({ where }: { where: { postId: string } }) => { mutation(); state.postTags = state.postTags.filter((t) => t.postId !== where.postId); },
    },
    auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => { mutation(); state.audits.push(data); } },
    contentRevision: { upsert: async () => { mutation(); return { version: ++state.version }; } },
    revalidationOutbox: { create: async ({ data }: { data: { version: number; paths: string[] } }) => { mutation(); if (failOutbox) throw new Error('outbox unavailable'); state.outbox.push(data); } },
  };
  const db = { ...tx, serial: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
    serialCalls++;
    const before = structuredClone(state);
    active = true;
    try { return await operation(tx as unknown as Prisma.TransactionClient); }
    catch (error) { Object.assign(state, before); throw error; }
    finally { active = false; }
  } } as unknown as Database;
  const instructors = new InstructorsRepository(db);
  const instructorService = new InstructorsService(instructors);
  const blog = new BlogRepository(db);
  const blogService = new BlogService(blog);
  return { db, instructors, instructorService, blog, blogService, get state() { return state; }, get serialCalls() { return serialCalls; }, failOutbox() { failOutbox = true; } };
}

function assertOutbox(f: ReturnType<typeof fixture>, roots: string[], slugs: string[]) {
  const batches = f.state.outbox.filter((o) => o.version === f.state.version);
  assert.ok(batches.length);
  assert.ok(batches.every((o) => o.paths.length > 0 && o.paths.length <= 100));
  const paths = batches.flatMap((o) => o.paths);
  assert.equal(paths.length, new Set(paths).size);
  for (const root of roots) assert.ok(paths.includes(root), `missing ${root}`);
  for (const slugValue of slugs) assert.ok(paths.includes(slugValue), `missing ${slugValue}`);
  return paths;
}

test('cms schemas are strict, bounded and sanitize HTML', () => {
  assert.equal(instructorSchema.safeParse({ ...instructorInput, locale: 'en' }).success, false);
  assert.equal(categorySchema.safeParse({ ...categoryInput, status: 'PUBLISHED' }).success, false);
  assert.equal(tagSchema.safeParse({ ...tagInput, extra: 1 }).success, false);
  assert.equal(postSchema.safeParse({ ...postInput, authorId: 'x' }).success, false);
  for (const patch of [{ slug: 'Bad' }, { slug: 'a'.repeat(81) }, { name: 'A' }, { name: 'a'.repeat(201) }, { bio: 'a'.repeat(5001) }, { image: 'a'.repeat(501) }, { status: 'bad' }]) {
    assert.equal(instructorSchema.safeParse({ ...instructorInput, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.ok(instructorSchema.safeParse({ ...instructorInput, image: null }).success);
  assert.ok(instructorSchema.safeParse({ ...instructorInput, image: 'https://cdn.example.test/x.jpg' }).success);
  for (const patch of [{ title: '' }, { title: 'a'.repeat(201) }, { excerpt: 'a'.repeat(2001) }, { contentHtml: 'a'.repeat(100001) }, { tagIds: ['tag-1', 'tag-1'] }, { tagIds: Array(31).fill('tag-1') }, { status: 'NEW' }]) {
    assert.equal(postSchema.safeParse({ ...postInput, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.equal(postSchema.parse({ ...postInput, contentHtml: '<p onclick="bad()">Safe</p><script>bad()</script>' }).contentHtml, '<p>Safe</p>');
  assert.equal(postSchema.parse({ ...postInput, categoryId: undefined }).categoryId, null);
  assert.ok(categorySchema.safeParse({ slug: 'x', title: 'T' }).success);
  assert.ok(tagSchema.safeParse({ slug: 'x', title: 'T' }).success);
});

test('validRevalidationPath covers blog and instructors while keeping admin closed', () => {
  for (const path of ['/', '/courses', '/courses/film', '/courses/film/acting', '/blog', '/blog/hello', '/instructors', '/instructors/sara']) assert.equal(validRevalidationPath(path), true, path);
  for (const path of ['/admin', '/blog/../admin', '/blog?x=1', '/instructors/', '/Blog/hello', '/blog//x', '']) assert.equal(validRevalidationPath(path), false, path);
});

test('instructor mutations audit without PII, revise and enqueue slug paths', async () => {
  const f = fixture();
  const created = await f.instructors.create('actor', instructorInput);
  assert.equal(f.serialCalls, 1);
  assert.deepEqual(f.state.audits.at(-1), { actorId: 'actor', action: 'CREATE', entityType: 'Instructor', entityId: created.id, metadata: { slug: 'new-teacher', status: 'DRAFT' } });
  assert.ok(!JSON.stringify(f.state.audits.at(-1)).includes('Bio'));
  assertOutbox(f, ['/', '/instructors'], ['/instructors/new-teacher']);
  const updated = await f.instructors.update('actor', created.id, { ...instructorInput, slug: 'renamed', status: 'PUBLISHED' });
  assert.deepEqual(updated.slug, 'renamed');
  assertOutbox(f, ['/', '/instructors'], ['/instructors/new-teacher', '/instructors/renamed']);
  await assert.rejects(f.instructors.create('actor', { ...instructorInput, slug: 'renamed' }), ConflictException);
  await assert.rejects(f.instructors.create('actor', { ...instructorInput, slug: 'sara' }), ConflictException);
});

test('instructor soft delete is invisible to admin detail and public reads', async () => {
  const f = fixture();
  await f.instructorService.remove('actor', 'ins-pub');
  await assert.rejects(f.instructorService.admin('ins-pub'), NotFoundException);
  assert.ok(!(await f.instructorService.admins()).items.some((r) => r.id === 'ins-pub'));
  assert.ok(!(await f.instructorService.publics()).items.some((r) => r.id === 'ins-pub'));
  await assert.rejects(f.instructorService.public('sara'), NotFoundException);
  await assert.rejects(f.instructorService.public('draft-teacher'), NotFoundException);
  assert.equal((await f.instructorService.publics()).items[0], undefined);
  assertOutbox(f, ['/', '/instructors'], ['/instructors/sara']);
});

test('post create stamps live author and first publish; tags replace transactionally', async () => {
  const f = fixture();
  const created = await f.blogService.createPost('editor-2', postInput);
  assert.equal(created.authorId, 'editor-2');
  assert.equal(created.publishedAt, null);
  assert.deepEqual(created.tagIds, ['tag-1']);
  const published = await f.blogService.updatePost('editor-3', created.id, { ...postInput, status: 'PUBLISHED', tagIds: ['tag-2', 'tag-1'] });
  assert.ok(published.publishedAt);
  assert.deepEqual(published.tagIds, ['tag-1', 'tag-2']);
  assert.deepEqual(f.state.postTags.filter((t) => t.postId === created.id).map((t) => t.tagId).sort(), ['tag-1', 'tag-2']);
  const first = published.publishedAt;
  const republished = await f.blogService.updatePost('editor-3', created.id, { ...postInput, status: 'DRAFT', tagIds: [] });
  assert.equal(republished.publishedAt, first);
  assert.deepEqual(republished.tagIds, []);
  assertOutbox(f, ['/', '/blog'], ['/blog/new-post']);
  await assert.rejects(f.blogService.createPost('editor-2', { ...postInput, slug: 'other', categoryId: 'missing' }), BadRequestException);
  await assert.rejects(f.blogService.createPost('editor-2', { ...postInput, slug: 'other', tagIds: ['missing'] }), BadRequestException);
});

test('public visibility hides drafts, archived, deleted and future posts', async () => {
  const f = fixture();
  assert.equal((await f.blogService.publicPosts({ limit: 20 })).items.length, 1);
  assert.equal((await f.blogService.publicPost('hello')).slug, 'hello');
  for (const slugValue of ['draft-post', 'old', 'future']) await assert.rejects(f.blogService.publicPost(slugValue), NotFoundException);
  await f.blog.deletePost('actor', 'post-pub');
  assert.deepEqual((await f.blogService.publicPosts({ limit: 20 })).items, []);
  await assert.rejects(f.blogService.publicPost('hello'), NotFoundException);
});

test('public post list filters by category and tag with bound cursors', async () => {
  const f = fixture();
  await f.blog.createCategory('actor', categorySchema.parse({ slug: 'events', title: 'Events' }));
  const second = await f.blogService.createPost('editor-1', postSchema.parse({ ...postInput, slug: 'second', title: 'Second', status: 'PUBLISHED' }));
  assert.equal(second.publishedAt === null, false);
  const all = await f.blogService.publicPosts({ limit: 1 });
  assert.equal(all.items.length, 1);
  assert.ok(all.nextCursor);
  const next = await f.blogService.publicPosts({ limit: 1, cursor: all.nextCursor! });
  assert.equal(next.items.length, 1);
  assert.equal(next.nextCursor, null);
  assert.equal((await f.blogService.publicPosts({ category: 'news', limit: 20 })).items.length, 2);
  assert.equal((await f.blogService.publicPosts({ category: 'events', limit: 20 })).items.length, 0);
  assert.equal((await f.blogService.publicPosts({ tag: 'cinema', limit: 20 })).items.length, 2);
  assert.equal((await f.blogService.publicPosts({ tag: 'acting', limit: 20 })).items.length, 0);
  await assert.rejects(f.blogService.publicPosts({ category: 'events', limit: 20, cursor: all.nextCursor! }), BadRequestException);
  await assert.rejects(f.blogService.publicPosts({ limit: 20, cursor: 'not-a-cursor!!' }), BadRequestException);
});

test('category and tag guards keep referential integrity with conflict errors', async () => {
  const f = fixture();
  await assert.rejects(f.blog.deleteCategory('actor', 'cat-1'), ConflictException);
  await assert.rejects(f.blog.deleteTag('actor', 'tag-1'), ConflictException);
  const free = await f.blog.createCategory('actor', categoryInput);
  await f.blog.deleteCategory('actor', free.id);
  await assert.rejects(f.blog.category(free.id), NotFoundException);
  const loose = await f.blog.createTag('actor', tagInput);
  await f.blog.deleteTag('actor', loose.id);
  assertOutbox(f, ['/', '/blog'], []);
});

test('role matrix separates instructor and blog editors at the guard level', async () => {
  assert.deepEqual(Reflect.getMetadata('roles', AdminInstructorsController), ['SUPER_ADMIN', 'CONTENT_MANAGER']);
  assert.deepEqual(Reflect.getMetadata('__guards__', AdminInstructorsController), [AccessGuard]);
  for (const controller of [AdminPostsController, AdminCategoriesController, AdminTagsController]) {
    assert.deepEqual(Reflect.getMetadata('roles', controller), ['SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR']);
  }
  assert.deepEqual(Reflect.getMetadata('imports', InstructorsModule), [AuthModule]);
  assert.deepEqual(Reflect.getMetadata('imports', BlogModule), [AuthModule]);
  const f = fixture();
  const users: Record<string, { id: string; role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'BLOG_EDITOR'; sessionId: string; csrfHash: string }> = {
    'editor-token': { id: 'editor', role: 'BLOG_EDITOR', sessionId: 's', csrfHash: '' },
    'manager-token': { id: 'manager', role: 'CONTENT_MANAGER', sessionId: 's', csrfHash: '' },
  };
  const module = await Test.createTestingModule({
    controllers: [AdminInstructorsController, AdminPostsController, AdminCategoriesController, AdminTagsController, PublicInstructorsController, PublicBlogController],
    providers: [
      { provide: InstructorsService, useValue: f.instructorService },
      { provide: BlogService, useValue: f.blogService },
      { provide: AuthService, useValue: { authenticate: async (token: string) => { const user = users[token]; if (!user) throw new (await import('@nestjs/common').then((m) => m.UnauthorizedException))(); return user; } } },
      { provide: Config, useValue: testConfig() },
      AccessGuard, Reflector,
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  try {
    const http = request(app.getHttpServer());
    await http.get('/admin/instructors').expect(401);
    await http.get('/admin/instructors').set('Authorization', 'Bearer editor-token').expect(403);
    await http.get('/admin/posts').set('Authorization', 'Bearer editor-token').expect(200);
    await http.get('/admin/categories').set('Authorization', 'Bearer editor-token').expect(200);
    await http.get('/admin/tags').set('Authorization', 'Bearer editor-token').expect(200);
    await http.get('/admin/instructors').set('Authorization', 'Bearer manager-token').expect(200);
    await http.get('/public/instructors').expect(200);
    await http.get('/public/posts').expect(200);
  } finally { await app.close(); }
});

test('controllers enforce strict full PUTs, sanitize HTML and send no-store', async () => {
  const f = fixture();
  const module = await Test.createTestingModule({
    controllers: [AdminInstructorsController, AdminPostsController, AdminCategoriesController, AdminTagsController, PublicInstructorsController, PublicBlogController],
    providers: [{ provide: InstructorsService, useValue: f.instructorService }, { provide: BlogService, useValue: f.blogService }],
  }).overrideGuard(AccessGuard).useValue({ canActivate(context: Parameters<AccessGuard['canActivate']>[0]) { context.switchToHttp().getRequest<{ user: unknown }>().user = { id: 'actor', role: 'CONTENT_MANAGER' }; return true; } }).compile();
  const app = module.createNestApplication();
  await app.init();
  try {
    const http = request(app.getHttpServer());
    const detail = await http.get('/admin/instructors/ins-pub').expect(200);
    assert.equal(detail.headers['cache-control'], 'no-store');
    assert.deepEqual(Object.keys(detail.body).sort(), ['id', 'slug', 'name', 'bio', 'image', 'status', 'customPath', 'createdAt', 'updatedAt', 'deletedAt'].sort());
    const postDetail = await http.get('/admin/posts/post-pub').expect(200);
    assert.deepEqual(Object.keys(postDetail.body).sort(), ['id', 'slug', 'title', 'excerpt', 'contentHtml', 'categoryId', 'authorId', 'tagIds', 'coverMediaId', 'coverMedia', 'status', 'seo', 'customPath', 'publishedAt', 'createdAt', 'updatedAt', 'deletedAt'].sort());
    await http.put('/admin/instructors/ins-pub').send({ name: 'Partial' }).expect(400);
    await http.put('/admin/posts/post-pub').send({ title: 'Partial' }).expect(400);
    await http.post('/admin/posts').send({ ...postInput, tagIds: ['tag-1', 'tag-1'] }).expect(400);
    await http.post('/admin/instructors').send({ ...instructorInput, unknown: true }).expect(400);
    const updated = await http.put('/admin/posts/post-pub').send({ ...postInput, slug: 'hello', status: 'PUBLISHED', contentHtml: '<p onclick="bad()">Safe</p><script>bad()</script>', tagIds: [] }).expect(200);
    assert.equal(updated.body.contentHtml, '<p>Safe</p>');
    assert.deepEqual(updated.body.tagIds, []);
    const pub = await http.get('/public/posts/hello').expect(200);
    assert.equal(pub.headers['cache-control'], 'no-store');
    assert.equal(pub.body.contentHtml, '<p>Safe</p>');
    await http.delete('/admin/posts/post-pub').expect(200);
    await http.get('/admin/posts/post-pub').expect(404);
    await http.get('/public/posts/hello').expect(404);
    await http.get('/public/posts').expect(200);
  } finally { await app.close(); }
});

test('outbox failure rolls back every cms mutation atomically', async () => {
  const operations = [
    (f: ReturnType<typeof fixture>) => f.instructors.create('actor', { ...instructorInput, slug: 'n1' }),
    (f: ReturnType<typeof fixture>) => f.instructors.update('actor', 'ins-pub', instructorInput),
    (f: ReturnType<typeof fixture>) => f.instructors.remove('actor', 'ins-pub'),
    (f: ReturnType<typeof fixture>) => f.blog.createCategory('actor', categoryInput),
    (f: ReturnType<typeof fixture>) => f.blog.createTag('actor', tagInput),
    (f: ReturnType<typeof fixture>) => f.blog.createPost('actor', { ...postInput, slug: 'n2' }),
    (f: ReturnType<typeof fixture>) => f.blog.updatePost('actor', 'post-pub', postInput),
    (f: ReturnType<typeof fixture>) => f.blog.deletePost('actor', 'post-pub'),
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
