import { Body, ConflictException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, AuthRequest, Roles } from '../auth/guards';
import { InstructorInput, instructorSchema, SchemaPipe, slug } from '../common/validation';
import { assertCustomPathFree, syncCustomPathRedirect } from '../common/paths';
import { Database } from '../infrastructure/infrastructure.module';

// Phase 1 caching choice: no Redis versioned cache (catalog pattern deferred to
// phase 2). All endpoints below send `Cache-Control: no-store` explicitly, and
// src/security/runtime.ts also forces no-store for these public paths.

const idSchema = z.string().min(1).max(100);
const instructorSelect = {
  id: true, slug: true, name: true, bio: true, image: true, status: true,
  customPath: true,
  createdAt: true, updatedAt: true, deletedAt: true,
} satisfies Prisma.InstructorSelect;
type InstructorRow = Prisma.InstructorGetPayload<{ select: typeof instructorSelect }>;
function datesDto(row: InstructorRow) {
  return { createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null };
}
function instructorDto(row: InstructorRow) {
  return { id: row.id, slug: row.slug, name: row.name, bio: row.bio, image: row.image, status: row.status, customPath: row.customPath ?? null, ...datesDto(row) };
}
function publicInstructorDto(row: InstructorRow) {
  return { id: row.id, slug: row.slug, name: row.name, bio: row.bio, image: row.image, customPath: row.customPath ?? null, updatedAt: row.updatedAt.toISOString() };
}
const instructorPath = (value: string) => `/instructors/${value}`;

@Injectable()
export class InstructorsRepository {
  constructor(private readonly db: Database) {}
  admins() { return this.db.instructor.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: instructorSelect }); }
  publics(now: Date) {
    void now;
    return this.db.instructor.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, orderBy: { id: 'asc' }, select: instructorSelect });
  }
  async admin(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.instructor.findFirst({ where: { id, deletedAt: null }, select: instructorSelect });
    if (!row) throw new NotFoundException('Instructor not found');
    return row;
  }
  async public(slugValue: string, now: Date, tx: Prisma.TransactionClient = this.db) {
    void now;
    return tx.instructor.findFirst({ where: { slug: slugValue, status: 'PUBLISHED', deletedAt: null }, select: instructorSelect });
  }
  private async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try { return await this.db.serial(operation); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('Instructor slug is reserved');
        if (error.code === 'P2025') throw new NotFoundException();
      }
      throw error;
    }
  }
  private async changed(tx: Prisma.TransactionClient, actorId: string, entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', row: InstructorRow, paths: Set<string>) {
    // No PII beyond IDs/titles: instructor bio/image are content, never logged.
    await tx.auditLog.create({ data: { actorId, entityType: 'Instructor', entityId, action, metadata: { slug: row.slug, status: row.status } } });
    const revision = await tx.contentRevision.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
    const allPaths = [...new Set(['/', '/instructors', ...paths])];
    for (let i = 0; i < allPaths.length; i += 100) await tx.revalidationOutbox.create({ data: { version: revision.version, paths: allPaths.slice(i, i + 100) } });
  }
  create(actorId: string, input: InstructorInput) {
    return this.mutate(async (tx) => {
      // Course assignment stays in the courses module; instructors are standalone here.
      const custom = input.customPath ?? null;
      if (custom) await assertCustomPathFree(tx, { owner: 'instructor', id: null }, custom);
      const row = await tx.instructor.create({
        data: { slug: input.slug, name: input.name, bio: input.bio, image: input.image ?? null, status: input.status, customPath: custom },
        select: instructorSelect,
      });
      const paths = new Set([instructorPath(row.slug)]);
      if (custom) paths.add(`/${custom}`);
      await this.changed(tx, actorId, row.id, 'CREATE', row, paths);
      return row;
    });
  }
  update(actorId: string, id: string, input: InstructorInput) {
    return this.mutate(async (tx) => {
      const old = await this.admin(id, tx);
      const custom = input.customPath ?? null;
      const paths = new Set([instructorPath(old.slug)]);
      if (custom !== (old.customPath ?? null)) {
        if (custom) await assertCustomPathFree(tx, { owner: 'instructor', id }, custom);
        for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, custom)) paths.add(p);
      } else if (custom) paths.add(`/${custom}`);
      const row = await tx.instructor.update({
        where: { id },
        data: { slug: input.slug, name: input.name, bio: input.bio, image: input.image ?? null, status: input.status, customPath: custom },
        select: instructorSelect,
      });
      paths.add(instructorPath(row.slug));
      await this.changed(tx, actorId, id, 'UPDATE', row, paths);
      return row;
    });
  }
  remove(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.admin(id, tx);
      const row = await tx.instructor.update({ where: { id }, data: { deletedAt: new Date() }, select: instructorSelect });
      const paths = new Set([instructorPath(old.slug)]);
      for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, null)) paths.add(p);
      await this.changed(tx, actorId, id, 'DELETE', row, paths);
      return row;
    });
  }
}

@Injectable()
export class InstructorsService {
  constructor(private readonly repo: InstructorsRepository) {}
  async admins() { return { items: (await this.repo.admins()).map(instructorDto) }; }
  async admin(id: string) { return instructorDto(await this.repo.admin(id)); }
  async create(actorId: string, input: InstructorInput) { return instructorDto(await this.repo.create(actorId, input)); }
  async update(actorId: string, id: string, input: InstructorInput) { return instructorDto(await this.repo.update(actorId, id, input)); }
  async remove(actorId: string, id: string) { return instructorDto(await this.repo.remove(actorId, id)); }
  async publics() { return { items: (await this.repo.publics(new Date())).map(publicInstructorDto) }; }
  async public(slugValue: string) {
    const row = await this.repo.public(slugValue, new Date());
    if (!row) throw new NotFoundException('Instructor not found');
    return publicInstructorDto(row);
  }
}

class InstructorDto {
  id!: string;
  slug!: string;
  name!: string;
  bio!: string;
  image!: string | null;
  status!: string;
  customPath!: string | null;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class InstructorListDto {
  items!: InstructorDto[];
}
class PublicInstructorDto {
  id!: string;
  slug!: string;
  name!: string;
  bio!: string;
  image!: string | null;
  customPath!: string | null;
  updatedAt!: string;
}
class PublicInstructorListDto {
  items!: PublicInstructorDto[];
}

@ApiTags('admin-instructors')
@ApiBearerAuth()
@Controller('admin/instructors')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminInstructorsController {
  constructor(private readonly instructors: InstructorsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: InstructorListDto })
  list() { return this.instructors.admins(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: InstructorDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.instructors.admin(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: InstructorDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(instructorSchema)) body: InstructorInput) { return this.instructors.create(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: InstructorDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(instructorSchema)) body: InstructorInput) { return this.instructors.update(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: InstructorDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.instructors.remove(req.user.id, id); }
}

@ApiTags('public-instructors')
@Controller('public/instructors')
export class PublicInstructorsController {
  constructor(private readonly instructors: InstructorsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicInstructorListDto })
  list() { return this.instructors.publics(); }
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PublicInstructorDto })
  detail(@Param('slug', new SchemaPipe(slug)) value: string) { return this.instructors.public(value); }
}

@Module({ imports: [AuthModule], controllers: [AdminInstructorsController, PublicInstructorsController], providers: [InstructorsRepository, InstructorsService], exports: [InstructorsService] })
export class InstructorsModule {}
