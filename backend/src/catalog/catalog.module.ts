import { BadRequestException, Controller, Get, Injectable, Module, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { z } from 'zod';
import { hash, ListInput, listSchema, localPath, SchemaPipe, slug } from '../common/validation';
import { Database, RedisStore } from '../infrastructure/infrastructure.module';

const departmentSelect = { id: true, slug: true, label: true, latin: true, description: true, updatedAt: true } satisfies Prisma.DepartmentSelect;
const courseSelect = {
  id: true, slug: true, title: true, latin: true, description: true, level: true, duration: true, iconKey: true,
  contentHtml: true, syllabus: true, seoTitle: true, seoDescription: true, canonicalUrl: true, noindex: true, updatedAt: true, publishedAt: true,
  customPath: true,
  department: { select: { slug: true } },
  faq: { orderBy: { position: 'asc' }, select: { question: true, answer: true } },
  instructors: { where: { instructor: { status: 'PUBLISHED', deletedAt: null } }, orderBy: [{ position: 'asc' }, { instructorId: 'asc' }], select: { instructor: { select: { id: true, slug: true, name: true, bio: true, image: true } } } },
  coverMedia: { select: { id: true, alt: true, deletedAt: true } },
} satisfies Prisma.CourseSelect;
type DepartmentRow = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>;
type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;
const published = (now: Date) => ({ status: 'PUBLISHED' as const, deletedAt: null, publishedAt: { lte: now } });
const cursorSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), department: slug.nullable() }).strict();
const redirectSchema = z.object({ path: localPath }).strict();

