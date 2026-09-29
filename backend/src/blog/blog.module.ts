import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AccessGuard, AuthRequest, Roles } from '../auth/guards';
import { CategoryInput, categorySchema, PostInput, postListSchema, PostListInput, postSchema, SchemaPipe, slug, TagInput, tagSchema } from '../common/validation';
import { assertCustomPathFree, syncCustomPathRedirect } from '../common/paths';
import { Database } from '../infrastructure/infrastructure.module';

// Phase 1 caching choice: no Redis versioned cache (catalog pattern deferred to
// phase 2). All endpoints below send `Cache-Control: no-store` explicitly.

const idSchema = z.string().min(1).max(100);
const categorySelect = { id: true, slug: true, title: true, createdAt: true, updatedAt: true, deletedAt: true } satisfies Prisma.CategorySelect;
const tagSelect = { id: true, slug: true, title: true, createdAt: true, updatedAt: true, deletedAt: true } satisfies Prisma.TagSelect;
const coverSelect = { id: true, alt: true, deletedAt: true } satisfies Prisma.MediaSelect;
const postSelect = {
  id: true, slug: true, title: true, excerpt: true, contentHtml: true, categoryId: true, authorId: true,
  coverMediaId: true, customPath: true,
  status: true, seoTitle: true, seoDescription: true, canonicalUrl: true, noindex: true,
  publishedAt: true, createdAt: true, updatedAt: true, deletedAt: true,
  category: { select: { slug: true } },
  tags: { orderBy: { tagId: 'asc' }, select: { tagId: true } },
  coverMedia: { select: coverSelect },
} satisfies Prisma.PostSelect;
type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
type TagRow = Prisma.TagGetPayload<{ select: typeof tagSelect }>;
type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;
const cursorSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), category: slug.nullable(), tag: slug.nullable() }).strict();

