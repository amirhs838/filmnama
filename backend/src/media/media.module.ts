import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Patch, PayloadTooLargeException, Post, Query, Req, Res, UseFilters, UseGuards, UseInterceptors, UploadedFile, Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import type { FileTypeResult } from 'file-type';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { memoryStorage, MulterError } from 'multer';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, AuthRequest, Roles } from '../auth/guards';
import { MediaInput, MediaListInput, assertSafeStorageKey, hash, mediaListSchema, MediaMetaInput, mediaMetaSchema, mediaSchema, SchemaPipe } from '../common/validation';
import { Config, resolveMediaDir } from '../infrastructure/config';
import { Database } from '../infrastructure/infrastructure.module';

// Binary upload is live: POST /api/v1/admin/media/upload accepts
// multipart/form-data (the sole JSON-only exemption in security/runtime.ts)
// and persists bytes under MEDIA_DIR. Metadata-only POST /admin/media stays
// strict JSON. Served bytes go through PublicMediaController below (guarded
// file resolution, immutable cache) — never express.static, so auth/origin
// guards stay in force for admin routes.

const idSchema = z.string().min(1).max(100);
const mediaSelect = {
  id: true, storageKey: true, mimeType: true, size: true, alt: true,
  createdAt: true, updatedAt: true, deletedAt: true,
} satisfies Prisma.MediaSelect;
type MediaRow = Prisma.MediaGetPayload<{ select: typeof mediaSelect }>;
const cursorSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), mime: z.string().nullable() }).strict();
function mediaDto(row: MediaRow) {
  return {
    id: row.id, storageKey: row.storageKey, mimeType: row.mimeType, size: row.size, alt: row.alt,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] as const;
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' };
export const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

export function coverMediaUrl(id: string): string {
  return `/api/v1/public/media/${id}/file`;
}

/** Blob-hosted storage keys are full https URLs; disk keys are relative. */
export function isRemoteStorageKey(storageKey: string): boolean {
  return storageKey.startsWith('https://');
}

export function toCoverMediaDto(media: { id: string; alt: string } | null | undefined) {
  if (!media) return null;
  return { id: media.id, url: coverMediaUrl(media.id), alt: media.alt };
}

export function getMediaDir(config: Config): string {
  const maybe = (config as unknown as { mediaDir?: unknown }).mediaDir;
  if (typeof maybe === 'string' && maybe.length) return maybe;
  const raw = (config as unknown as { value?: { MEDIA_DIR?: unknown } }).value?.MEDIA_DIR;
  return resolveMediaDir(typeof raw === 'string' && raw.length ? raw : 'uploads');
}

export function resolveMediaFile(mediaDir: string, storageKey: string): string {
  // Neutralize traversal: only the basename ever touches the filesystem, and
  // the resolved path must stay inside MEDIA_DIR.
  const base = basename(storageKey);
  const resolved = join(mediaDir, base);
  return resolved;
}

async function sniffFile(buffer: Buffer): Promise<FileTypeResult | undefined> {
  // file-type v21+ is ESM-only ("type": "module", import-only exports), while
  // this backend compiles to CommonJS. A static `import ... from 'file-type'`
  // would emit require() and crash at runtime (ERR_PACKAGE_PATH_NOT_EXPORTED).
  // Use a native dynamic import hidden from tsc's CJS transform instead.
  const loader = Function('return import("file-type")') as () => Promise<{ fileTypeFromBuffer: (input: Uint8Array) => Promise<FileTypeResult | undefined> }>;
  const mod = await loader();
  return mod.fileTypeFromBuffer(buffer).catch(() => undefined);
}

function parseAlt(body: unknown): string {
  if (body === undefined || body === null) return '';
  const record = body as Record<string, unknown>;
  const alt = record['alt'];
  if (alt === undefined) return '';
  if (typeof alt !== 'string') throw new BadRequestException('Invalid request');
  if (alt.length > 500) throw new BadRequestException('Invalid request');
  return alt;
}

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ statusCode: 413, message: 'File is too large' });
      return;
    }
    res.status(400).json({ statusCode: 400, message: 'Invalid file' });
  }
}

