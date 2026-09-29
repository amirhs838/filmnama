import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { AccessGuard } from '../src/auth/guards';
import {
  albumSchema, galleryItemSchema, mediaListSchema, mediaMetaSchema, mediaSchema,
  portfolioListSchema, portfolioSchema, settingsSchema, validRevalidationPath,
} from '../src/common/validation';
import { Config } from '../src/infrastructure/config';
import { Database } from '../src/infrastructure/infrastructure.module';
import { testConfig } from './auth.fixture';
import { AdminGalleryAlbumsController, AdminGalleryItemsController, GalleryModule, GalleryRepository, GalleryService, PublicAlbumsController } from '../src/gallery/gallery.module';
import { AdminWorksController, PortfolioModule, PortfolioRepository, PortfolioService, PublicWorksController } from '../src/portfolio/portfolio.module';
import { AdminMediaController, MediaModule, MediaRepository, MediaService } from '../src/media/media.module';
import { AdminSettingsController, PublicSettingsController, SettingsModule, SettingsRepository, SettingsService } from '../src/settings/settings.module';
import {
  AdminAuditsController, AdminDirectoryRepository, AdminDirectoryService, AdminRedirectsController,
  AdminRevalidationController, AdminUsersListController, UsersModule,
} from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';

const past = new Date('2025-12-01T00:00:00Z');
type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Album = { id: string; slug: string; title: string; description: string; status: Status; coverMediaId: string | null; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; noindex: boolean; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type Item = { id: string; albumId: string; mediaId: string; title: string; position: number; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type Media = { id: string; storageKey: string; mimeType: string; size: number; alt: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type Work = { id: string; slug: string; title: string; student: string; category: string; mediaId: string | null; contentHtml: string; status: Status; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; noindex: boolean; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type Settings = { name: string; description: string; contact: Record<string, string>; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; noindex: boolean; createdAt: Date; updatedAt: Date };
type User = { id: string; email: string; role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'BLOG_EDITOR'; active: boolean; createdAt: Date; deletedAt: Date | null };
type Audit = { id: string; actorId: string | null; action: string; entityType: string; entityId: string; metadata: unknown; createdAt: Date };
type Redirect = { id: string; source: string; destination: string | null; locale: string; createdAt: Date; updatedAt: Date };
type Outbox = { version: number; paths: string[]; delivered: boolean };
type State = {
  albums: Album[]; items: Item[]; media: Media[]; works: Work[]; settings: Settings | null;
  users: User[]; audits: Audit[]; redirects: Redirect[];
  version: number; outbox: Outbox[];
};
const album = (patch: Partial<Album> = {}): Album => ({ id: 'alb-pub', slug: 'summer-show', title: 'Summer Show', description: '', status: 'PUBLISHED', coverMediaId: null, seoTitle: null, seoDescription: null, canonicalUrl: null, noindex: false, createdAt: past, updatedAt: past, deletedAt: null, ...patch });
const item = (patch: Partial<Item> = {}): Item => ({ id: 'item-1', albumId: 'alb-pub', mediaId: 'med-1', title: 'Still 1', position: 0, createdAt: past, updatedAt: past, deletedAt: null, ...patch });
const media = (patch: Partial<Media> = {}): Media => ({ id: 'med-1', storageKey: 'stills/1.jpg', mimeType: 'image/jpeg', size: 1024, alt: 'Still', createdAt: past, updatedAt: past, deletedAt: null, ...patch });
const work = (patch: Partial<Work> = {}): Work => ({
  id: 'work-pub', slug: 'short-film', title: 'Short Film', student: 'Sara', category: 'fiction', mediaId: 'med-1',
  contentHtml: '<p>Body</p>', status: 'PUBLISHED', seoTitle: null, seoDescription: null, canonicalUrl: null, noindex: false,
  createdAt: past, updatedAt: past, deletedAt: null, ...patch,
});
const user = (patch: Partial<User> = {}): User => ({ id: 'user-1', email: 'a@example.test', role: 'CONTENT_MANAGER', active: true, createdAt: past, deletedAt: null, ...patch });
const albumInput = albumSchema.parse({ slug: 'new-album', title: 'New Album', description: 'Desc', status: 'DRAFT' });
const itemInput = (patch: object = {}) => galleryItemSchema.parse({ albumId: 'alb-pub', mediaId: 'med-1', title: 'Still', caption: 'Cap', position: 0, status: 'DRAFT', ...patch });
const workInput = (patch: object = {}) => portfolioSchema.parse({ slug: 'new-work', title: 'New Work', student: 'Sara', category: 'fiction', contentHtml: '<p>Body</p>', status: 'DRAFT', ...patch });
const mediaInput = { storageKey: 'stills/new.jpg', mimeType: 'image/jpeg', size: 2048, alt: 'New' } as const;
const settingsInput = settingsSchema.parse({ name: 'Filmnama', description: 'School', contact: { phone: '021-123' }, seo: { title: null, description: null, canonicalUrl: null, noindex: false } });

function fixture() {
  const state: State = {
    albums: [album(), album({ id: 'alb-draft', slug: 'draft-album', title: 'Draft', status: 'DRAFT' })],
    items: [item(), item({ id: 'item-2', mediaId: 'med-2', title: 'Still 2', position: 5 })],
    media: [media(), media({ id: 'med-2', storageKey: 'stills/2.jpg' }), media({ id: 'med-free', storageKey: 'stills/free.png', mimeType: 'image/png' })],
    works: [work(), work({ id: 'work-draft', slug: 'draft-work', status: 'DRAFT', category: 'doc' })],
    settings: null,
    users: [user(), user({ id: 'user-2', email: 'b@example.test', role: 'BLOG_EDITOR', active: false }), user({ id: 'user-3', email: 'c@example.test', role: 'SUPER_ADMIN' })],
    audits: [{ id: 'aud-1', actorId: 'user-1', action: 'CREATE', entityType: 'Post', entityId: 'p1', metadata: { slug: 'hello' }, createdAt: past }],
    redirects: [{ id: 'red-1', source: '/courses/old', destination: '/courses/new', locale: 'fa', createdAt: past, updatedAt: past }],
    version: 0, outbox: [],
  };
  let serialCalls = 0;
  let active = false;
  let failOutbox = false;
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-new-${++seq}`;
  const mutation = () => assert.equal(active, true, 'all writes must use Database.serial transaction');
  const unique = (): never => { throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '6.19.0' }); };
  const projectItem = (row: Item) => ({
    ...row,
    album: { slug: state.albums.find((a) => a.id === row.albumId)?.slug ?? 'missing' },
    media: (() => { const m = state.media.find((x) => x.id === row.mediaId); return { storageKey: m?.storageKey ?? 'missing', mimeType: m?.mimeType ?? 'missing', alt: m?.alt ?? '' }; })(),
  });
  const projectWork = (row: Work) => ({
    ...row,
    media: (() => { const m = state.media.find((x) => x.id === row.mediaId); return m ? { storageKey: m.storageKey, mimeType: m.mimeType, alt: m.alt } : null; })(),
  });
  type AlbumData = Partial<Album> & { coverMedia?: { connect: { id: string } } | { disconnect: boolean } };
  const projectAlbum = (row: Album) => ({
    ...row,
    coverMedia: (() => { const m = state.media.find((x) => x.id === row.coverMediaId); return m ? { id: m.id, alt: m.alt, deletedAt: m.deletedAt } : null; })(),
  });
  const saveAlbum = (data: AlbumData, id?: string) => {
    mutation();
    const { coverMedia: link, ...scalars } = data;
    const previous = id ? state.albums.find((r) => r.id === id)! : album({ id: nextId('alb'), slug: '', title: '', createdAt: new Date(), updatedAt: new Date() });
    const row: Album = {
      ...previous, ...scalars,
      coverMediaId: link && 'connect' in link ? link.connect.id : link ? null : (scalars.coverMediaId ?? previous.coverMediaId),
      updatedAt: new Date(),
    };
    if (state.albums.some((r) => r.id !== row.id && r.slug === row.slug)) unique();
    if (id) state.albums = state.albums.filter((r) => r.id !== id);
    state.albums.push(row);
    return projectAlbum(row);
  };
  const saveItem = (data: Partial<Item>, id?: string) => {
    mutation();
    const previous = id ? state.items.find((r) => r.id === id)! : item({ id: nextId('item'), albumId: '', mediaId: '', title: '', createdAt: new Date(), updatedAt: new Date() });
    const row = { ...previous, ...data, updatedAt: new Date() };
    if (id) state.items = state.items.filter((r) => r.id !== id);
    state.items.push(row);
    return projectItem(row);
  };
  const saveMedia = (data: Partial<Media>, id?: string) => {
    mutation();
    const previous = id ? state.media.find((r) => r.id === id)! : media({ id: nextId('med'), storageKey: '', createdAt: new Date(), updatedAt: new Date() });
    const row = { ...previous, ...data, updatedAt: new Date() };
    if (state.media.some((r) => r.id !== row.id && r.storageKey === row.storageKey)) unique();
    if (id) state.media = state.media.filter((r) => r.id !== id);
    state.media.push(row);
    return row;
  };
  type WorkData = Partial<Work> & { media?: { connect: { id: string } } | { disconnect: boolean } };
  const saveWork = (data: WorkData, id?: string) => {
    mutation();
    const { media: link, ...scalars } = data;
    const previous = id ? state.works.find((r) => r.id === id)! : work({ id: nextId('work'), slug: '', title: '', mediaId: null, createdAt: new Date(), updatedAt: new Date() });
    const row: Work = {
      ...previous, ...scalars,
      mediaId: link && 'connect' in link ? link.connect.id : link ? null : (scalars.mediaId ?? previous.mediaId),
      updatedAt: new Date(),
    };
    if (state.works.some((r) => r.id !== row.id && r.slug === row.slug)) unique();
    if (id) state.works = state.works.filter((r) => r.id !== id);
    state.works.push(row);
    return projectWork(row);
  };
  const tx = {
    galleryAlbum: {
      findFirst: async ({ where }: { where: { id?: string; slug?: string; status?: Status; deletedAt: null } }) => { const row = state.albums.find((r) => (where.id === undefined || r.id === where.id) && (where.slug === undefined || r.slug === where.slug) && (where.status === undefined || r.status === where.status) && r.deletedAt === null) ?? null; return row ? projectAlbum(row) : null; },
      findMany: async ({ where }: { where: { status?: Status; deletedAt: null } }) => state.albums.filter((r) => (where.status === undefined || r.status === where.status) && r.deletedAt === null).map(projectAlbum),
      create: async ({ data }: { data: Partial<Album> }) => saveAlbum(data),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Album> }) => saveAlbum(data, where.id),
      count: async ({ where }: { where: { coverMediaId: string; deletedAt: null } }) => state.albums.filter((r) => r.coverMediaId === where.coverMediaId && r.deletedAt === null).length,
    },
    galleryItem: {
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => { const row = state.items.find((r) => r.id === where.id && r.deletedAt === null); return row ? projectItem(row) : null; },
      findMany: async ({ where }: { where: { albumId?: string; deletedAt: null } }) => state.items.filter((r) => (where.albumId === undefined || r.albumId === where.albumId) && r.deletedAt === null).sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1)).map(projectItem),
      create: async ({ data }: { data: Partial<Item> }) => saveItem(data),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Item> }) => saveItem(data, where.id),
      count: async ({ where }: { where: { albumId?: string; mediaId?: string; deletedAt: null } }) => state.items.filter((r) => (where.albumId === undefined || r.albumId === where.albumId) && (where.mediaId === undefined || r.mediaId === where.mediaId) && r.deletedAt === null).length,
    },
    media: {
      findFirst: async ({ where }: { where: { id: string; deletedAt?: null } }) => state.media.find((r) => r.id === where.id && (where.deletedAt !== null || r.deletedAt === null)) ?? null,
      findMany: async ({ where, take }: { where: { deletedAt: null; mimeType?: string; id?: { gt: string } }; take?: number }) => state.media.filter((r) => r.deletedAt === null && (where.mimeType === undefined || r.mimeType === where.mimeType) && (!where.id || r.id > where.id.gt)).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, take),
      create: async ({ data }: { data: Partial<Media> }) => saveMedia(data),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Media> }) => saveMedia(data, where.id),
    },
    portfolioItem: {
      findFirst: async ({ where }: { where: { id?: string; slug?: string; status?: Status; deletedAt: null } }) => { const row = state.works.find((r) => (where.id === undefined || r.id === where.id) && (where.slug === undefined || r.slug === where.slug) && (where.status === undefined || r.status === where.status) && r.deletedAt === null); return row ? projectWork(row) : null; },
      findMany: async ({ where }: { where: { status?: Status; deletedAt: null; category?: string } }) => state.works.filter((r) => (where.status === undefined || r.status === where.status) && r.deletedAt === null && (where.category === undefined || r.category === where.category)),
      create: async ({ data }: { data: WorkData }) => saveWork(data),
      update: async ({ where, data }: { where: { id: string }; data: WorkData }) => saveWork(data, where.id),
      count: async ({ where }: { where: { mediaId: string; deletedAt: null } }) => state.works.filter((r) => r.mediaId === where.mediaId && r.deletedAt === null).length,
    },
    siteSettings: {
      findUnique: async () => state.settings,
      upsert: async ({ create, update }: { create: Partial<Settings>; update: Partial<Settings> }) => {
        mutation();
        state.settings = { ...(state.settings ?? { createdAt: new Date() }), ...create, ...update, updatedAt: new Date() } as Settings;
        return state.settings;
      },
    },
    user: {
      findMany: async ({ where, take }: { where: { deletedAt: null; active?: boolean; role?: string; id?: { gt: string } }; take?: number }) => state.users.filter((r) => r.deletedAt === null && (where.active === undefined || r.active === where.active) && (where.role === undefined || r.role === where.role) && (!where.id || r.id > where.id.gt)).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, take),
    },
    auditLog: {
      findMany: async ({ where, take }: { where: { entityType?: string; entityId?: string; actorId?: string; OR?: [{ createdAt: { lt: Date } }, { createdAt: Date; id: { lt: string } }] }; take?: number }) => state.audits.filter((r) => {
        if (where.entityType !== undefined && r.entityType !== where.entityType) return false;
        if (where.entityId !== undefined && r.entityId !== where.entityId) return false;
        if (where.actorId !== undefined && (r.actorId ?? undefined) !== where.actorId) return false;
        if (where.OR) {
          const [time, tie] = where.OR;
          if (!(r.createdAt < time.createdAt.lt || (r.createdAt.getTime() === tie.createdAt.getTime() && r.id < tie.id.lt))) return false;
        }
        return true;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1)).slice(0, take),
      create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
        mutation();
        state.audits.push({ id: `aud-${state.audits.length + 1}`, actorId: (data.actorId as string | null) ?? null, action: data.action as string, entityType: data.entityType as string, entityId: data.entityId as string, metadata: data.metadata ?? {}, createdAt: new Date() });
      },
    },
    redirect: {
      findMany: async ({ where, take }: { where: { id?: { gt: string } }; take?: number }) => state.redirects.filter((r) => !where.id || r.id > where.id.gt).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, take),
    },
    revalidationOutbox: {
      findMany: async ({ where, take }: { where: { deliveredAt?: null | { not: null }; OR?: [{ createdAt: { gt: Date } }, { createdAt: Date; id: { gt: string } }] }; take?: number }) => state.outbox.map((o, index) => ({ id: `out-${index}`, paths: o.paths, version: o.version, deliveredAt: o.delivered ? past : null, createdAt: past, updatedAt: past })).filter((r) => {
        if (where.deliveredAt === null && r.deliveredAt !== null) return false;
        if (where.deliveredAt !== undefined && where.deliveredAt !== null && r.deliveredAt === null) return false;
        if (where.OR) {
          const [time, tie] = where.OR;
          if (!(r.createdAt > time.createdAt.gt || (r.createdAt.getTime() === tie.createdAt.getTime() && r.id > tie.id.gt))) return false;
        }
        return true;
      }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1)).slice(0, take),
      create: async ({ data }: { data: { version: number; paths: string[] } }) => { mutation(); if (failOutbox) throw new Error('outbox unavailable'); state.outbox.push({ ...data, delivered: false }); },
    },
    contentRevision: { upsert: async () => { mutation(); return { version: ++state.version }; } },
  };
  const db = { ...tx, serial: async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) => {
    serialCalls++;
    const before = structuredClone(state);
    active = true;
    try { return await operation(tx as unknown as Prisma.TransactionClient); }
    catch (error) { Object.assign(state, before); throw error; }
    finally { active = false; }
  } } as unknown as Database;
  const gallery = new GalleryRepository(db);
  const galleryService = new GalleryService(gallery);
  const portfolio = new PortfolioRepository(db);
  const portfolioService = new PortfolioService(portfolio);
  const mediaRepo = new MediaRepository(db);
  const mediaService = new MediaService(mediaRepo);
  const settings = new SettingsRepository(db);
  const settingsService = new SettingsService(settings);
  const directory = new AdminDirectoryRepository(db);
  const directoryService = new AdminDirectoryService(directory);
  return { db, gallery, galleryService, portfolio, portfolioService, mediaRepo, mediaService, settings, settingsService, directory, directoryService, get state() { return state; }, get serialCalls() { return serialCalls; }, failOutbox() { failOutbox = true; } };
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

test('phase3 schemas are strict, bounded and sanitize HTML', () => {
  assert.equal(albumSchema.safeParse({ ...albumInput, locale: 'en' }).success, false);
  assert.equal(galleryItemSchema.safeParse({ ...itemInput(), extra: 1 }).success, false);
  assert.equal(portfolioSchema.safeParse({ ...workInput(), authorId: 'x' }).success, false);
  assert.equal(mediaSchema.safeParse({ ...mediaInput, bytes: 'x' }).success, false);
  assert.equal(mediaMetaSchema.safeParse({ alt: 'x', storageKey: 'y' }).success, false);
  assert.equal(settingsSchema.safeParse({ ...settingsInput, extra: 1 }).success, false);
  assert.equal(portfolioListSchema.safeParse({ category: 'x', limit: 1 }).success, false);
  assert.equal(mediaListSchema.safeParse({ mime: 'image/jpeg', unknown: 1 }).success, false);
  for (const patch of [{ slug: 'Bad' }, { slug: 'a'.repeat(81) }, { title: '' }, { title: 'a'.repeat(201) }, { description: 'a'.repeat(2001) }, { status: 'bad' }, { coverMediaId: '' }, { coverMediaId: 'x'.repeat(101) }]) {
    assert.equal(albumSchema.safeParse({ ...albumInput, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.ok(albumSchema.safeParse({ ...albumInput }).success);
  assert.equal(albumSchema.parse({ ...albumInput }).coverMediaId, null);
  assert.equal(albumSchema.parse({ ...albumInput, coverMediaId: undefined }).coverMediaId, null);
  for (const patch of [{ title: '' }, { title: 'a'.repeat(201) }, { caption: 'a'.repeat(2001) }, { position: -1 }, { position: 1.5 }, { status: 'NEW' }, { albumId: '' }]) {
    assert.equal(galleryItemSchema.safeParse({ ...itemInput(), ...patch }).success, false, JSON.stringify(patch));
  }
  assert.ok(galleryItemSchema.safeParse({ ...itemInput(), mediaId: undefined }).success);
  assert.equal(galleryItemSchema.safeParse({ ...itemInput(), caption: undefined }).success, false);
  for (const patch of [{ mimeType: 'image/gif' }, { mimeType: 'application/octet-stream' }, { size: 0 }, { size: 500 * 1024 * 1024 + 1 }, { storageKey: '' }, { storageKey: 'a'.repeat(501) }, { alt: 'a'.repeat(501) }]) {
    assert.equal(mediaSchema.safeParse({ ...mediaInput, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.ok(mediaSchema.safeParse({ ...mediaInput, mimeType: 'video/mp4' }).success);
  for (const patch of [{ title: '' }, { title: 'a'.repeat(201) }, { category: '' }, { category: 'a'.repeat(101) }, { contentHtml: 'a'.repeat(100001) }, { status: 'NEW' }]) {
    assert.equal(portfolioSchema.safeParse({ ...workInput(), ...patch }).success, false, JSON.stringify(patch));
  }
  assert.equal(portfolioSchema.parse({ ...workInput(), contentHtml: '<p onclick="bad()">Safe</p><script>bad()</script>' }).contentHtml, '<p>Safe</p>');
  assert.equal(portfolioSchema.parse({ ...workInput(), mediaId: undefined }).mediaId, null);
  assert.equal(portfolioSchema.parse({ ...workInput(), student: undefined }).student, '');
  for (const patch of [{ name: '' }, { name: 'a'.repeat(201) }, { description: 'a'.repeat(2001) }, { contact: { phone: 'a'.repeat(501) } }, { contact: { unknown: 'x' } }]) {
    assert.equal(settingsSchema.safeParse({ ...settingsInput, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.equal(settingsSchema.safeParse({ ...settingsInput, contact: undefined }).success, false);
  assert.ok(settingsSchema.safeParse({ ...settingsInput, contact: {} }).success);
});

test('validRevalidationPath covers gallery and works while keeping admin closed', () => {
  for (const path of ['/', '/gallery', '/gallery/summer-show', '/works', '/works/short-film', '/blog', '/blog/hello', '/instructors', '/instructors/sara']) assert.equal(validRevalidationPath(path), true, path);
  for (const path of ['/admin', '/gallery/', '/Gallery/x', '/gallery//x', '/works?x=1', '/media', '/settings', '']) assert.equal(validRevalidationPath(path), false, path);
});

test('gallery album mutations audit without PII, revise and enqueue gallery paths', async () => {
  const f = fixture();
  const created = await f.gallery.createAlbum('actor', albumInput);
  assert.equal(f.serialCalls, 1);
  const audit = f.state.audits.at(-1)!;
  assert.deepEqual({ actorId: audit.actorId, action: audit.action, entityType: audit.entityType, entityId: audit.entityId, metadata: audit.metadata }, { actorId: 'actor', action: 'CREATE', entityType: 'GalleryAlbum', entityId: created.id, metadata: { slug: 'new-album', status: 'DRAFT' } });
  assert.ok(!JSON.stringify(audit).includes('Desc'));
  assertOutbox(f, ['/', '/gallery'], ['/gallery/new-album']);
  const updated = await f.gallery.updateAlbum('actor', created.id, { ...albumInput, slug: 'renamed', status: 'PUBLISHED' });
  assert.equal(updated.slug, 'renamed');
  assert.equal(updated.coverMediaId, null);
  assert.equal(updated.coverMedia, null);
  const covered = await f.gallery.updateAlbum('actor', created.id, { ...albumInput, slug: 'renamed', status: 'PUBLISHED', coverMediaId: 'med-1' });
  assert.equal(covered.coverMediaId, 'med-1');
  assert.equal(covered.coverMedia!.id, 'med-1');
  assert.deepEqual((await f.galleryService.public('renamed')).coverMedia, { id: 'med-1', url: '/api/v1/public/media/med-1/file', alt: 'Still' });
  await assert.rejects(f.gallery.updateAlbum('actor', created.id, { ...albumInput, slug: 'renamed', coverMediaId: 'missing' }), BadRequestException);
  const vid = await f.mediaService.create('actor', { storageKey: 'stills/clip.mp4', mimeType: 'video/mp4', size: 512, alt: 'Clip' });
  await assert.rejects(f.gallery.updateAlbum('actor', created.id, { ...albumInput, slug: 'renamed', coverMediaId: vid.id }), BadRequestException);
  await assert.rejects(f.mediaRepo.remove('actor', 'med-1'), ConflictException);
  await f.gallery.updateAlbum('actor', created.id, { ...albumInput, slug: 'renamed', coverMediaId: null });
  assertOutbox(f, ['/', '/gallery'], ['/gallery/renamed']);
  await assert.rejects(f.gallery.createAlbum('actor', { ...albumInput, slug: 'renamed' }), ConflictException);
  await assert.rejects(f.gallery.removeAlbum('actor', 'alb-pub'), ConflictException);
  await f.gallery.removeAlbum('actor', 'alb-draft');
  await assert.rejects(f.gallery.album('alb-draft'), NotFoundException);
  assertOutbox(f, ['/', '/gallery'], ['/gallery/draft-album']);
});

test('gallery public reads order items by position and hide drafts', async () => {
  const f = fixture();
  await f.gallery.createItem('actor', itemInput({ albumId: 'alb-pub', mediaId: 'med-free', title: 'First', position: 1 }));
  const detail = await f.galleryService.public('summer-show');
  assert.deepEqual(detail.items.map((i) => i.mediaId).sort(), ['med-1', 'med-2', 'med-free'].sort());
  assert.deepEqual(detail.items.map((i) => i.position), [0, 1, 5]);
  assert.deepEqual(detail.items.map((i) => i.title).sort(), ['First', 'Still 1', 'Still 2']);
  assert.equal((await f.galleryService.publics()).items.length, 1);
  await assert.rejects(f.galleryService.public('draft-album'), NotFoundException);
  await assert.rejects(f.gallery.createItem('actor', itemInput({ mediaId: 'missing' })), BadRequestException);
  await assert.rejects(f.gallery.createItem('actor', itemInput({ mediaId: undefined })), BadRequestException);
  await assert.rejects(f.gallery.createItem('actor', itemInput({ albumId: 'missing' })), BadRequestException);
  await f.gallery.removeItem('actor', 'item-1');
  assert.deepEqual((await f.galleryService.public('summer-show')).items.map((i) => i.id).sort(), ['item-2', detail.items.find((i) => i.title === 'First')!.id].sort());
});

test('portfolio mutations filter by category, sanitize and enqueue work paths', async () => {
  const f = fixture();
  assert.equal((await f.portfolioService.publics({})).items.length, 1);
  assert.equal((await f.portfolioService.publics({ category: 'fiction' })).items.length, 1);
  assert.equal((await f.portfolioService.publics({ category: 'doc' })).items.length, 0);
  await assert.rejects(f.portfolioService.public('draft-work'), NotFoundException);
  const created = await f.portfolioService.create('actor', workInput({ contentHtml: '<p onclick="bad()">Safe</p><script>bad()</script>' }));
  assert.equal(created.contentHtml, '<p>Safe</p>');
  assert.equal(created.mediaId, null);
  assertOutbox(f, ['/', '/works'], ['/works/new-work']);
  const updated = await f.portfolioService.update('actor', created.id, workInput({ slug: 'renamed', status: 'PUBLISHED', mediaId: 'med-1' }));
  assert.equal(updated.mediaId, 'med-1');
  assert.equal((await f.portfolioService.public('renamed')).mediaId, 'med-1');
  assertOutbox(f, ['/', '/works'], ['/works/new-work', '/works/renamed']);
  await assert.rejects(f.portfolioService.create('actor', workInput({ slug: 'renamed' })), ConflictException);
  await assert.rejects(f.portfolioService.create('actor', workInput({ slug: 'other', mediaId: 'missing' })), BadRequestException);
  await f.portfolioService.remove('actor', created.id);
  await assert.rejects(f.portfolioService.public('renamed'), NotFoundException);
});

test('media metadata CRUD paginates, filters and guards orphans with 409', async () => {
  const f = fixture();
  const page = await f.mediaService.list({ limit: 2 });
  assert.equal(page.items.length, 2);
  assert.ok(page.nextCursor);
  const next = await f.mediaService.list({ limit: 2, cursor: page.nextCursor! });
  assert.equal(next.items.length, 1);
  assert.equal(next.nextCursor, null);
  assert.equal((await f.mediaService.list({ mime: 'image/png', limit: 20 })).items.length, 1);
  await assert.rejects(f.mediaService.list({ limit: 20, cursor: 'not-a-cursor!!' }), BadRequestException);
  await assert.rejects(f.mediaService.list({ mime: 'image/png', limit: 20, cursor: page.nextCursor! }), BadRequestException);
  const created = await f.mediaService.create('actor', { ...mediaInput });
  assert.equal(created.alt, 'New');
  await assert.rejects(f.mediaService.create('actor', { ...mediaInput }), ConflictException);
  const patched = await f.mediaService.updateAlt('actor', created.id, { alt: 'Updated' });
  assert.equal(patched.alt, 'Updated');
  assertOutbox(f, ['/', '/gallery', '/works'], []);
  await assert.rejects(f.mediaRepo.remove('actor', 'med-1'), ConflictException);
  await assert.rejects(f.mediaRepo.remove('actor', 'med-2'), ConflictException);
  await f.mediaService.remove('actor', 'med-free');
  await assert.rejects(f.mediaService.detail('med-free'), NotFoundException);
  await f.mediaService.remove('actor', created.id);
});

test('settings singleton upserts to id 1 with root-only outbox', async () => {
  const f = fixture();
  await assert.rejects(f.settingsService.public(), NotFoundException);
  await assert.rejects(f.settingsService.get(), NotFoundException);
  const first = await f.settingsService.upsert('actor', settingsInput);
  assert.equal(first.name, 'Filmnama');
  assert.deepEqual(first.contact, { phone: '021-123' });
  const audit = f.state.audits.at(-1)!;
  assert.deepEqual({ actorId: audit.actorId, action: audit.action, entityType: audit.entityType, entityId: audit.entityId, metadata: audit.metadata }, { actorId: 'actor', action: 'UPDATE', entityType: 'SiteSettings', entityId: '1', metadata: { name: 'Filmnama' } });
  assert.deepEqual(f.state.outbox.at(-1), { version: f.state.version, paths: ['/'], delivered: false });
  const second = await f.settingsService.upsert('actor', { ...settingsInput, name: 'Renamed', contact: {} });
  assert.equal(second.name, 'Renamed');
  assert.ok(f.state.settings);
  assert.equal((await f.settingsService.public()).name, 'Renamed');
});

test('admin directory lists scope rows, leak no hashes and bind cursors', async () => {
  const f = fixture();
  const all = await f.directoryService.users({ limit: 20 });
  assert.equal(all.items.length, 3);
  assert.deepEqual(Object.keys(all.items[0]!).sort(), ['active', 'createdAt', 'email', 'id', 'role']);
  assert.ok(!JSON.stringify(all).includes('password'));
  assert.equal((await f.directoryService.users({ active: true, limit: 20 })).items.length, 2);
  assert.equal((await f.directoryService.users({ role: 'BLOG_EDITOR', limit: 20 })).items.length, 1);
  const page = await f.directoryService.users({ limit: 2 });
  assert.ok(page.nextCursor);
  const rest = await f.directoryService.users({ limit: 2, cursor: page.nextCursor! });
  assert.equal(rest.items.length, 1);
  await assert.rejects(f.directoryService.users({ limit: 20, cursor: 'bad!!' }), BadRequestException);
  await assert.rejects(f.directoryService.users({ active: true, limit: 20, cursor: page.nextCursor! }), BadRequestException);
  const audits = await f.directoryService.audits({ entityType: 'Post', limit: 20 });
  assert.equal(audits.items.length, 1);
  assert.deepEqual(audits.items[0]!.metadata, { slug: 'hello' });
  assert.equal((await f.directoryService.audits({ entityType: 'Media', limit: 20 })).items.length, 0);
  const redirects = await f.directoryService.redirects({ limit: 20 });
  assert.equal(redirects.items.length, 1);
  assert.equal(redirects.items[0]!.source, '/courses/old');
  f.state.outbox.push({ version: 1, paths: ['/'], delivered: true });
  assert.equal((await f.directoryService.revalidation({ pending: true, limit: 20 })).items.length, 0);
  assert.equal((await f.directoryService.revalidation({ pending: false, limit: 20 })).items.length, 1);
  const delivered = (await f.directoryService.revalidation({ limit: 20 })).items[0]!;
  assert.equal(delivered.deliveredAt, past.toISOString());
  await f.gallery.createAlbum('actor', albumInput);
  const pending = await f.directoryService.revalidation({ pending: true, limit: 20 });
  assert.equal(pending.items.length, 1);
  assert.equal(pending.items[0]!.deliveredAt, null);
});

test('role matrix denies blog editors on every phase3 admin surface', async () => {
  for (const controller of [AdminGalleryAlbumsController, AdminGalleryItemsController, AdminWorksController, AdminMediaController, AdminSettingsController]) {
    assert.deepEqual(Reflect.getMetadata('roles', controller), ['SUPER_ADMIN', 'CONTENT_MANAGER']);
  }
  assert.deepEqual(Reflect.getMetadata('roles', AdminUsersListController), ['SUPER_ADMIN']);
  assert.deepEqual(Reflect.getMetadata('roles', AdminAuditsController), ['SUPER_ADMIN']);
  assert.deepEqual(Reflect.getMetadata('roles', AdminRedirectsController), ['SUPER_ADMIN', 'CONTENT_MANAGER']);
  assert.deepEqual(Reflect.getMetadata('roles', AdminRevalidationController), ['SUPER_ADMIN', 'CONTENT_MANAGER']);
  assert.deepEqual(Reflect.getMetadata('imports', GalleryModule), [AuthModule]);
  assert.deepEqual(Reflect.getMetadata('imports', PortfolioModule), [AuthModule]);
  assert.deepEqual(Reflect.getMetadata('imports', MediaModule), [AuthModule]);
  assert.deepEqual(Reflect.getMetadata('imports', SettingsModule), [AuthModule]);
  assert.deepEqual(Reflect.getMetadata('imports', UsersModule), [AuthModule]);
  const f = fixture();
  await f.settingsService.upsert('actor', settingsInput);
  const users: Record<string, { id: string; role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'BLOG_EDITOR'; sessionId: string; csrfHash: string }> = {
    'editor-token': { id: 'editor', role: 'BLOG_EDITOR', sessionId: 's', csrfHash: '' },
    'manager-token': { id: 'manager', role: 'CONTENT_MANAGER', sessionId: 's', csrfHash: '' },
    'admin-token': { id: 'admin', role: 'SUPER_ADMIN', sessionId: 's', csrfHash: '' },
  };
  const module = await Test.createTestingModule({
    controllers: [AdminGalleryAlbumsController, AdminGalleryItemsController, AdminWorksController, AdminMediaController, AdminSettingsController, AdminUsersListController, AdminAuditsController, AdminRedirectsController, AdminRevalidationController, PublicAlbumsController, PublicWorksController, PublicSettingsController],
    providers: [
      { provide: GalleryService, useValue: f.galleryService },
      { provide: PortfolioService, useValue: f.portfolioService },
      { provide: MediaService, useValue: f.mediaService },
      { provide: SettingsService, useValue: f.settingsService },
      { provide: AdminDirectoryService, useValue: f.directoryService },
      { provide: AuthService, useValue: { authenticate: async (token: string) => { const found = users[token]; if (!found) throw new NotFoundException(); return found; } } },
      { provide: Config, useValue: testConfig() },
      AccessGuard, Reflector,
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  try {
    const http = request(app.getHttpServer());
    await http.get('/admin/gallery-albums').expect(401);
    for (const path of ['/admin/gallery-albums', '/admin/gallery-items', '/admin/works', '/admin/media', '/admin/settings', '/admin/users', '/admin/audits', '/admin/redirects', '/admin/revalidation']) {
      await http.get(path).set('Authorization', 'Bearer editor-token').expect(403);
    }
    for (const path of ['/admin/gallery-albums', '/admin/gallery-items', '/admin/works', '/admin/media', '/admin/settings', '/admin/redirects', '/admin/revalidation']) {
      await http.get(path).set('Authorization', 'Bearer manager-token').expect(200);
    }
    for (const path of ['/admin/users', '/admin/audits']) {
      await http.get(path).set('Authorization', 'Bearer manager-token').expect(403);
    }
    for (const path of ['/admin/gallery-albums', '/admin/users', '/admin/audits', '/admin/redirects', '/admin/revalidation']) {
      await http.get(path).set('Authorization', 'Bearer admin-token').expect(200);
    }
    await http.get('/public/albums').expect(200);
    await http.get('/public/works').expect(200);
  } finally { await app.close(); }
});

test('controllers enforce strict full PUTs and send no-store', async () => {
  const f = fixture();
  await f.settingsService.upsert('actor', settingsInput);
  const module = await Test.createTestingModule({
    controllers: [AdminGalleryAlbumsController, AdminGalleryItemsController, AdminWorksController, AdminMediaController, AdminSettingsController, PublicAlbumsController, PublicWorksController, PublicSettingsController],
    providers: [{ provide: GalleryService, useValue: f.galleryService }, { provide: PortfolioService, useValue: f.portfolioService }, { provide: MediaService, useValue: f.mediaService }, { provide: SettingsService, useValue: f.settingsService }],
  }).overrideGuard(AccessGuard).useValue({ canActivate(context: Parameters<AccessGuard['canActivate']>[0]) { context.switchToHttp().getRequest<{ user: unknown }>().user = { id: 'actor', role: 'CONTENT_MANAGER' }; return true; } }).compile();
  const app = module.createNestApplication();
  await app.init();
  try {
    const http = request(app.getHttpServer());
    const albums = await http.get('/public/albums').expect(200);
    assert.equal(albums.headers['cache-control'], 'no-store');
    assert.equal(albums.body.items.length, 1);
    const works = await http.get('/public/works?category=fiction').expect(200);
    assert.equal(works.headers['cache-control'], 'no-store');
    assert.equal(works.body.items.length, 1);
    const settings = await http.get('/public/settings').expect(200);
    assert.equal(settings.headers['cache-control'], 'no-store');
    assert.equal(settings.body.name, 'Filmnama');
    await http.get('/public/albums/draft-album').expect(404);
    await http.get('/public/works/draft-work').expect(404);
    await http.put('/admin/gallery-albums/alb-pub').send({ title: 'Partial' }).expect(400);
    await http.post('/admin/gallery-items').send({ ...itemInput(), unknown: true }).expect(400);
    await http.post('/admin/works').send({ ...workInput(), tagIds: ['x'] }).expect(400);
    await http.post('/admin/media').send({ ...mediaInput, mimeType: 'image/gif' }).expect(400);
    await http.patch('/admin/media/med-1').send({ alt: 'Ok', size: 1 }).expect(400);
    await http.put('/admin/settings').send({ name: 'Partial' }).expect(400);
    const patched = await http.patch('/admin/media/med-1').send({ alt: 'Updated' }).expect(200);
    assert.equal(patched.body.alt, 'Updated');
    await http.delete('/admin/media/med-1').expect(409);
    const detail = await http.get('/admin/gallery-albums/alb-pub').expect(200);
    assert.deepEqual(Object.keys(detail.body).sort(), ['coverMedia', 'coverMediaId', 'createdAt', 'deletedAt', 'description', 'id', 'seo', 'slug', 'status', 'title', 'updatedAt'].sort());
  } finally { await app.close(); }
});

test('outbox failure rolls back every phase3 mutation atomically', async () => {
  const operations = [
    (f: ReturnType<typeof fixture>) => f.gallery.createAlbum('actor', { ...albumInput, slug: 'n1' }),
    (f: ReturnType<typeof fixture>) => f.gallery.updateAlbum('actor', 'alb-pub', albumInput),
    (f: ReturnType<typeof fixture>) => f.gallery.removeAlbum('actor', 'alb-draft'),
    (f: ReturnType<typeof fixture>) => f.gallery.createItem('actor', { ...itemInput(), title: 'n1' }),
    (f: ReturnType<typeof fixture>) => f.gallery.updateItem('actor', 'item-1', itemInput()),
    (f: ReturnType<typeof fixture>) => f.gallery.removeItem('actor', 'item-1'),
    (f: ReturnType<typeof fixture>) => f.portfolio.create('actor', { ...workInput(), slug: 'n2' }),
    (f: ReturnType<typeof fixture>) => f.portfolio.update('actor', 'work-pub', workInput()),
    (f: ReturnType<typeof fixture>) => f.portfolio.remove('actor', 'work-pub'),
    (f: ReturnType<typeof fixture>) => f.mediaRepo.create('actor', { ...mediaInput }),
    (f: ReturnType<typeof fixture>) => f.mediaRepo.updateAlt('actor', 'med-1', { alt: 'x' }),
    (f: ReturnType<typeof fixture>) => f.mediaRepo.remove('actor', 'med-free'),
    (f: ReturnType<typeof fixture>) => f.settings.upsert('actor', settingsInput),
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