function seoDto(row: PostRow) {
  return { title: row.seoTitle, description: row.seoDescription, canonicalUrl: row.canonicalUrl, noindex: row.noindex };
}
function coverMediaDto(row: PostRow) {
  const cover = (row as unknown as { coverMedia?: { id: string; alt: string; deletedAt: Date | null } | null }).coverMedia;
  if (!cover || cover.deletedAt) return null;
  return { id: cover.id, url: `/api/v1/public/media/${cover.id}/file`, alt: cover.alt };
}
function categoryDto(row: CategoryRow) {
  return { id: row.id, slug: row.slug, title: row.title, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null };
}
function tagDto(row: TagRow) {
  return { id: row.id, slug: row.slug, title: row.title, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null };
}
function postDto(row: PostRow) {
  return {
    id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, contentHtml: row.contentHtml,
    categoryId: row.categoryId, authorId: row.authorId, tagIds: row.tags.map(({ tagId }) => tagId),
    coverMediaId: (row as unknown as { coverMediaId?: string | null }).coverMediaId ?? null,
    coverMedia: coverMediaDto(row),
    customPath: row.customPath ?? null,
    status: row.status, seo: seoDto(row),
    publishedAt: row.publishedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
function publicPostDto(row: PostRow) {
  return {
    id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, contentHtml: row.contentHtml,
    category: row.category?.slug ?? null, tagIds: row.tags.map(({ tagId }) => tagId),
    coverMedia: coverMediaDto(row),
    customPath: row.customPath ?? null,
    seo: seoDto(row), publishedAt: row.publishedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString(),
  };
}
function seoData(seo: PostInput['seo']) {
  return { seoTitle: seo?.title ?? null, seoDescription: seo?.description ?? null, canonicalUrl: seo?.canonicalUrl ?? null, noindex: seo?.noindex ?? false };
}
const postPath = (value: string) => `/blog/${value}`;

@Injectable()
export class BlogRepository {
  constructor(private readonly db: Database) {}
  categories() { return this.db.category.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: categorySelect }); }
  tags() { return this.db.tag.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: tagSelect }); }
  posts() { return this.db.post.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: postSelect }); }
  async category(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.category.findFirst({ where: { id, deletedAt: null }, select: categorySelect });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }
  async tag(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.tag.findFirst({ where: { id, deletedAt: null }, select: tagSelect });
    if (!row) throw new NotFoundException('Tag not found');
    return row;
  }
  async post(id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.post.findFirst({ where: { id, deletedAt: null }, select: postSelect });
    if (!row) throw new NotFoundException('Post not found');
    return row;
  }
  publics() {
    return this.db.category.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: categorySelect });
  }
  publicTags() {
    return this.db.tag.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' }, select: tagSelect });
  }
  publicPosts(query: PostListInput, id: string | undefined, now: Date) {
    return this.db.post.findMany({
      where: {
        status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now },
        ...(id ? { id: { gt: id } } : {}),
        ...(query.category ? { category: { slug: query.category, deletedAt: null } } : {}),
        ...(query.tag ? { tags: { some: { tag: { slug: query.tag, deletedAt: null } } } } : {}),
      },
      orderBy: { id: 'asc' }, take: query.limit + 1, select: postSelect,
    });
  }
  publicPost(slugValue: string, now: Date) {
    return this.db.post.findFirst({ where: { slug: slugValue, status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now } }, select: postSelect });
  }
  private async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try { return await this.db.serial(operation); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException('Blog slug is reserved');
        if (error.code === 'P2025') throw new NotFoundException();
      }
      throw error;
    }
  }
  private async changed(tx: Prisma.TransactionClient, actorId: string, entityType: 'Post' | 'Category' | 'Tag', entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', metadata: Record<string, string | null>, paths: Set<string>) {
    await tx.auditLog.create({ data: { actorId, entityType, entityId, action, metadata } });
    const revision = await tx.contentRevision.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } }, select: { version: true } });
    const allPaths = [...new Set(['/', '/blog', ...paths])];
    for (let i = 0; i < allPaths.length; i += 100) await tx.revalidationOutbox.create({ data: { version: revision.version, paths: allPaths.slice(i, i + 100) } });
  }
  createCategory(actorId: string, input: CategoryInput) {
    return this.mutate(async (tx) => {
      const row = await tx.category.create({ data: { slug: input.slug, title: input.title }, select: categorySelect });
      await this.changed(tx, actorId, 'Category', row.id, 'CREATE', { slug: row.slug, title: row.title }, new Set());
      return row;
    });
  }
  updateCategory(actorId: string, id: string, input: CategoryInput) {
    return this.mutate(async (tx) => {
      await this.category(id, tx);
      const row = await tx.category.update({ where: { id }, data: { slug: input.slug, title: input.title }, select: categorySelect });
      await this.changed(tx, actorId, 'Category', id, 'UPDATE', { slug: row.slug, title: row.title }, new Set());
      return row;
    });
  }
  deleteCategory(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.category(id, tx);
      if (await tx.post.count({ where: { categoryId: id, deletedAt: null } })) throw new ConflictException('Category has undeleted posts');
      const row = await tx.category.update({ where: { id }, data: { deletedAt: new Date() }, select: categorySelect });
      await this.changed(tx, actorId, 'Category', id, 'DELETE', { slug: old.slug, title: old.title }, new Set());
      return row;
    });
  }
  createTag(actorId: string, input: TagInput) {
    return this.mutate(async (tx) => {
      const row = await tx.tag.create({ data: { slug: input.slug, title: input.title }, select: tagSelect });
      await this.changed(tx, actorId, 'Tag', row.id, 'CREATE', { slug: row.slug, title: row.title }, new Set());
      return row;
    });
  }
  updateTag(actorId: string, id: string, input: TagInput) {
    return this.mutate(async (tx) => {
      await this.tag(id, tx);
      const row = await tx.tag.update({ where: { id }, data: { slug: input.slug, title: input.title }, select: tagSelect });
      await this.changed(tx, actorId, 'Tag', id, 'UPDATE', { slug: row.slug, title: row.title }, new Set());
      return row;
    });
  }
  deleteTag(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.tag(id, tx);
      if (await tx.postTag.count({ where: { tagId: id } })) throw new ConflictException('Tag is used by posts');
      const row = await tx.tag.update({ where: { id }, data: { deletedAt: new Date() }, select: tagSelect });
      await this.changed(tx, actorId, 'Tag', id, 'DELETE', { slug: old.slug, title: old.title }, new Set());
      return row;
    });
  }
  private async postRelations(tx: Prisma.TransactionClient, input: PostInput) {
    if (input.categoryId) {
      const category = await tx.category.findFirst({ where: { id: input.categoryId, deletedAt: null }, select: { id: true } });
      if (!category) throw new BadRequestException('Category not found');
    }
    if (input.tagIds.length) {
      const tags = await tx.tag.findMany({ where: { id: { in: input.tagIds }, deletedAt: null }, select: { id: true } });
      if (tags.length !== input.tagIds.length) throw new BadRequestException('Tag not found');
    }
    if (input.coverMediaId) {
      const media = await (tx as unknown as { media: Prisma.TransactionClient['media'] }).media.findFirst({ where: { id: input.coverMediaId, deletedAt: null }, select: { id: true, mimeType: true } });
      if (!media) throw new BadRequestException('Invalid cover');
      if (!media.mimeType.startsWith('image/')) throw new BadRequestException('Invalid cover');
    }
  }
  createPost(actorId: string, input: PostInput) {
    return this.mutate(async (tx) => {
      await this.postRelations(tx, input);
      const custom = input.customPath ?? null;
      if (custom) await assertCustomPathFree(tx, { owner: 'post', id: null }, custom);
      const row = await tx.post.create({
        data: {
          slug: input.slug, title: input.title, excerpt: input.excerpt, contentHtml: input.contentHtml,
          author: { connect: { id: actorId } },
          ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
          tags: { create: input.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
          ...(input.coverMediaId ? { coverMedia: { connect: { id: input.coverMediaId } } } : {}),
          status: input.status, ...seoData(input.seo), customPath: custom, publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        },
        select: postSelect,
      });
      const paths = new Set([postPath(row.slug)]);
      if (custom) paths.add(`/${custom}`);
      await this.changed(tx, actorId, 'Post', row.id, 'CREATE', { slug: row.slug, title: row.title, status: row.status }, paths);
      return row;
    });
  }
  updatePost(actorId: string, id: string, input: PostInput) {
    return this.mutate(async (tx) => {
      const old = await this.post(id, tx);
      await this.postRelations(tx, input);
      // Tag links are replaced transactionally (PostTag has no position/order column;
      // deterministic order is tagId asc on read). Any editor role may edit.
      await tx.postTag.deleteMany({ where: { postId: id } });
      const custom = input.customPath ?? null;
      const paths = new Set([postPath(old.slug)]);
      if (custom !== (old.customPath ?? null)) {
        if (custom) await assertCustomPathFree(tx, { owner: 'post', id }, custom);
        for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, custom)) paths.add(p);
      } else if (custom) paths.add(`/${custom}`);
      const row = await tx.post.update({
        where: { id },
        data: {
          slug: input.slug, title: input.title, excerpt: input.excerpt, contentHtml: input.contentHtml,
          category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true },
          tags: { create: input.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
          coverMedia: input.coverMediaId ? { connect: { id: input.coverMediaId } } : { disconnect: true },
          status: input.status, ...seoData(input.seo), customPath: custom, publishedAt: old.publishedAt ?? (input.status === 'PUBLISHED' ? new Date() : null),
        },
        select: postSelect,
      });
      paths.add(postPath(row.slug));
      await this.changed(tx, actorId, 'Post', id, 'UPDATE', { slug: row.slug, title: row.title, status: row.status }, paths);
      return row;
    });
  }
  deletePost(actorId: string, id: string) {
    return this.mutate(async (tx) => {
      const old = await this.post(id, tx);
      const row = await tx.post.update({ where: { id }, data: { deletedAt: new Date() }, select: postSelect });
      const paths = new Set([postPath(old.slug)]);
      for (const p of await syncCustomPathRedirect(tx, old.customPath ?? null, null)) paths.add(p);
      await this.changed(tx, actorId, 'Post', id, 'DELETE', { slug: old.slug, title: old.title, status: old.status }, paths);
      return row;
    });
  }
}

