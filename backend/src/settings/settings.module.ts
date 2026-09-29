import { Body, Controller, Get, Header, Injectable, Module, NotFoundException, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, AuthRequest, Roles } from '../auth/guards';
import { SchemaPipe, SettingsInput, settingsSchema } from '../common/validation';
import { Database } from '../infrastructure/infrastructure.module';

// SiteSettings is a published singleton (id=1, no status column): the public
// endpoint returns it when configured (404 before the first admin upsert) and
// the admin endpoint upserts it. All endpoints send `Cache-Control: no-store`
// explicitly, and src/security/runtime.ts also forces no-store for the public path.

const settingsSelect = {
  name: true, description: true, contact: true, locale: true,
  seoTitle: true, seoDescription: true, canonicalUrl: true, noindex: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.SiteSettingsSelect;
type SettingsRow = Prisma.SiteSettingsGetPayload<{ select: typeof settingsSelect }>;
function settingsDto(row: SettingsRow) {
  return {
    name: row.name, description: row.description, contact: row.contact,
    seo: { title: row.seoTitle, description: row.seoDescription, canonicalUrl: row.canonicalUrl, noindex: row.noindex },
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
function seoData(seo: SettingsInput['seo']) {
  return { seoTitle: seo?.title ?? null, seoDescription: seo?.description ?? null, canonicalUrl: seo?.canonicalUrl ?? null, noindex: seo?.noindex ?? false };
}

@Injectable()
export class SettingsRepository {
  constructor(private readonly db: Database) {}
  get() { return this.db.siteSettings.findUnique({ where: { id: 1 }, select: settingsSelect }); }
  upsert(actorId: string, input: SettingsInput) {
    return this.db.serial(async (tx) => {
      const row = await tx.siteSettings.upsert({
        where: { id: 1 },
        create: { id: 1, name: input.name, description: input.description, contact: input.contact, ...seoData(input.seo) },
        update: { name: input.name, description: input.description, contact: input.contact, ...seoData(input.seo) },
        select: settingsSelect,
      });
      await tx.auditLog.create({ data: { actorId, entityType: 'SiteSettings', entityId: '1', action: 'UPDATE', metadata: { name: row.name } } });
      const revision = await tx.contentRevision.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
      await tx.revalidationOutbox.create({ data: { version: revision.version, paths: ['/'] } });
      return row;
    });
  }
}

@Injectable()
export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}
  async get() {
    const row = await this.repo.get();
    if (!row) throw new NotFoundException('Settings not found');
    return settingsDto(row);
  }
  async public() {
    const row = await this.repo.get();
    if (!row) throw new NotFoundException('Settings not found');
    return settingsDto(row);
  }
  async upsert(actorId: string, input: SettingsInput) { return settingsDto(await this.repo.upsert(actorId, input)); }
}

class SettingsDto {
  name!: string;
  description!: string;
  createdAt!: string;
  updatedAt!: string;
}

@ApiTags('admin-settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(AccessGuard)
@Roles('SUPER_ADMIN', 'CONTENT_MANAGER')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: SettingsDto })
  get() { return this.settings.get(); }
  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: SettingsDto })
  upsert(@Req() req: AuthRequest, @Body(new SchemaPipe(settingsSchema)) body: SettingsInput) { return this.settings.upsert(req.user.id, body); }
}

@ApiTags('public-settings')
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: SettingsDto })
  get() { return this.settings.public(); }
}

@Module({ imports: [AuthModule], controllers: [AdminSettingsController, PublicSettingsController], providers: [SettingsRepository, SettingsService], exports: [SettingsService] })
export class SettingsModule {}
