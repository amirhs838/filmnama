import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, AuthRequest, Roles } from '../auth/guards';
import { CourseInput, courseSchema, DepartmentInput, departmentSchema, SchemaPipe } from '../common/validation';
import { assertCustomPathFree, syncCustomPathRedirect } from '../common/paths';
import { Database } from '../infrastructure/infrastructure.module';

const idSchema = z.string().min(1).max(100);
const departmentSelect = {
  id: true, slug: true, label: true, latin: true, description: true, status: true,
  seoTitle: true, seoDescription: true, canonicalUrl: true, noindex: true,
  publishedAt: true, createdAt: true, updatedAt: true, deletedAt: true,
} satisfies Prisma.DepartmentSelect;
const courseSelect = {
  id: true, slug: true, departmentId: true, title: true, latin: true, description: true,
  level: true, duration: true, iconKey: true, contentHtml: true, syllabus: true, status: true,
  coverMediaId: true, customPath: true,
  seoTitle: true, seoDescription: true, canonicalUrl: true, noindex: true,
  publishedAt: true, createdAt: true, updatedAt: true, deletedAt: true,
  department: { select: { slug: true } },
  faq: { orderBy: { position: 'asc' }, select: { question: true, answer: true } },
  instructors: { where: { instructor: { deletedAt: null } }, orderBy: [{ position: 'asc' }, { instructorId: 'asc' }], select: { instructorId: true } },
  coverMedia: { select: { id: true, alt: true, deletedAt: true } },
} satisfies Prisma.CourseSelect;
type DepartmentRow = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>;
type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;
function seoDto(row: DepartmentRow | CourseRow) {
  return { title: row.seoTitle, description: row.seoDescription, canonicalUrl: row.canonicalUrl, noindex: row.noindex };
}
function datesDto(row: DepartmentRow | CourseRow) {
  return { publishedAt: row.publishedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null };
}
function departmentDto(row: DepartmentRow) {
  return { id: row.id, slug: row.slug, label: row.label, latin: row.latin, description: row.description, status: row.status, seo: seoDto(row), ...datesDto(row) };
}
function courseDto(row: CourseRow) {
  const cover = (row as unknown as { coverMedia?: { id: string; alt: string; deletedAt: Date | null } | null }).coverMedia;
  return {
    id: row.id, slug: row.slug, departmentId: row.departmentId, title: row.title, latin: row.latin,
    description: row.description, level: row.level, duration: row.duration, iconKey: row.iconKey,
    contentHtml: row.contentHtml, syllabus: row.syllabus, status: row.status,
    coverMediaId: (row as unknown as { coverMediaId?: string | null }).coverMediaId ?? null,
    coverMedia: !cover || cover.deletedAt ? null : { id: cover.id, url: `/api/v1/public/media/${cover.id}/file`, alt: cover.alt },
    faq: row.faq.map(({ question, answer }) => ({ question, answer })),
    instructorIds: row.instructors.map(({ instructorId }) => instructorId), seo: seoDto(row),
    customPath: row.customPath ?? null, ...datesDto(row),
  };
}
function seoData(seo: DepartmentInput['seo']) {
  return { seoTitle: seo?.title ?? null, seoDescription: seo?.description ?? null, canonicalUrl: seo?.canonicalUrl ?? null, noindex: seo?.noindex ?? false };
}
const departmentPath = (slug: string) => `/courses/${slug}`;
const coursePath = (department: string, slug: string) => `${departmentPath(department)}/${slug}`;

