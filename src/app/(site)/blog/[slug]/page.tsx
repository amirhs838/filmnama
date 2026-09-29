import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import ShareButtons from "@/components/blog/ShareButtons";
import { getCategories, getPost, getPosts, getTags } from "@/lib/public-content";
import { mediaSrc, postPath, readingMinutes, relatedPosts } from "@/lib/content-contract";
import { sanitizeCourseHtml } from "@/lib/course-html";
import { backendUrl } from "@/lib/content-config";
import { canonicalUrl, contentMetadata, withCustomCanonical } from "@/lib/content-seo";
import { serializeJsonLd } from "@/lib/structured-data";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props["params"]) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  return post;
}

function absoluteCoverUrl(coverUrl: string): string {
  return new URL(coverUrl, backendUrl()).href;
}

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const post = await load(params);
  const images = post.coverMedia ? [absoluteCoverUrl(post.coverMedia.url)] : undefined;
  return withCustomCanonical(contentMetadata(post.title, post.excerpt || post.title, postPath(post), post.seo, images), post.customPath, post.seo.canonicalUrl);
}

function formatFaDate(iso: string): string {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}

export default async function BlogPostPage({ params }: Props) {
  const post = await load(params);
  const path = postPath(post);
  const contentHtml = sanitizeCourseHtml(post.contentHtml);
  const pageUrl = canonicalUrl(path, post.seo.canonicalUrl);
  const dateIso = post.publishedAt ?? post.updatedAt;
  const words = `${post.excerpt} ${post.contentHtml.replace(/<[^>]*>/g, " ")}`;
  const minutes = readingMinutes(words);
  const [allPosts, categories, tags] = await Promise.all([getPosts(), getCategories(), getTags()]);
  const related = relatedPosts(allPosts, post, 3);
  const category = categories.find((item) => item.slug === post.category) ?? null;
  const postTags = tags.filter((tag) => post.tagIds.includes(tag.id));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.title,
    url: pageUrl,
    ...(post.coverMedia ? { image: [absoluteCoverUrl(post.coverMedia.url)] } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: "فیلم‌نما" },
  };

  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "بلاگ", path: "/blog/" }, { name: post.title, path }]} />
        {category ? (
          <p className="mt-6"><Link href={`/blog/?category=${encodeURIComponent(category.slug)}`} className="text-sm font-bold text-red underline underline-offset-8 hover:text-red-deep">{category.title}</Link></p>
        ) : (
          <p className="text-label-latin mt-6 text-smoke" dir="ltr">FILMNAMA BLOG</p>
        )}
        <h1 className="mt-3 max-w-4xl text-3xl font-extrabold leading-snug md:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-5 max-w-3xl border-s-2 border-red ps-5 text-lg font-light leading-10 text-ink-3">{post.excerpt}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-smoke">
          <span>نویسنده: تحریریه فیلم‌نما</span>
          <time dateTime={dateIso}>{formatFaDate(dateIso)}</time>
          <span>{minutes} دقیقه مطالعه</span>
        </div>
        {(category || postTags.length > 0) && (
          <nav aria-label="دسته و برچسب‌ها" className="mt-6 flex flex-wrap gap-2">
            {category && (
              <Link
                href={`/blog/?category=${encodeURIComponent(category.slug)}`}
                className="border border-line px-4 py-2 text-sm hover:text-red"
              >
                {category.title}
              </Link>
            )}
            {postTags.map((tag) => (
              <Link
                key={tag.id}
                href={`/blog/?tag=${encodeURIComponent(tag.slug)}`}
                className="border border-line px-4 py-2 text-sm hover:text-red"
              >
                {`#${tag.title}`}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {post.coverMedia && (
        <div className="container-site mt-10">
          <img
            src={mediaSrc(post.coverMedia.id)}
            alt={post.coverMedia.alt || post.title}
            className="max-h-[32rem] w-full border border-line object-cover"
            loading="eager"
          />
        </div>
      )}
      <div className="container-site py-12">
        {contentHtml.trim() ? (
          <div
            className="max-w-3xl break-words text-base leading-9 text-ink-3 [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-bold [&_p]:my-5 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:ps-6 [&_a]:underline [&_a]:decoration-red [&_a]:underline-offset-4"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : (
          <SectionHeading index="01" label="ARTICLE" title="متن مقاله" description="متن این نوشته به‌زودی منتشر می‌شود." />
        )}
        <div className="mt-12">
          <ShareButtons url={pageUrl} title={post.title} />
        </div>
      </div>
      {related.length > 0 && (
        <div className="container-site pb-16">
          <SectionHeading index="02" label="RELATED" title="نوشته‌های مرتبط" />
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <article key={item.id} className="border border-line bg-ivory-2 p-6">
                {item.coverMedia && (
                  <img
                    src={mediaSrc(item.coverMedia.id)}
                    alt={item.coverMedia.alt || item.title}
                    className="mb-4 h-40 w-full object-cover"
                    loading="lazy"
                  />
                )}
                <h2 className="text-lg font-bold leading-9">
                  <Link href={postPath(item)} className="transition-colors hover:text-red">
                    {item.title}
                  </Link>
                </h2>
                {item.excerpt && <p className="mt-3 text-sm font-light leading-8 text-smoke">{item.excerpt}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    </article>
  );
}
