import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, AuthRequest, Roles } from '../auth/guards';
import { AlbumInput, albumSchema, GalleryItemInput, galleryItemSchema, SchemaPipe, slug } from '../common/validation';
import { Database } from '../infrastructure/infrastructure.module';

// Phase 3 caching choice: same as instructors/blog (no Redis versioned cache).
// All endpoints send `Cache-Control: no-store` explicitly, and
// src/security/runtime.ts also forces no-store for these public paths.

const idSchema = z.string().min(1).max(100);
const itemsQuerySchema = z.object({ albumId: z.string().min(1).max(100).optional() }).strict();
type ItemsQuery = z.infer<typeof itemsQuerySchema>;
const albumSelect = {
  id: true, slug: true, title: true, description: true, status: true,
  seoTitle: true, seoDescription: true, canonicalUrl: true, noindex: true,
  coverMediaId: true,
  coverMedia: { select: { id: true, alt: true, deletedAt: true } },
  createdAt: true, updatedAt: true, deletedAt: true,
} satisfies Prisma.GalleryAlbumSelect;
const itemSelect = {
  id: true, albumId: true, mediaId: true, title: true, position: true,
  createdAt: true, updatedAt: true, deletedAt: true,
  album: { select: { slug: true } },
  media: { select: { storageKey: true, mimeType: true, alt: true } },
} satisfies Prisma.GalleryItemSelect;
type AlbumRow = Prisma.GalleryAlbumGetPayload<{ select: typeof albumSelect }>;
type ItemRow = Prisma.GalleryItemGetPayload<{ select: typeof itemSelect }>;
function seoDto(row: AlbumRow) {
  return { title: row.seoTitle, description: row.seoDescription, canonicalUrl: row.canonicalUrl, noindex: row.noindex };
}
function coverMediaDto(row: AlbumRow) {
  const cover = row.coverMedia;
  if (!cover || cover.deletedAt) return null;
  return { id: cover.id, url: `/api/v1/public/media/${cover.id}/file`, alt: cover.alt };
}
function albumDto(row: AlbumRow) {
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description, status: row.status, seo: seoDto(row),
    coverMediaId: row.coverMediaId ?? null, coverMedia: coverMediaDto(row),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
function publicAlbumDto(row: AlbumRow) {
  return { id: row.id, slug: row.slug, title: row.title, description: row.description, seo: seoDto(row), coverMedia: coverMediaDto(row), updatedAt: row.updatedAt.toISOString() };
}
function publicItemDto(row: ItemRow) {
  return { id: row.id, title: row.title, position: row.position, mediaId: row.mediaId, media: { storageKey: row.media.storageKey, mimeType: row.media.mimeType, alt: row.media.alt } };
}
function itemDto(row: ItemRow) {
  return {
    id: row.id, albumId: row.albumId, mediaId: row.mediaId, title: row.title, position: row.position,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
function seoData(seo: AlbumInput['seo']) {
  return { seoTitle: seo?.title ?? null, seoDescription: seo?.description ?? null, canonicalUrl: seo?.canonicalUrl ?? null, noindex: seo?.noindex ?? false };
}
const albumPath = (value: string) => `/gallery/${value}`;

@Injectable()
export class GalleryRepository {
  constructor(private readonly db: Database) {}
  albums() { return this.db.galleryAlbum.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: albumSelect }); }
  items(query: ItemsQuery) {
    return this.db.galleryItem.findMany({
      where: { deletedAt: null, ...(query.albumId ? { albumId: query.albumId } : {}) },
      orderBy: [{ position: 'asc' }, { id: 'asc' }], select: itemSelect,
    });
  }
  async album(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.galleryAlbum.findFirst({ where: { id, deletedAt: null }, select: albumSelect });
    if (!row) throw new NotFoundException('Album not found');
    return row;
  }
  async item(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.galleryItem.findFirst({ where: { id, deletedAt: null }, select: itemSelect });
    if (!row) throw new NotFoundException('Gallery item not found');
    return row;
  }
  publics() {
    return this.db.galleryAlbum.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, orderBy: { id: 'asc' }, select: albumSelect });
  }
  async public(slugValue: string) {
    const album = await this.db.galleryAlbum.findFirst({ where: { slug: slugValue, status: 'PUBLISHED', deletedAt: null }, select: albumSelect });
    if (!album) return null;
    const items = await this.db.galleryItem.findMany({ where: { albumId: album.id, deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: itemSelect });
    return { album, items };
  }
  private async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try { return await this.db.serial(operation); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('Gallery slug is reserved');
        if (error.code === 'P2025') throw new NotFoundException();
      }
      throw error;
    }
  }
  private async changed(tx: Prisma.TransactionClient, actorId: string, entityType: 'GalleryAlbum' | 'GalleryItem', entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', metadata: Record<string, string | null>, paths: Set<string>) {
    // No PII beyond slugs/ids: titles/descriptions are content, never logged.
    await tx.auditLog.create({ data: { actorId, entityType, entityId, action, metadata } });
    const revision = await tx.contentRevision.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
    const allPaths = [...new Set(['/', '/gallery', ...paths])];
    for (let i = 0; i < allPaths.length; i += 100) await tx.revalidationOutbox.create({ data: { version: revision.version, paths: allPaths.slice(i, i + 100) } });
  }
  private async albumRelations(tx: Prisma.TransactionClient, input: AlbumInput) {
    if (input.coverMediaId) {
      const media = await tx.media.findFirst({ where: { id: input.coverMediaId, deletedAt: null }, select: { id: true, mimeType: true } });
      if (!media) throw new BadRequestException('Invalid cover');
      if (!media.mimeType.startsWith('image/')) throw new BadRequestException('Invalid cover');
    }
  }
  createAlbum(actorId: string, input: AlbumInput) {
    return this.mutate(async (tx) => {
      await this.albumRelations(tx, input);
      const row = await tx.galleryAlbum.create({
        data: { slug: input.slug, title: input.title, description: input.description, status: input.status, ...seoData(input.seo), ...(input.coverMediaId ? { coverMedia: { connect: { id: input.coverMediaId } } } : {}) },
        select: albumSelect,
      });
      await this.changed(tx, actorId, 'GalleryAlbum', row.id, 'CREATE', { slug: row.slug, status: row.status }, new Set([albumPath(row.slug)]));
      return row;
    });
  }
  updateAlbum(actorId: string, id: string, input: AlbumInput) {
    return this.mutate(async (tx) => {
      const old = await this.album(id, tx);
      await this.albumRelations(tx, input);
      const row = await tx.galleryAlbum.update({
        where: { id },
        data: { slug: input.slug, title: input.title, description: input.description, status: input.status, ...seoData(input.seo), coverMedia: input.coverMediaId ? { connect: { id: input.coverMediaId } } : { disconnect: true } },
        select: albumSelect,
      });
      await this.changed(tx, actorId, 'GalleryAlbum', id, 'UPDATE', { slug: row.slug, status: row.status }, new Set([albumPath(old.slug), albumPath(row.slug)]));
      return row;
    });
  }
  removeAlbum(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.album(id, tx);
      if (await tx.galleryItem.count({ where: { albumId: id, deletedAt: null } })) throw new ConflictException('Album has undeleted items');
      const row = await tx.galleryAlbum.update({ where: { id }, data: { deletedAt: new Date() }, select: albumSelect });
      await this.changed(tx, actorId, 'GalleryAlbum', id, 'DELETE', { slug: old.slug, status: old.status }, new Set([albumPath(old.slug)]));
      return row;
    });
  }
  private async itemRelations(tx: Prisma.TransactionClient, input: GalleryItemInput) {
    const album = await tx.galleryAlbum.findFirst({ where: { id: input.albumId, deletedAt: null }, select: { id: true, slug: true } });
    if (!album) throw new BadRequestException('Album not found');
    if (!input.mediaId || !await tx.media.findFirst({ where: { id: input.mediaId, deletedAt: null }, select: { id: true } })) throw new BadRequestException('Media not found');
    return album;
  }
  createItem(actorId: string, input: GalleryItemInput) {
    return this.mutate(async (tx) => {
      const album = await this.itemRelations(tx, input);
      // caption/status are accepted by the schema but GalleryItem has no such
      // columns (no migration): only title/position persist.
      const row = await tx.galleryItem.create({
        data: { albumId: input.albumId, mediaId: input.mediaId!, title: input.title, position: input.position },
        select: itemSelect,
      });
      await this.changed(tx, actorId, 'GalleryItem', row.id, 'CREATE', { albumId: row.albumId, title: row.title }, new Set([albumPath(album.slug)]));
      return row;
    });
  }
  updateItem(actorId: string, id: string, input: GalleryItemInput) {
    return this.mutate(async (tx) => {
      const old = await this.item(id, tx);
      const album = await this.itemRelations(tx, input);
      const row = await tx.galleryItem.update({
        where: { id },
        data: { albumId: input.albumId, mediaId: input.mediaId!, title: input.title, position: input.position },
        select: itemSelect,
      });
      await this.changed(tx, actorId, 'GalleryItem', id, 'UPDATE', { albumId: row.albumId, title: row.title }, new Set([albumPath(old.album.slug), albumPath(album.slug)]));
      return row;
    });
  }
  removeItem(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.item(id, tx);
      const row = await tx.galleryItem.update({ where: { id }, data: { deletedAt: new Date() }, select: itemSelect });
      await this.changed(tx, actorId, 'GalleryItem', id, 'DELETE', { albumId: old.albumId, title: old.title }, new Set([albumPath(old.album.slug)]));
      return row;
    });
  }
}

