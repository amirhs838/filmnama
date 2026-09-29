import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, AuthRequest, Roles } from '../auth/guards';
import { PortfolioInput, portfolioListSchema, PortfolioListInput, portfolioSchema, SchemaPipe, slug } from '../common/validation';
import { assertCustomPathFree, syncCustomPathRedirect } from '../common/paths';
import { Database } from '../infrastructure/infrastructure.module';

// Phase 3 caching choice: same as instructors/blog (no Redis versioned cache).
// All endpoints send `Cache-Control: no-store` explicitly, and
// src/security/runtime.ts also forces no-store for these public paths.

const idSchema = z.string().min(1).max(100);
const portfolioSelect = {
  id: true, slug: true, title: true, student: true, category: true, mediaId: true, contentHtml: true,
  status: true, seoTitle: true, seoDescription: true, canonicalUrl: true, noindex: true, customPath: true,
  createdAt: true, updatedAt: true, deletedAt: true,
  media: { select: { storageKey: true, mimeType: true, alt: true } },
} satisfies Prisma.PortfolioItemSelect;
type PortfolioRow = Prisma.PortfolioItemGetPayload<{ select: typeof portfolioSelect }>;
function seoDto(row: PortfolioRow) {
  return { title: row.seoTitle, description: row.seoDescription, canonicalUrl: row.canonicalUrl, noindex: row.noindex };
}
function mediaDto(row: PortfolioRow) {
  return row.media ? { storageKey: row.media.storageKey, mimeType: row.media.mimeType, alt: row.media.alt } : null;
}
function portfolioDto(row: PortfolioRow) {
  return {
    id: row.id, slug: row.slug, title: row.title, student: row.student, category: row.category,
    mediaId: row.mediaId, contentHtml: row.contentHtml, status: row.status, seo: seoDto(row),
    customPath: row.customPath ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
function publicPortfolioDto(row: PortfolioRow) {
  return {
    id: row.id, slug: row.slug, title: row.title, student: row.student, category: row.category,
    mediaId: row.mediaId, media: mediaDto(row), contentHtml: row.contentHtml, seo: seoDto(row),
    customPath: row.customPath ?? null, updatedAt: row.updatedAt.toISOString(),
  };
}
function seoData(seo: PortfolioInput['seo']) {
  return { seoTitle: seo?.title ?? null, seoDescription: seo?.description ?? null, canonicalUrl: seo?.canonicalUrl ?? null, noindex: seo?.noindex ?? false };
}
const workPath = (value: string) => `/works/${value}`;

@Injectable()
export class PortfolioRepository {
  constructor(private readonly db: Database) {}
  items() { return this.db.portfolioItem.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: portfolioSelect }); }
  async item(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.portfolioItem.findFirst({ where: { id, deletedAt: null }, select: portfolioSelect });
    if (!row) throw new NotFoundException('Work not found');
    return row;
  }
  publics(query: PortfolioListInput) {
    return this.db.portfolioItem.findMany({
      where: { status: 'PUBLISHED', deletedAt: null, ...(query.category ? { category: query.category } : {}) },
      orderBy: { id: 'asc' }, select: portfolioSelect,
    });
  }
  public(slugValue: string) {
    return this.db.portfolioItem.findFirst({ where: { slug: slugValue, status: 'PUBLISHED', deletedAt: null }, select: portfolioSelect });
  }
  private async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try { return await this.db.serial(operation); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('Work slug is reserved');
        if (error.code === 'P2025') throw new NotFoundException();
      }
      throw error;
    }
  }
  private async changed(tx: Prisma.TransactionClient, actorId: string, entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', row: PortfolioRow, paths: Set<string>) {
    // No PII beyond slugs/ids: student names and content are never logged.
    await tx.auditLog.create({ data: { actorId, entityType: 'PortfolioItem', entityId, action, metadata: { slug: row.slug, category: row.category, status: row.status } } });
    const revision = await tx.contentRevision.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
    const allPaths = [...new Set(['/', '/works', ...paths])];
    for (let i = 0; i < allPaths.length; i += 100) await tx.revalidationOutbox.create({ data: { version: revision.version, paths: allPaths.slice(i, i + 100) } });
  }
  private async mediaGuard(tx: Prisma.TransactionClient, mediaId: string | null) {
    if (mediaId && !await tx.media.findFirst({ where: { id: mediaId, deletedAt: null }, select: { id: true } })) throw new BadRequestException('Media not found');
  }
  create(actorId: string, input: PortfolioInput) {
    return this.mutate(async (tx) => {
      await this.mediaGuard(tx, input.mediaId);
      const custom = input.customPath ?? null;
      if (custom) await assertCustomPathFree(tx, { owner: 'portfolioItem', id: null }, custom);
      const row = await tx.portfolioItem.create({
        data: {
          slug: input.slug, title: input.title, student: input.student, category: input.category,
          ...(input.mediaId ? { media: { connect: { id: input.mediaId } } } : {}),
          contentHtml: input.contentHtml, status: input.status, ...seoData(input.seo), customPath: custom,
        },
        select: portfolioSelect,
      });
      const paths = new Set([workPath(row.slug)]);
      if (custom) paths.add(`/${custom}`);
      await this.changed(tx, actorId, row.id, 'CREATE', row, paths);
      return row;
    });
  }
  update(actorId: string, id: string, input: PortfolioInput) {
    return this.mutate(async (tx) => {
      const old = await this.item(id, tx);
      await this.mediaGuard(tx, input.mediaId);
      const custom = input.customPath ?? null;
      const paths = new Set([workPath(old.slug)]);
      if (custom !== (old.customPath ?? null)) {
        if (custom) await assertCustomPathFree(tx, { owner: 'portfolioItem', id }, custom);
        for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, custom)) paths.add(p);
      } else if (custom) paths.add(`/${custom}`);
      const row = await tx.portfolioItem.update({
        where: { id },
        data: {
          slug: input.slug, title: input.title, student: input.student, category: input.category,
          media: input.mediaId ? { connect: { id: input.mediaId } } : { disconnect: true },
          contentHtml: input.contentHtml, status: input.status, ...seoData(input.seo), customPath: custom,
        },
        select: portfolioSelect,
      });
      paths.add(workPath(row.slug));
      await this.changed(tx, actorId, id, 'UPDATE', row, paths);
      return row;
    });
  }
  remove(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.item(id, tx);
      const row = await tx.portfolioItem.update({ where: { id }, data: { deletedAt: new Date() }, select: portfolioSelect });
      const paths = new Set([workPath(old.slug)]);
      for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, null)) paths.add(p);
      await this.changed(tx, actorId, id, 'DELETE', row, paths);
      return row;
    });
  }
}