function departmentDto(row: DepartmentRow) {
  return { id: row.id, slug: row.slug, label: row.label, latin: row.latin, description: row.description, updatedAt: row.updatedAt.toISOString() };
}
function courseDto(row: CourseRow) {
  const cover = (row as unknown as { coverMedia?: { id: string; alt: string; deletedAt: Date | null } | null }).coverMedia;
  return {
    id: row.id, slug: row.slug, title: row.title, latin: row.latin, department: row.department.slug, description: row.description,
    level: row.level, duration: row.duration, iconKey: row.iconKey, contentHtml: row.contentHtml, syllabus: row.syllabus,
    customPath: row.customPath ?? null,
    coverMedia: !cover || cover.deletedAt ? null : { id: cover.id, url: `/api/v1/public/media/${cover.id}/file`, alt: cover.alt },
    faq: row.faq.map(({ question, answer }) => ({ question, answer })),
    instructors: row.instructors.map(({ instructor: i }) => ({ id: i.id, slug: i.slug, name: i.name, bio: i.bio, image: i.image })),
    seo: { title: row.seoTitle, description: row.seoDescription, canonicalUrl: row.canonicalUrl, noindex: row.noindex },
    updatedAt: row.updatedAt.toISOString(), publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class CatalogRepository {
  constructor(private readonly db: Database) {}
  departments(now: Date) { return this.db.department.findMany({ where: published(now), orderBy: { id: 'asc' }, select: departmentSelect }); }
  department(slug: string, now: Date) { return this.db.department.findFirst({ where: { ...published(now), slug }, select: departmentSelect }); }
  courses(query: ListInput, id: string | undefined, now: Date) {
    return this.db.course.findMany({ where: { ...published(now), ...(id ? { id: { gt: id } } : {}), department: { ...published(now), ...(query.department ? { slug: query.department } : {}) } }, orderBy: { id: 'asc' }, take: query.limit + 1, select: courseSelect });
  }
  course(department: string, slug: string, now: Date) {
    return this.db.course.findFirst({ where: { ...published(now), slug, department: { ...published(now), slug: department } }, select: courseSelect });
  }
  redirect(source: string) { return this.db.redirect.findUnique({ where: { source }, select: { destination: true } }); }
}

@Injectable()
export class CatalogCache {
  constructor(private readonly db: Database, private readonly redis: RedisStore) {}
  async read<T>(route: string, query: unknown, load: () => Promise<T>): Promise<T> {
    if (this.redis.disabled) return load();
    const revision = await this.db.contentRevision.findUnique({ where: { id: 1 }, select: { version: true } });
    if (!revision) return load();
    const key = `catalog:v1:${revision.version}:${hash(JSON.stringify([route, query]))}`;
    const cached = await this.redis.client.get(key).catch(() => null);
    if (cached !== null) {
      try { return JSON.parse(cached) as T; }
      catch { await this.redis.client.del(key).catch(() => undefined); }
    }
    const body = await load();
    await this.redis.client.set(key, JSON.stringify(body), 'EX', 30).catch(() => undefined);
    return body;
  }
}

@Injectable()
export class CatalogService {
  constructor(private readonly repo: CatalogRepository, private readonly cache: CatalogCache) {}
  async departments() { return this.cache.read('departments', null, async () => ({ items: (await this.repo.departments(new Date())).map(departmentDto) })); }
  async department(slug: string) {
    return this.cache.read('department', { slug }, async () => {
      const row = await this.repo.department(slug, new Date());
      if (!row) throw new NotFoundException();
      return departmentDto(row);
    });
  }
  async courses(query: ListInput) {
    let id: string | undefined;
    if (query.cursor !== undefined) {
      try {
        const bytes = Buffer.from(query.cursor, 'base64url');
        if (bytes.toString('base64url') !== query.cursor) throw new Error();
        const cursor = cursorSchema.parse(JSON.parse(bytes.toString('utf8')));
        if (cursor.department !== (query.department ?? null)) throw new Error();
        id = cursor.id;
      } catch { throw new BadRequestException('Invalid cursor'); }
    }
    return this.cache.read('courses', { department: query.department ?? null, limit: query.limit, id: id ?? null }, async () => {
      const rows = await this.repo.courses(query, id, new Date());
      const items = rows.slice(0, query.limit).map(courseDto);
      const nextCursor = rows.length > query.limit ? Buffer.from(JSON.stringify({ id: items[items.length - 1]!.id, department: query.department ?? null })).toString('base64url') : null;
      return { items, nextCursor };
    });
  }
  async course(department: string, slug: string) {
    return this.cache.read('course', { department, slug }, async () => {
      const row = await this.repo.course(department, slug, new Date());
      if (!row) throw new NotFoundException();
      return courseDto(row);
    });
  }
  async redirect(path: string) {
    const seen = new Set<string>();
    const now = new Date();
    let current = path;
    for (let hops = 0; hops <= 10; hops++) {
      if (!localPath.safeParse(current).success || seen.has(current)) return { destination: null };
      seen.add(current);
      const redirect = await this.repo.redirect(current);
      if (!redirect) {
        const [, , department, course] = current.split('/');
        const exists = department && (course ? await this.repo.course(department, course, now) : await this.repo.department(department, now));
        return { destination: hops > 0 && exists ? current : null };
      }
      if (hops === 10 || !redirect.destination) return { destination: null };
      current = redirect.destination;
    }
    return { destination: null };
  }
}

function respond<T>(res: Response, body: T): T {
  const dates: number[] = [];
  const json = JSON.stringify(body, (key, value) => { if (key === 'updatedAt' && typeof value === 'string' && Number.isFinite(Date.parse(value))) dates.push(Date.parse(value)); return value; });
  res.set({ 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: `"${hash(json)}"` });
  if (dates.length) res.set('Last-Modified', new Date(Math.max(...dates)).toUTCString());
  return body;
}

@Controller('public')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('departments')
  async departments(@Res({ passthrough: true }) res: Response) { return respond(res, await this.catalog.departments()); }
  @Get('departments/:slug')
  async department(@Param('slug', new SchemaPipe(slug)) value: string, @Res({ passthrough: true }) res: Response) { return respond(res, await this.catalog.department(value)); }
  @Get('courses')
  async courses(@Query(new SchemaPipe(listSchema)) query: ListInput, @Res({ passthrough: true }) res: Response) { return respond(res, await this.catalog.courses(query)); }
  @Get('courses/:department/:slug')
  async course(@Param('department', new SchemaPipe(slug)) department: string, @Param('slug', new SchemaPipe(slug)) value: string, @Res({ passthrough: true }) res: Response) { return respond(res, await this.catalog.course(department, value)); }
  @Get('redirects')
  async redirect(@Query(new SchemaPipe(redirectSchema)) query: z.infer<typeof redirectSchema>, @Res({ passthrough: true }) res: Response) { return respond(res, await this.catalog.redirect(query.path)); }
}

@Module({ controllers: [CatalogController], providers: [CatalogRepository, CatalogCache, CatalogService], exports: [CatalogService] })
export class CatalogModule {}