@Injectable()
export class GalleryService {
  constructor(private readonly repo: GalleryRepository) {}
  async albums() { return { items: (await this.repo.albums()).map(albumDto) }; }
  async album(id: string) { return albumDto(await this.repo.album(id)); }
  async createAlbum(actorId: string, input: AlbumInput) { return albumDto(await this.repo.createAlbum(actorId, input)); }
  async updateAlbum(actorId: string, id: string, input: AlbumInput) { return albumDto(await this.repo.updateAlbum(actorId, id, input)); }
  async removeAlbum(actorId: string, id: string) { return albumDto(await this.repo.removeAlbum(actorId, id)); }
  async items(query: ItemsQuery) { return { items: (await this.repo.items(query)).map(itemDto) }; }
  async item(id: string) { return itemDto(await this.repo.item(id)); }
  async createItem(actorId: string, input: GalleryItemInput) { return itemDto(await this.repo.createItem(actorId, input)); }
  async updateItem(actorId: string, id: string, input: GalleryItemInput) { return itemDto(await this.repo.updateItem(actorId, id, input)); }
  async removeItem(actorId: string, id: string) { return itemDto(await this.repo.removeItem(actorId, id)); }
  async publics() { return { items: (await this.repo.publics()).map(publicAlbumDto) }; }
  async public(slugValue: string) {
    const found = await this.repo.public(slugValue);
    if (!found) throw new NotFoundException('Album not found');
    return { ...publicAlbumDto(found.album), items: found.items.map(publicItemDto) };
  }
}