@Injectable()
export class BlogService {
  constructor(private readonly repo: BlogRepository) {}
  async categories() { return { items: (await this.repo.categories()).map(categoryDto) }; }
  async category(id: string) { return categoryDto(await this.repo.category(id)); }
  async createCategory(actorId: string, input: CategoryInput) { return categoryDto(await this.repo.createCategory(actorId, input)); }
  async updateCategory(actorId: string, id: string, input: CategoryInput) { return categoryDto(await this.repo.updateCategory(actorId, id, input)); }
  async deleteCategory(actorId: string, id: string) { return categoryDto(await this.repo.deleteCategory(actorId, id)); }
  async tags() { return { items: (await this.repo.tags()).map(tagDto) }; }
  async tag(id: string) { return tagDto(await this.repo.tag(id)); }
  async createTag(actorId: string, input: TagInput) { return tagDto(await this.repo.createTag(actorId, input)); }
  async updateTag(actorId: string, id: string, input: TagInput) { return tagDto(await this.repo.updateTag(actorId, id, input)); }
  async deleteTag(actorId: string, id: string) { return tagDto(await this.repo.deleteTag(actorId, id)); }
  async posts() { return { items: (await this.repo.posts()).map(postDto) }; }
  async post(id: string) { return postDto(await this.repo.post(id)); }
  async createPost(actorId: string, input: PostInput) { return postDto(await this.repo.createPost(actorId, input)); }
  async updatePost(actorId: string, id: string, input: PostInput) { return postDto(await this.repo.updatePost(actorId, id, input)); }
  async deletePost(actorId: string, id: string) { return postDto(await this.repo.deletePost(actorId, id)); }
  async publicCategories() { return { items: (await this.repo.publics()).map((row) => ({ id: row.id, slug: row.slug, title: row.title, updatedAt: row.updatedAt.toISOString() })) }; }
  async publicTags() { return { items: (await this.repo.publicTags()).map((row) => ({ id: row.id, slug: row.slug, title: row.title, updatedAt: row.updatedAt.toISOString() })) }; }
  async publicPosts(query: PostListInput) {
    let id: string | undefined;
    if (query.cursor !== undefined) {
      try {
        const bytes = Buffer.from(query.cursor, 'base64url');
        if (bytes.toString('base64url') !== query.cursor) throw new Error();
        const cursor = cursorSchema.parse(JSON.parse(bytes.toString('utf8')));
        if (cursor.category !== (query.category ?? null) || cursor.tag !== (query.tag ?? null)) throw new Error();
        id = cursor.id;
      } catch { throw new BadRequestException('Invalid cursor'); }
    }
    const rows = await this.repo.publicPosts(query, id, new Date());
    const items = rows.slice(0, query.limit).map(publicPostDto);
    const nextCursor = rows.length > query.limit && items.length
      ? Buffer.from(JSON.stringify({ id: items[items.length - 1]!.id, category: query.category ?? null, tag: query.tag ?? null })).toString('base64url')
      : null;
    return { items, nextCursor };
  }
  async publicPost(slugValue: string) {
    const row = await this.repo.publicPost(slugValue, new Date());
    if (!row) throw new NotFoundException('Post not found');
    return publicPostDto(row);
  }
}