@Injectable()
export class MediaRepository {
  constructor(private readonly db: Database) {}
  async list(query: MediaListInput) {
    let id: string | undefined;
    if (query.cursor !== undefined) {
      try {
        const bytes = Buffer.from(query.cursor, 'base64url');
        if (bytes.toString('base64url') !== query.cursor) throw new Error();
        const cursor = cursorSchema.parse(JSON.parse(bytes.toString('utf8')));
        if (cursor.mime !== (query.mime ?? null)) throw new Error();
        id = cursor.id;
      } catch { throw new BadRequestException('Invalid cursor'); }
    }
    const rows = await this.db.media.findMany({
      where: { deletedAt: null, ...(query.mime ? { mimeType: query.mime } : {}), ...(id ? { id: { gt: id } } : {}) },
      orderBy: { id: 'asc' }, take: query.limit + 1, select: mediaSelect,
    });
    const items = rows.slice(0, query.limit).map(mediaDto);
    const nextCursor = rows.length > query.limit && items.length
      ? Buffer.from(JSON.stringify({ id: items[items.length - 1]!.id, mime: query.mime ?? null })).toString('base64url')
      : null;
    return { items, nextCursor };
  }
  async detail(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.media.findFirst({ where: { id, deletedAt: null }, select: mediaSelect });
    if (!row) throw new NotFoundException('Media not found');
    return row;
  }
  private async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try { return await this.db.serial(operation); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('Media storage key is reserved');
        if (error.code === 'P2025') throw new NotFoundException();
      }
      throw error;
    }
  }
  private async changed(tx: Prisma.TransactionClient, actorId: string, entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', row: MediaRow) {
    // Alt text is content, never logged; only storage identifiers are audited.
    await tx.auditLog.create({ data: { actorId, entityType: 'Media', entityId, action, metadata: { storageKey: row.storageKey, mimeType: row.mimeType } } });
    const revision = await tx.contentRevision.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
    const allPaths = ['/', '/gallery', '/works'];
    for (let i = 0; i < allPaths.length; i += 100) await tx.revalidationOutbox.create({ data: { version: revision.version, paths: allPaths.slice(i, i + 100) } });
  }
  create(actorId: string, input: MediaInput) {
    try { assertSafeStorageKey(input.storageKey); }
    catch { throw new BadRequestException('Invalid request'); }
    return this.mutate(async (tx) => {
      const row = await tx.media.create({
        data: { storageKey: input.storageKey, mimeType: input.mimeType, size: input.size, alt: input.alt },
        select: mediaSelect,
      });
      await this.changed(tx, actorId, row.id, 'CREATE', row);
      return row;
    });
  }
  updateAlt(actorId: string, id: string, input: MediaMetaInput) {
    return this.mutate(async (tx) => {
      await this.detail(id, tx);
      const row = await tx.media.update({ where: { id }, data: { alt: input.alt }, select: mediaSelect });
      await this.changed(tx, actorId, id, 'UPDATE', row);
      return row;
    });
  }
  remove(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      await this.detail(id, tx);
      // Orphan guard: refuse soft-delete while gallery/portfolio rows reference
      // this media, or while any live Post/Course uses it as coverMedia.
      // Generic message on purpose (no reference details leaked).
      const galleryRefs = await tx.galleryItem.count({ where: { mediaId: id, deletedAt: null } });
      const workRefs = await tx.portfolioItem.count({ where: { mediaId: id, deletedAt: null } });
      if (galleryRefs > 0 || workRefs > 0) throw new ConflictException('Media is still referenced');
      const postRefs = typeof (tx as unknown as { post?: { count: (args: unknown) => Promise<number> } }).post?.count === 'function'
        ? await (tx as unknown as { post: { count: (args: unknown) => Promise<number> } }).post.count({ where: { coverMediaId: id, deletedAt: null } })
        : 0;
      if (postRefs > 0) throw new ConflictException('Media is still referenced');
      const courseRefs = typeof (tx as unknown as { course?: { count: (args: unknown) => Promise<number> } }).course?.count === 'function'
        ? await (tx as unknown as { course: { count: (args: unknown) => Promise<number> } }).course.count({ where: { coverMediaId: id, deletedAt: null } })
        : 0;
      if (courseRefs > 0) throw new ConflictException('Media is still referenced');
      const albumRefs = typeof (tx as unknown as { galleryAlbum?: { count: (args: unknown) => Promise<number> } }).galleryAlbum?.count === 'function'
        ? await (tx as unknown as { galleryAlbum: { count: (args: unknown) => Promise<number> } }).galleryAlbum.count({ where: { coverMediaId: id, deletedAt: null } })
        : 0;
      if (albumRefs > 0) throw new ConflictException('Media is still referenced');
      const row = await tx.media.update({ where: { id }, data: { deletedAt: new Date() }, select: mediaSelect });
      await this.changed(tx, actorId, id, 'DELETE', row);
      return row;
    });
  }
}