class AlbumCoverMediaDto {
  id!: string;
  url!: string;
  alt!: string;
}
class AlbumDto {
  id!: string;
  slug!: string;
  title!: string;
  description!: string;
  status!: string;
  coverMediaId!: string | null;
  coverMedia!: AlbumCoverMediaDto | null;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class AlbumListDto {
  items!: AlbumDto[];
}
class GalleryItemDto {
  id!: string;
  albumId!: string;
  mediaId!: string;
  title!: string;
  position!: number;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class GalleryItemListDto {
  items!: GalleryItemDto[];
}
class PublicGalleryItemDto {
  id!: string;
  title!: string;
  position!: number;
  mediaId!: string;
}
class PublicAlbumDto {
  id!: string;
  slug!: string;
  title!: string;
  description!: string;
  coverMedia!: AlbumCoverMediaDto | null;
  updatedAt!: string;
  items!: PublicGalleryItemDto[];
}
class PublicAlbumListDto {
  items!: PublicAlbumDto[];
}

@ApiTags('admin-gallery-albums')
@ApiBearerAuth()
@Controller('admin/gallery-albums')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminGalleryAlbumsController {
  constructor(private readonly gallery: GalleryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AlbumListDto })
  list() { return this.gallery.albums(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AlbumDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.gallery.album(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: AlbumDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(albumSchema)) body: AlbumInput) { return this.gallery.createAlbum(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: AlbumDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(albumSchema)) body: AlbumInput) { return this.gallery.updateAlbum(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AlbumDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.gallery.removeAlbum(req.user.id, id); }
}

@ApiTags('admin-gallery-items')
@ApiBearerAuth()
@Controller('admin/gallery-items')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminGalleryItemsController {
  constructor(private readonly gallery: GalleryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'albumId', required: false, type: String })
  @ApiOkResponse({ type: GalleryItemListDto })
  list(@Query(new SchemaPipe(itemsQuerySchema)) query: ItemsQuery) { return this.gallery.items(query); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: GalleryItemDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.gallery.item(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: GalleryItemDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(galleryItemSchema)) body: GalleryItemInput) { return this.gallery.createItem(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: GalleryItemDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(galleryItemSchema)) body: GalleryItemInput) { return this.gallery.updateItem(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: GalleryItemDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.gallery.removeItem(req.user.id, id); }
}

@ApiTags('public-albums')
@Controller('public/albums')
export class PublicAlbumsController {
  constructor(private readonly gallery: GalleryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicAlbumListDto })
  list() { return this.gallery.publics(); }
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicAlbumDto })
  detail(@Param('slug', new SchemaPipe(slug)) value: string) { return this.gallery.public(value); }
}

@Module({ imports: [AuthModule], controllers: [AdminGalleryAlbumsController, AdminGalleryItemsController, PublicAlbumsController], providers: [GalleryRepository, GalleryService], exports: [GalleryService] })
export class GalleryModule {}
