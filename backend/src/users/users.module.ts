import { BadRequestException, Controller, Get, Header, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, Roles } from '../auth/guards';
import { SchemaPipe } from '../common/validation';
import { Database } from '../infrastructure/infrastructure.module';

// Admin observability: read-only lists over existing tables (no new tables).
// - Users: explicit select (id/email/role/active/createdAt), never password hashes.
// - Audits: metadata passed through as-is, no PII scrub beyond existing shapes.
// - Redirects / revalidation outbox: reused as-is, read-only.
// All endpoints send `Cache-Control: no-store` explicitly.

const idCursor = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const limitField = z.coerce.number().int().min(1).max(100).default(20);
const cursorField = z.string().max(1000).regex(/^[A-Za-z0-9_-]+$/).optional();
const userListSchema = z.object({
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  role: z.enum(['SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR']).optional(),
  limit: limitField,
  cursor: cursorField,
}).strict();
type UserListInput = z.infer<typeof userListSchema>;
const userCursorSchema = z.object({ id: idCursor, active: z.boolean().nullable(), role: z.string().nullable() }).strict();
const auditListSchema = z.object({
  entityType: z.string().min(1).max(100).optional(),
  entityId: z.string().min(1).max(100).optional(),
  actorId: z.string().min(1).max(100).optional(),
  limit: limitField,
  cursor: cursorField,
}).strict();
type AuditListInput = z.infer<typeof auditListSchema>;
const auditCursorSchema = z.object({
  id: idCursor,
  createdAt: z.string().datetime().refine((value) => new Date(value).toISOString() === value),
  entityType: z.string().nullable(), entityId: z.string().nullable(), actorId: z.string().nullable(),
}).strict();
const redirectListSchema = z.object({ limit: limitField, cursor: cursorField }).strict();
type RedirectListInput = z.infer<typeof redirectListSchema>;
const redirectCursorSchema = z.object({ id: idCursor }).strict();
const revalidationListSchema = z.object({
  pending: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  limit: limitField,
  cursor: cursorField,
}).strict();
type RevalidationListInput = z.infer<typeof revalidationListSchema>;
const revalidationCursorSchema = z.object({
  id: idCursor,
  createdAt: z.string().datetime().refine((value) => new Date(value).toISOString() === value),
  pending: z.boolean().nullable(),
}).strict();

