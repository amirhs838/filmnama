import { Module } from '@nestjs/common';
import { LeadsModule } from './leads.module';
import { CatalogModule } from './catalog/catalog.module';
import { AdminCatalogModule } from './catalog/admin.module';
import { InstructorsModule } from './instructors/instructors.module';
import { BlogModule } from './blog/blog.module';
import { GalleryModule } from './gallery/gallery.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { MediaModule } from './media/media.module';
import { PathsModule } from './paths/paths.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { RevalidationModule } from './infrastructure/revalidation.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    InfrastructureModule,
    SecurityModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    LeadsModule,
    AdminCatalogModule,
    InstructorsModule,
    BlogModule,
    GalleryModule,
    PortfolioModule,
    MediaModule,
    PathsModule,
    SearchModule,
    SettingsModule,
    UsersModule,
    RevalidationModule,
  ],
})
export class AppModule {}