@Injectable()
export class MediaService {
  constructor(private readonly repo: MediaRepository, private readonly db?: Database, private readonly config?: Config) {}
  async list(query: MediaListInput) { return this.repo.list(query); }
  async detail(id: string) { return mediaDto(await this.repo.detail(id)); }
  async create(actorId: string, input: MediaInput) { return mediaDto(await this.repo.create(actorId, input)); }
  async updateAlt(actorId: string, id: string, input: MediaMetaInput) { return mediaDto(await this.repo.updateAlt(actorId, id, input)); }
  async remove(actorId: string, id: string) { return mediaDto(await this.repo.remove(actorId, id)); }
  /**
   * Blob auth when the backend runs on Vercel: a static token when
   * BLOB_READ_WRITE_TOKEN is set, otherwise the connected store's OIDC
   * identity (BLOB_STORE_ID is injected by `vercel storage connect`).
   * Absent both → local disk (unchanged legacy behavior).
   */
  private blobAuth(): { token?: string } | null {
    const token = this.config?.value.BLOB_READ_WRITE_TOKEN;
    if (typeof token === 'string' && token.length > 0) return { token };
    if (typeof process.env.BLOB_STORE_ID === 'string' && process.env.BLOB_STORE_ID.length > 0) return {};
    return null;
  }
  async upload(actorId: string, file: { buffer: Buffer } | undefined, body: unknown) {
    if (!this.config) throw new BadRequestException('Invalid file');
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) throw new BadRequestException('Invalid file');
    const alt = parseAlt(body);
    if (file.buffer.length > UPLOAD_MAX_BYTES) throw new PayloadTooLargeException('File is too large');
    const sniffed = await sniffFile(file.buffer);
    const mime = sniffed?.mime;
    if (!mime || !(UPLOAD_MIME_TYPES as readonly string[]).includes(mime)) throw new BadRequestException('Invalid file');
    const ext = EXT_BY_MIME[mime] ?? sniffed?.ext;
    if (!ext || !/^[a-z0-9]{2,5}$/.test(ext)) throw new BadRequestException('Invalid file');
    const filename = `${randomUUID().replace(/-/g, '')}.${ext}`;
    const blobAuth = this.blobAuth();
    if (blobAuth) {
      const { put } = await import('@vercel/blob');
      const blob = await put(`filmnama/${filename}`, file.buffer, {
        access: 'public', contentType: mime, addRandomSuffix: false, ...blobAuth,
      }).catch(() => { throw new BadRequestException('Invalid file'); });
      try {
        return mediaDto(await this.repo.create(actorId, { storageKey: blob.url, mimeType: mime as MediaInput['mimeType'], size: file.buffer.length, alt }));
      } catch (error) {
        const { del } = await import('@vercel/blob');
        await del(blob.url, { ...blobAuth }).catch(() => undefined);
        throw error;
      }
    }
    const mediaDir = getMediaDir(this.config);
    await mkdir(mediaDir, { recursive: true });
    const storageKey = `uploads/${filename}`;
    try { assertSafeStorageKey(storageKey); }
    catch { throw new BadRequestException('Invalid file'); }
    await writeFile(join(mediaDir, filename), file.buffer);
    try {
      const row = await this.repo.create(actorId, { storageKey, mimeType: mime as MediaInput['mimeType'], size: file.buffer.length, alt });
      return mediaDto(row);
    } catch (error) {
      await unlink(join(mediaDir, filename)).catch(() => undefined);
      throw error;
    }
  }
  async filePath(id: string): Promise<{ row: MediaRow; absolute: string }> {
    if (!this.config) throw new NotFoundException('Media not found');
    const row = await this.repo.detail(id);
    if (isRemoteStorageKey(row.storageKey)) throw new NotFoundException('Media not found');
    const mediaDir = getMediaDir(this.config);
    const absolute = resolveMediaFile(mediaDir, row.storageKey);
    try {
      const info = await stat(absolute);
      if (!info.isFile()) throw new Error();
    } catch { throw new NotFoundException('Media not found'); }
    return { row, absolute };
  }
  remoteUrl(id: string): Promise<string> {
    return this.repo.detail(id).then((row) => {
      if (!isRemoteStorageKey(row.storageKey)) throw new NotFoundException('Media not found');
      return row.storageKey;
    });
  }
}

