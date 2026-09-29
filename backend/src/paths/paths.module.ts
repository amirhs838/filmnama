import { Controller, Get, Header, Injectable, Module, NotFoundException, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SchemaPipe } from '../common/validation';
import { customPathSchema, normalizeCustomPath } from '../common/paths';
import { Database } from '../infrastructure/infrastructure.module';

// Resolves an editor-defined custom path (no leading slash, e.g.
// "training-courses/فن-بیان") to the owning published entity so the frontend
// catch-all route can render it. Only PUBLISHED + non-deleted rows resolve;
// anything else (including DRAFT custom paths) is a 404.
const resolveQuerySchema = z.object({ path: z.string().min(1).max(250) }).strict();

class PathResolutionDto {
  kind!: 'course' | 'post' | 'instructor' | 'work';
  department!: string | null;
  slug!: string;
}

@Injectable()
export class PathsService {
  constructor(private readonly db: Database) {}
  async resolve(raw: string) {
    const normalized = normalizeCustomPath(raw);
    if (!normalized || !customPathSchema.safeParse(normalized).success) throw new NotFoundException('Path not found');
    const now = new Date();
    const course = await this.db.course.findFirst({
      where: {
        customPath: normalized, status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now },
        department: { status: 'PUBLISHED', deletedAt: null },
      },
      select: { slug: true, department: { select: { slug: true } } },
    });
    if (course) return { kind: 'course', department: course.department.slug, slug: course.slug } as const;
    const post = await this.db.post.findFirst({
      where: { customPath: normalized, status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now } },
      select: { slug: true },
    });
    if (post) return { kind: 'post', department: null, slug: post.slug } as const;
    const instructor = await this.db.instructor.findFirst({
      where: { customPath: normalized, status: 'PUBLISHED', deletedAt: null },
      select: { slug: true },
    });
    if (instructor) return { kind: 'instructor', department: null, slug: instructor.slug } as const;
    const work = await this.db.portfolioItem.findFirst({
      where: { customPath: normalized, status: 'PUBLISHED', deletedAt: null },
      select: { slug: true },
    });
    if (work) return { kind: 'work', department: null, slug: work.slug } as const;
    throw new NotFoundException('Path not found');
  }
}

@ApiTags('public-paths')
@Controller('public/paths')
export class PublicPathsController {
  constructor(private readonly paths: PathsService) {}
  @Get('resolve')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'path', type: String, description: 'Custom path without leading slash' })
  @ApiOkResponse({ type: PathResolutionDto })
  resolve(@Query(new SchemaPipe(resolveQuerySchema)) query: { path: string }) {
    return this.paths.resolve(query.path);
  }
}

@Module({ controllers: [PublicPathsController], providers: [PathsService], exports: [PathsService] })
export class PathsModule {}