function decodeCursor<T>(cursor: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  try {
    const bytes = Buffer.from(cursor, 'base64url');
    if (bytes.toString('base64url') !== cursor) throw new Error();
    return schema.parse(JSON.parse(bytes.toString('utf8')));
  } catch { throw new BadRequestException('Invalid cursor'); }
}
function encodeCursor(value: Record<string, string | boolean | null>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const userSelect = { id: true, email: true, role: true, active: true, createdAt: true } satisfies Prisma.UserSelect;
type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
function userDto(row: UserRow) {
  return { id: row.id, email: row.email, role: row.role, active: row.active, createdAt: row.createdAt.toISOString() };
}
const auditSelect = { id: true, actorId: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true } satisfies Prisma.AuditLogSelect;
type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;
function auditDto(row: AuditRow) {
  return { id: row.id, actorId: row.actorId, action: row.action, entityType: row.entityType, entityId: row.entityId, metadata: row.metadata, createdAt: row.createdAt.toISOString() };
}
const redirectSelect = { id: true, source: true, destination: true, locale: true, createdAt: true, updatedAt: true } satisfies Prisma.RedirectSelect;
type RedirectRow = Prisma.RedirectGetPayload<{ select: typeof redirectSelect }>;
function redirectDto(row: RedirectRow) {
  return { id: row.id, source: row.source, destination: row.destination, locale: row.locale, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
const outboxSelect = { id: true, paths: true, version: true, deliveredAt: true, createdAt: true, updatedAt: true } satisfies Prisma.RevalidationOutboxSelect;
type OutboxRow = Prisma.RevalidationOutboxGetPayload<{ select: typeof outboxSelect }>;
function outboxDto(row: OutboxRow) {
  return {
    id: row.id, paths: row.paths, version: row.version, deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class AdminDirectoryRepository {
  constructor(private readonly db: Database) {}
  async users(query: UserListInput) {
    let id: string | undefined;
    if (query.cursor !== undefined) {
      const cursor = decodeCursor(query.cursor, userCursorSchema);
      if (cursor.active !== (query.active ?? null) || cursor.role !== (query.role ?? null)) throw new BadRequestException('Invalid cursor');
      id = cursor.id;
    }
    const rows = await this.db.user.findMany({
      where: {
        deletedAt: null, ...(query.active !== undefined ? { active: query.active } : {}),
        ...(query.role ? { role: query.role } : {}), ...(id ? { id: { gt: id } } : {}),
      },
      orderBy: { id: 'asc' }, take: query.limit + 1, select: userSelect,
    });
    const items = rows.slice(0, query.limit).map(userDto);
    const nextCursor = rows.length > query.limit && items.length
      ? encodeCursor({ id: items[items.length - 1]!.id, active: query.active ?? null, role: query.role ?? null })
      : null;
    return { items, nextCursor };
  }
  async audits(query: AuditListInput) {
    let position: { id: string; createdAt: Date } | undefined;
    if (query.cursor !== undefined) {
      const cursor = decodeCursor(query.cursor, auditCursorSchema);
      if (cursor.entityType !== (query.entityType ?? null) || cursor.entityId !== (query.entityId ?? null) || cursor.actorId !== (query.actorId ?? null)) throw new BadRequestException('Invalid cursor');
      position = { id: cursor.id, createdAt: new Date(cursor.createdAt) };
    }
    const rows = await this.db.auditLog.findMany({
      where: {
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(position ? { OR: [{ createdAt: { lt: position.createdAt } }, { createdAt: position.createdAt, id: { lt: position.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1, select: auditSelect,
    });
    const items = rows.slice(0, query.limit).map(auditDto);
    const last = items.at(-1);
    const nextCursor = rows.length > query.limit && last
      ? encodeCursor({ id: last.id, createdAt: last.createdAt, entityType: query.entityType ?? null, entityId: query.entityId ?? null, actorId: query.actorId ?? null })
      : null;
    return { items, nextCursor };
  }
  async redirects(query: RedirectListInput) {
    let id: string | undefined;
    if (query.cursor !== undefined) id = decodeCursor(query.cursor, redirectCursorSchema).id;
    const rows = await this.db.redirect.findMany({
      where: { ...(id ? { id: { gt: id } } : {}) },
      orderBy: { id: 'asc' }, take: query.limit + 1, select: redirectSelect,
    });
    const items = rows.slice(0, query.limit).map(redirectDto);
    const nextCursor = rows.length > query.limit && items.length ? encodeCursor({ id: items[items.length - 1]!.id }) : null;
    return { items, nextCursor };
  }
  async revalidation(query: RevalidationListInput) {
    let position: { id: string; createdAt: Date } | undefined;
    if (query.cursor !== undefined) {
      const cursor = decodeCursor(query.cursor, revalidationCursorSchema);
      if (cursor.pending !== (query.pending ?? null)) throw new BadRequestException('Invalid cursor');
      position = { id: cursor.id, createdAt: new Date(cursor.createdAt) };
    }
    const rows = await this.db.revalidationOutbox.findMany({
      where: {
        ...(query.pending === true ? { deliveredAt: null } : {}),
        ...(query.pending === false ? { deliveredAt: { not: null } } : {}),
        ...(position ? { OR: [{ createdAt: { gt: position.createdAt } }, { createdAt: position.createdAt, id: { gt: position.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: query.limit + 1, select: outboxSelect,
    });
    const items = rows.slice(0, query.limit).map(outboxDto);
    const last = items.at(-1);
    const nextCursor = rows.length > query.limit && last
      ? encodeCursor({ id: last.id, createdAt: last.createdAt, pending: query.pending ?? null })
      : null;
    return { items, nextCursor };
  }
}

@Injectable()
export class AdminDirectoryService {
  constructor(private readonly repo: AdminDirectoryRepository) {}
  users(query: UserListInput) { return this.repo.users(query); }
  audits(query: AuditListInput) { return this.repo.audits(query); }
  redirects(query: RedirectListInput) { return this.repo.redirects(query); }
  revalidation(query: RevalidationListInput) { return this.repo.revalidation(query); }
}

class AdminUserDto {
  id!: string;
  email!: string;
  role!: string;
  active!: boolean;
  createdAt!: string;
}
class AdminUserPageDto {
  items!: AdminUserDto[];
  nextCursor!: string | null;
}
class AuditDto {
  id!: string;
  actorId!: string | null;
  action!: string;
  entityType!: string;
  entityId!: string;
  createdAt!: string;
}
class AuditPageDto {
  items!: AuditDto[];
  nextCursor!: string | null;
}
class RedirectDto {
  id!: string;
  source!: string;
  destination!: string | null;
  locale!: string;
  createdAt!: string;
  updatedAt!: string;
}
class RedirectPageDto {
  items!: RedirectDto[];
  nextCursor!: string | null;
}
class RevalidationDto {
  id!: string;
  version!: number;
  deliveredAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
class RevalidationPageDto {
  items!: RevalidationDto[];
  nextCursor!: string | null;
}

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN')
export class AdminUsersListController {
  constructor(private readonly directory: AdminDirectoryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'active', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'role', required: false, enum: ['SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR'] })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque id keyset cursor bound to filters' })
  @ApiOkResponse({ type: AdminUserPageDto })
  list(@Query(new SchemaPipe(userListSchema)) query: UserListInput) { return this.directory.users(query); }
}

@ApiTags('admin-audits')
@ApiBearerAuth()
@Controller('admin/audits')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN')
export class AdminAuditsController {
  constructor(private readonly directory: AdminDirectoryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'actorId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque createdAt/id keyset cursor bound to filters' })
  @ApiOkResponse({ type: AuditPageDto })
  list(@Query(new SchemaPipe(auditListSchema)) query: AuditListInput) { return this.directory.audits(query); }
}

@ApiTags('admin-redirects')
@ApiBearerAuth()
@Controller('admin/redirects')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminRedirectsController {
  constructor(private readonly directory: AdminDirectoryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque id keyset cursor' })
  @ApiOkResponse({ type: RedirectPageDto })
  list(@Query(new SchemaPipe(redirectListSchema)) query: RedirectListInput) { return this.directory.redirects(query); }
}

@ApiTags('admin-revalidation')
@ApiBearerAuth()
@Controller('admin/revalidation')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminRevalidationController {
  constructor(private readonly directory: AdminDirectoryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'pending', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque createdAt/id keyset cursor bound to pending filter' })
  @ApiOkResponse({ type: RevalidationPageDto })
  list(@Query(new SchemaPipe(revalidationListSchema)) query: RevalidationListInput) { return this.directory.revalidation(query); }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersListController, AdminAuditsController, AdminRedirectsController, AdminRevalidationController],
  providers: [AdminDirectoryRepository, AdminDirectoryService],
  exports: [AdminDirectoryService],
})
export class UsersModule {}
