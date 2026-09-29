import { BadRequestException, Body, ConflictException, Controller, Get, Header, Injectable, Module, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AuthModule } from './auth/auth.module';
import { AccessGuard, AuthRequest, OriginGuard, Roles } from './auth/guards';
import { SchemaPipe } from './common/validation';
import { Database } from './infrastructure/infrastructure.module';
import { AcceptedLeadDto, leadCursorSchema, leadIdSchema, LeadInput, LeadListInput, leadListSchema, LeadPageDto, leadSchema, LeadStatusDto, LeadStatusInput, leadStatusSchema, SubmitLeadDto, UpdatedLeadDto } from './leads.dto';

const leadSelect = {
  id: true, name: true, phone: true, email: true, message: true, courseId: true,
  status: true, consentAt: true, locale: true, createdAt: true, updatedAt: true,
} satisfies Prisma.LeadSelect;
const published = (now: Date) => ({ status: 'PUBLISHED' as const, deletedAt: null, publishedAt: { lte: now } });

@Injectable()
export class LeadsRepository {
  constructor(private readonly db: Database) {}
  async submit(input: LeadInput): Promise<{ accepted: true }> {
    const operation = async (tx: Prisma.TransactionClient) => {
      const { submissionId: id, name, phone, email, message, courseId } = input;
      const previous = await tx.lead.findUnique({ where: { id }, select: { name: true, phone: true, email: true, message: true, courseId: true } });
      if (previous) {
        if (previous.name !== name || previous.phone !== phone || previous.email !== email || previous.message !== message || previous.courseId !== courseId) throw new ConflictException();
        return;
      }
      const now = new Date();
      if (courseId && !await tx.course.findFirst({ where: { id: courseId, ...published(now), department: published(now) }, select: { id: true } })) throw new BadRequestException('Invalid request');
      await tx.lead.create({ data: { id, name, phone, email, message, courseId, consentAt: now, locale: 'fa', status: 'NEW' }, select: { id: true } });
      await tx.auditLog.create({ data: { entityType: 'Lead', entityId: id, action: 'CREATE', metadata: { status: 'NEW' } } });
    };
    try { await this.db.serial(operation); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      await this.db.serial(operation);
    }
    return { accepted: true };
  }
  async list(query: LeadListInput) {
    let position: { id: string; createdAt: Date } | undefined;
    if (query.cursor !== undefined) {
      try {
        const bytes = Buffer.from(query.cursor, 'base64url');
        if (bytes.toString('base64url') !== query.cursor) throw new Error();
        const cursor = leadCursorSchema.parse(JSON.parse(bytes.toString('utf8')));
        if (cursor.status !== (query.status ?? null) || cursor.courseId !== (query.courseId ?? null)) throw new Error();
        position = { id: cursor.id, createdAt: new Date(cursor.createdAt) };
      } catch { throw new BadRequestException('Invalid cursor'); }
    }
    const rows = await this.db.lead.findMany({
      where: {
        deletedAt: null, ...(query.status ? { status: query.status } : {}), ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(position ? { OR: [{ createdAt: { lt: position.createdAt } }, { createdAt: position.createdAt, id: { lt: position.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1, select: leadSelect,
    });
    const items = rows.slice(0, query.limit).map((row) => ({ ...row, consentAt: row.consentAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
    const last = items.at(-1);
    const nextCursor = rows.length > query.limit && last ? Buffer.from(JSON.stringify({ id: last.id, createdAt: last.createdAt, status: query.status ?? null, courseId: query.courseId ?? null })).toString('base64url') : null;
    return { items, nextCursor };
  }
  updateStatus(actorId: string, id: string, input: LeadStatusInput) {
    return this.db.serial(async (tx) => {
      const previous = await tx.lead.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
      if (!previous) throw new NotFoundException();
      const row = await tx.lead.update({ where: { id, deletedAt: null }, data: { status: input.status }, select: { id: true, status: true } });
      await tx.auditLog.create({ data: { actorId, entityType: 'Lead', entityId: id, action: 'UPDATE', metadata: { previousStatus: previous.status, status: row.status } } });
      return row;
    });
  }
}

@ApiTags('leads')
@Controller('public/leads')
export class PublicLeadsController {
  constructor(private readonly leads: LeadsRepository) {}
  @Post()
  @UseGuards(OriginGuard)
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'Origin', required: true })
  @ApiBody({ type: SubmitLeadDto })
  @ApiCreatedResponse({ type: AcceptedLeadDto })
  submit(@Body(new SchemaPipe(leadSchema)) input: LeadInput) { return this.leads.submit(input); }
}

@ApiTags('admin-leads')
@ApiBearerAuth()
@Controller('admin/leads')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN')
export class AdminLeadsController {
  constructor(private readonly leads: LeadsRepository) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'status', required: false, enum: ['NEW', 'CONTACTED', 'CLOSED'] })
  @ApiQuery({ name: 'courseId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque createdAt/id keyset cursor bound to filters' })
  @ApiOkResponse({ type: LeadPageDto })
  list(@Query(new SchemaPipe(leadListSchema)) query: LeadListInput) { return this.leads.list(query); }
  @Patch(':id/status')
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiBody({ type: LeadStatusDto })
  @ApiOkResponse({ type: UpdatedLeadDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(leadIdSchema)) id: string, @Body(new SchemaPipe(leadStatusSchema)) input: LeadStatusInput) { return this.leads.updateStatus(req.user.id, id, input); }
}

@Module({ imports: [AuthModule], controllers: [PublicLeadsController, AdminLeadsController], providers: [LeadsRepository, OriginGuard] })
export class LeadsModule {}