class CategoryDto {
  id!: string;
  slug!: string;
  title!: string;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class CategoryListDto {
  items!: CategoryDto[];
}
class TagDto {
  id!: string;
  slug!: string;
  title!: string;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class TagListDto {
  items!: TagDto[];
}
class PostDto {
  id!: string;
  slug!: string;
  title!: string;
  excerpt!: string;
  contentHtml!: string;
  categoryId!: string | null;
  authorId!: string;
  tagIds!: string[];
  status!: string;
  publishedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
  deletedAt!: string | null;
}
class PostListDto {
  items!: PostDto[];
}

const BLOG_ROLES = ['SUPER_ADMIN', 'CONTENT_MANAGER', 'BLOG_EDITOR'] as const;

@ApiTags('admin-categories')
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(AccessGuard)
@Roles(...BLOG_ROLES)
export class AdminCategoriesController {
  constructor(private readonly blog: BlogService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CategoryListDto })
  list() { return this.blog.categories(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CategoryDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.blog.category(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: CategoryDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(categorySchema)) body: CategoryInput) { return this.blog.createCategory(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: CategoryDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(categorySchema)) body: CategoryInput) { return this.blog.updateCategory(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CategoryDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.blog.deleteCategory(req.user.id, id); }
}

@ApiTags('admin-tags')
@ApiBearerAuth()
@Controller('admin/tags')
@UseGuards(AccessGuard)
@Roles(...BLOG_ROLES)
export class AdminTagsController {
  constructor(private readonly blog: BlogService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: TagListDto })
  list() { return this.blog.tags(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: TagDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.blog.tag(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: TagDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(tagSchema)) body: TagInput) { return this.blog.createTag(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: TagDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(tagSchema)) body: TagInput) { return this.blog.updateTag(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: TagDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.blog.deleteTag(req.user.id, id); }
}

@ApiTags('admin-posts')
@ApiBearerAuth()
@Controller('admin/posts')
@UseGuards(AccessGuard)
@Roles(...BLOG_ROLES)
export class AdminPostsController {
  constructor(private readonly blog: BlogService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PostListDto })
  list() { return this.blog.posts(); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PostDto })
  detail(@Param('id', new SchemaPipe(idSchema)) id: string) { return this.blog.post(id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: PostDto })
  create(@Req() req: AuthRequest, @Body(new SchemaPipe(postSchema)) body: PostInput) { return this.blog.createPost(req.user.id, body); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: Object })
  @ApiOkResponse({ type: PostDto })
  update(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string, @Body(new SchemaPipe(postSchema)) body: PostInput) { return this.blog.updatePost(req.user.id, id, body); }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PostDto })
  remove(@Req() req: AuthRequest, @Param('id', new SchemaPipe(idSchema)) id: string) { return this.blog.deletePost(req.user.id, id); }
}

@ApiTags('public-blog')
@Controller('public')
export class PublicBlogController {
  constructor(private readonly blog: BlogService) {}
  @Get('posts')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'tag', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Opaque id keyset cursor bound to filters' })
  list(@Query(new SchemaPipe(postListSchema)) query: PostListInput) { return this.blog.publicPosts(query); }
  @Get('posts/:slug')
  @Header('Cache-Control', 'no-store')
  detail(@Param('slug', new SchemaPipe(slug)) value: string) { return this.blog.publicPost(value); }
  @Get('categories')
  @Header('Cache-Control', 'no-store')
  categories() { return this.blog.publicCategories(); }
  @Get('tags')
  @Header('Cache-Control', 'no-store')
  tags() { return this.blog.publicTags(); }
}

@Module({ imports: [AuthModule], controllers: [AdminCategoriesController, AdminTagsController, AdminPostsController, PublicBlogController], providers: [BlogRepository, BlogService], exports: [BlogService] })
export class BlogModule {}