@Injectable()
export class AdminCatalogRepository {
  constructor(private readonly db: Database) {}
  departments() { return this.db.department.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: departmentSelect }); }
  courses() { return this.db.course.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: courseSelect }); }
  async department(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.department.findFirst({ where: { id, deletedAt: null }, select: departmentSelect });
    if (!row) throw new NotFoundException('Department not found');
    return row;
  }
  async course(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.course.findFirst({ where: { id, deletedAt: null }, select: courseSelect });
    if (!row) throw new NotFoundException('Course not found');
    return row;
  }
  private async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try { return await this.db.serial(operation); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('Catalog path is reserved');
        if (error.code === 'P2025') throw new NotFoundException();
      }
      throw error;
    }
  }
  private async available(tx: Prisma.TransactionClient, path: string) {
    if (await tx.redirect.findUnique({ where: { source: path }, select: { id: true } })) throw new ConflictException('Catalog path is reserved');
  }
  private async redirect(tx: Prisma.TransactionClient, source: string, destination: string | null, paths: Set<string>) {
    const aliases = await tx.redirect.findMany({ where: { destination: source }, select: { source: true } });
    for (const alias of aliases) paths.add(alias.source);
    await tx.redirect.updateMany({ where: { destination: source }, data: { destination } });
    await tx.redirect.upsert({ where: { source }, create: { source, destination }, update: { destination } });
    paths.add(source);
    if (destination) paths.add(destination);
  }
  private async changed(tx: Prisma.TransactionClient, actorId: string, entityType: 'Department' | 'Course', entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', row: { slug: string; status: string; departmentId?: string }, paths: Set<string>) {
    const metadata = { slug: row.slug, status: row.status, ...(row.departmentId ? { departmentId: row.departmentId } : {}) };
    await tx.auditLog.create({ data: { actorId, entityType, entityId, action, metadata } });
    const revision = await tx.contentRevision.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
    const allPaths = [...new Set(['/', '/courses', ...paths])];
    for (let i = 0; i < allPaths.length; i += 100) await tx.revalidationOutbox.create({ data: { version: revision.version, paths: allPaths.slice(i, i + 100) } });
  }
  createDepartment(actorId: string, input: DepartmentInput) {
    return this.mutate(async (tx) => {
      const path = departmentPath(input.slug);
      await this.available(tx, path);
      const row = await tx.department.create({ data: {
        slug: input.slug, label: input.label, latin: input.latin, description: input.description,
        status: input.status, ...seoData(input.seo), publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      }, select: departmentSelect });
      await this.changed(tx, actorId, 'Department', row.id, 'CREATE', row, new Set([path]));
      return row;
    });
  }
  updateDepartment(actorId: string, id: string, input: DepartmentInput) {
    return this.mutate(async (tx) => {
      const old = await this.department(id, tx);
      const paths = new Set([departmentPath(old.slug), departmentPath(input.slug)]);
      const children = await tx.course.findMany({ where: { departmentId: id }, select: { slug: true } });
      if (old.slug !== input.slug) {
        await this.available(tx, departmentPath(input.slug));
        for (const child of children) await this.available(tx, coursePath(input.slug, child.slug));
        await this.redirect(tx, departmentPath(old.slug), departmentPath(input.slug), paths);
        for (const child of children) await this.redirect(tx, coursePath(old.slug, child.slug), coursePath(input.slug, child.slug), paths);
      }
      for (const child of children) {
        paths.add(coursePath(old.slug, child.slug));
        paths.add(coursePath(input.slug, child.slug));
      }
      const row = await tx.department.update({ where: { id }, data: {
        slug: input.slug, label: input.label, latin: input.latin, description: input.description,
        status: input.status, ...seoData(input.seo), publishedAt: old.publishedAt ?? (input.status === 'PUBLISHED' ? new Date() : null),
      }, select: departmentSelect });
      await this.changed(tx, actorId, 'Department', id, 'UPDATE', row, paths);
      return row;
    });
  }
  deleteDepartment(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.department(id, tx);
      if (await tx.course.count({ where: { departmentId: id, deletedAt: null } })) throw new ConflictException('Department has undeleted courses');
      const row = await tx.department.update({ where: { id }, data: { deletedAt: new Date() }, select: departmentSelect });
      const paths = new Set<string>();
      await this.redirect(tx, departmentPath(old.slug), null, paths);
      await this.changed(tx, actorId, 'Department', id, 'DELETE', row, paths);
      return row;
    });
  }
  private async courseRelations(tx: Prisma.TransactionClient, input: CourseInput) {
    const department = await this.department(input.departmentId, tx);
    const instructors = await tx.instructor.findMany({ where: { id: { in: input.instructorIds }, deletedAt: null }, select: { id: true } });
    const ids = new Set(instructors.map(({ id }) => id));
    if (input.instructorIds.some((id) => !ids.has(id))) throw new BadRequestException('Instructor not found');
    if (input.coverMediaId) {
      const media = await (tx as unknown as { media: Prisma.TransactionClient['media'] }).media.findFirst({ where: { id: input.coverMediaId, deletedAt: null }, select: { id: true, mimeType: true } });
      if (!media) throw new BadRequestException('Invalid cover');
      if (!media.mimeType.startsWith('image/')) throw new BadRequestException('Invalid cover');
    }
    return department;
  }
  private courseData(input: CourseInput) {
    return {
      slug: input.slug, department: { connect: { id: input.departmentId } }, title: input.title, latin: input.latin,
      description: input.description, level: input.level, duration: input.duration, iconKey: input.iconKey,
      contentHtml: input.contentHtml, syllabus: input.syllabus, status: input.status,
      customPath: input.customPath ?? null,
      ...(input.coverMediaId ? { coverMedia: { connect: { id: input.coverMediaId } } } : {}),
      ...seoData(input.seo),
    };
  }
  private courseCoverUpdate(input: CourseInput) {
    return input.coverMediaId ? { coverMedia: { connect: { id: input.coverMediaId } } } : { coverMedia: { disconnect: true } };
  }
  private relations(input: CourseInput) {
    return {
      faq: { create: input.faq.map(({ question, answer }, position) => ({ question, answer, position })) },
      instructors: { create: input.instructorIds.map((id, position) => ({ instructor: { connect: { id } }, position })) },
    };
  }
  createCourse(actorId: string, input: CourseInput) {
    return this.mutate(async (tx) => {
      const department = await this.courseRelations(tx, input);
      const path = coursePath(department.slug, input.slug);
      await this.available(tx, path);
      const custom = input.customPath ?? null;
      if (custom) await assertCustomPathFree(tx, { owner: 'course', id: null }, custom);
      const row = await tx.course.create({ data: {
        ...this.courseData(input), ...this.relations(input), publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      }, select: courseSelect });
      const paths = new Set([departmentPath(department.slug), path]);
      if (custom) paths.add(`/${custom}`);
      await this.changed(tx, actorId, 'Course', row.id, 'CREATE', row, paths);
      return row;
    });
  }
  updateCourse(actorId: string, id: string, input: CourseInput) {
    return this.mutate(async (tx) => {
      const old = await this.course(id, tx);
      const department = await this.courseRelations(tx, input);
      const oldPath = coursePath(old.department.slug, old.slug);
      const newPath = coursePath(department.slug, input.slug);
      const paths = new Set([departmentPath(old.department.slug), departmentPath(department.slug), oldPath, newPath]);
      if (oldPath !== newPath) {
        await this.available(tx, newPath);
        await this.redirect(tx, oldPath, newPath, paths);
      }
      const custom = input.customPath ?? null;
      if (custom !== (old.customPath ?? null)) {
        if (custom) await assertCustomPathFree(tx, { owner: 'course', id }, custom);
        for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, custom)) paths.add(p);
      } else if (custom) paths.add(`/${custom}`);
      await tx.courseFaq.deleteMany({ where: { courseId: id } });
      await tx.courseInstructor.deleteMany({ where: { courseId: id } });
      const row = await tx.course.update({ where: { id }, data: {
        ...this.courseData(input), ...this.courseCoverUpdate(input), ...this.relations(input), publishedAt: old.publishedAt ?? (input.status === 'PUBLISHED' ? new Date() : null),
      }, select: courseSelect });
      await this.changed(tx, actorId, 'Course', id, 'UPDATE', row, paths);
      return row;
    });
  }
  deleteCourse(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.course(id, tx);
      const row = await tx.course.update({ where: { id }, data: { deletedAt: new Date() }, select: courseSelect });
      const paths = new Set([departmentPath(old.department.slug)]);
      await this.redirect(tx, coursePath(old.department.slug, old.slug), null, paths);
      for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, null)) paths.add(p);
      await this.changed(tx, actorId, 'Course', id, 'DELETE', row, paths);
      return row;
    });
  }
}