@Injectable()
export class PortfolioService {
  constructor(private readonly repo: PortfolioRepository) {}
  async items() { return { items: (await this.repo.items()).map(portfolioDto) }; }
  async item(id: string) { return portfolioDto(await this.repo.item(id)); }
  async create(actorId: string, input: PortfolioInput) { return portfolioDto(await this.repo.create(actorId, input)); }
  async update(actorId: string, id: string, input: PortfolioInput) { return portfolioDto(await this.repo.update(actorId, id, input)); }
  async remove(actorId: string, id: string) { return portfolioDto(await this.repo.remove(actorId, id)); }
  async publics(query: PortfolioListInput) { return { items: (await this.repo.publics(query)).map(publicPortfolioDto) }; }
  async public(slugValue: string) {
    const row = await this.repo.public(slugValue);
    if (!row) throw new NotFoundException('Work not found');
    return publicPortfolioDto(row);
  }
}

class PortfolioItemDto {
  id!: string;
  slug!: string;
  title!: string;
  student!: string;
  category!: string;
  mediaId!: string | null;
  contentHtml!: string;
  status!: string;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class PortfolioItemListDto {
  items!: PortfolioItemDto[];
}
class PublicWorkDto {
  id!: string;
  slug!: string;
  title!: string;
  student!: string;
  category!: string;
  mediaId!: string | null;
  contentHtml!: string;
  updatedAt!: string;
}
class PublicWorkListDto {
  items!: PublicWorkDto[];
}

@ApiTags('admin-works')
@ApiBearerAuth()
@Controller('admin/works')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminWorksController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PortfolioItemListDto })
  list() { return this.portfolio.items(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PortfolioItemDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.portfolio.item(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: PortfolioItemDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(portfolioSchema)) body: PortfolioInput) { return this.portfolio.create(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: PortfolioItemDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(portfolioSchema)) body: PortfolioInput) { return this.portfolio.update(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PortfolioItemDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.portfolio.remove(req.user.id, id); }
}

@ApiTags('public-works')
@Controller('public/works')
export class PublicWorksController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiOkResponse({ type: PublicWorkListDto })
  list(@Query(new SchemaPipe(portfolioListSchema)) query: PortfolioListInput) { return this.portfolio.publics(query); }
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicWorkDto })
  detail(@Param('slug', new SchemaPipe(slug)) value: string) { return this.portfolio.public(value); }
}

@Module({ imports: [AuthModule], controllers: [AdminWorksController, PublicWorksController], providers: [PortfolioRepository, PortfolioService], exports: [PortfolioService] })
export class PortfolioModule {}