class MediaDto {
  id!: string;
  storageKey!: string;
  mimeType!: string;
  size!: number;
  alt!: string;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class MediaPageDto {
  items!: MediaDto[];
  nextCursor!: string | null;
}

@ApiTags('admin-media')
@ApiBearerAuth()
@Controller('admin/media')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'mime', required: false, enum: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque id keyset cursor bound to mime filter' })
  @ApiOkResponse({ type: MediaPageDto })
  list(@Query(new SchemaPipe(mediaListSchema)) query: MediaListInput) { return this.media.list(query); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MediaDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.media.detail(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object, description: 'Metadata record only: no file bytes accepted, storage backend deferred' })
  @ApiOkResponse({ type: MediaDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(mediaSchema)) body: MediaInput) { return this.media.create(req.user.id, body); }
  @Post('upload')
  @Header('Cache-Control', 'no-store')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Binary upload; magic bytes verified, covers must be images only on use', schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, alt: { type: 'string', maxLength: 500 } }, required: ['file'] } })
  @ApiOkResponse({ type: MediaDto })
  upload(@Req() req: AuthRequest, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: unknown) { return this.media.upload(req.user.id, file, body); }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object, description: 'Alt text only' })
  @ApiOkResponse({ type: MediaDto })
  updateAlt(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(mediaMetaSchema)) body: MediaMetaInput) { return this.media.updateAlt(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: MediaDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.media.remove(req.user.id, id); }
}

@ApiTags('public-media')
@Controller('public/media')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}
  @Get(':id/file')
  async file(@Param('id', new SchemaPipe(idSchema)) id: string, @Res() res: Response) {
    // Blob-hosted bytes (serverless deployments) redirect to the public Blob
    // URL; disk-hosted bytes stream as before.
    const remote = await this.media.remoteUrl(id).catch(() => null);
    if (remote) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.redirect(307, remote);
      return;
    }
    const { row, absolute } = await this.media.filePath(id);
    // Immutable cache is intentional for content-addressed uploads
    // (<cuid>.<ext> never changes bytes). Do NOT add no-store here.
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${hash(`${row.id}:${row.size}`)}"`);
    createReadStream(absolute).on('error', () => {
      if (!res.headersSent) res.status(404).json({ statusCode: 404, message: 'Media not found' });
      else res.end();
    }).pipe(res);
  }
}

@Module({ imports: [AuthModule], controllers: [AdminMediaController, PublicMediaController], providers: [MediaRepository, MediaService], exports: [MediaService] })
export class MediaModule {}