@Injectable()
export class AdminCatalogService {
  constructor(private readonly repo: AdminCatalogRepository) {}
  async departments() { return { items: (await this.repo.departments()).map(departmentDto) }; }
  async department(id: string) { return departmentDto(await this.repo.department(id)); }
  async createDepartment(actorId: string, input: DepartmentInput) { return departmentDto(await this.repo.createDepartment(actorId, input)); }
  async updateDepartment(actorId: string, id: string, input: DepartmentInput) { return departmentDto(await this.repo.updateDepartment(actorId, id, input)); }
  async deleteDepartment(actorId: string, id: string) { return departmentDto(await this.repo.deleteDepartment(actorId, id)); }
  async courses() { return { items: (await this.repo.courses()).map(courseDto) }; }
  async course(id: string) { return courseDto(await this.repo.course(id)); }
  async createCourse(actorId: string, input: CourseInput) { return courseDto(await this.repo.createCourse(actorId, input)); }
  async updateCourse(actorId: string, id: string, input: CourseInput) { return courseDto(await this.repo.updateCourse(actorId, id, input)); }
  async deleteCourse(actorId: string, id: string) { return courseDto(await this.repo.deleteCourse(actorId, id)); }
}

@Controller('admin/departments')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminDepartmentsController {
  constructor(private readonly catalog: AdminCatalogService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list() { return this.catalog.departments(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.catalog.department(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(departmentSchema)) body: DepartmentInput) { return this.catalog.createDepartment(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(departmentSchema)) body: DepartmentInput) { return this.catalog.updateDepartment(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  delete(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.catalog.deleteDepartment(req.user.id, id); }
}

@Controller('admin/courses')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminCoursesController {
  constructor(private readonly catalog: AdminCatalogService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list() { return this.catalog.courses(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.catalog.course(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(courseSchema)) body: CourseInput) { return this.catalog.createCourse(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(courseSchema)) body: CourseInput) { return this.catalog.updateCourse(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  delete(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.catalog.deleteCourse(req.user.id, id); }
}

@Module({ imports: [AuthModule], controllers: [AdminDepartmentsController, AdminCoursesController], providers: [AdminCatalogRepository, AdminCatalogService], exports: [AdminCatalogService] })
export class AdminCatalogModule {}
