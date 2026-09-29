import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InitialTile } from "@/components/ui/InitialTile";
import { getCategories, getPosts, getTags } from "@/lib/public-content";
import { isSlug, mediaSrc, postPath } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

type Props = { searchParams: Promise<{ category?: string; tag?: string }> };

function clean(value: unknown): string | undefined {
  return typeof value === "string" && isSlug(value) ? value : undefined;
}

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams;
  const category = clean(params.category);
  const tag = clean(params.tag);
  const suffix = [category, tag].filter(Boolean).join(" · ");
  const meta = contentMetadata(
    suffix ? `بلاگ | ${suffix}` : "بلاگ",
    "نوشته‌ها و یادداشت‌های آموزشی فیلم‌نما",
    "/blog/",
  );
  return suffix ? meta : { ...meta, title: { absolute: "اطلاعیه و اخبار – فیلم نما" } };
}

export default async function BlogPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = clean(params.category);
  const tag = clean(params.tag);
  const [posts, categories, tags] = await Promise.all([getPosts({ category, tag }), getCategories(), getTags()]);

  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "بلاگ", path: "/blog/" }]} />
        {/* H1 keeps the exact WP hub heading (migration: same-URL KEEP). */}
        <SectionHeading index="01" label="BLOG" level="h1" title="اطلاعیه و اخبار" description="یادداشت‌ها و مقاله‌های آموزشی." />
        <nav aria-label="پالایه بلاگ" className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/blog/"
            aria-current={!category && !tag ? "page" : undefined}
            className={!category && !tag ? "border border-red bg-red px-4 py-2 text-sm text-ivory" : "border border-line px-4 py-2 text-sm hover:text-red"}
          >
            همه
          </Link>
          {categories.map((item) => (
            <Link
              key={item.id}
              href={`/blog/?category=${encodeURIComponent(item.slug)}`}
              aria-current={category === item.slug ? "page" : undefined}
              className={category === item.slug ? "border border-red bg-red px-4 py-2 text-sm text-ivory" : "border border-line px-4 py-2 text-sm hover:text-red"}
            >
              {item.title}
            </Link>
          ))}
          {tags.map((item) => (
            <Link
              key={item.id}
              href={`/blog/?tag=${encodeURIComponent(item.slug)}`}
              aria-current={tag === item.slug ? "page" : undefined}
              className={tag === item.slug ? "border border-red bg-red px-4 py-2 text-sm text-ivory" : "border border-line px-4 py-2 text-sm hover:text-red"}
            >
              {`#${item.title}`}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container-site grid gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id} className="border border-line bg-ivory-2 p-6">
            {post.coverMedia ? (
              <img
                src={mediaSrc(post.coverMedia.id)}
                alt={post.coverMedia.alt || post.title}
                className="mb-4 h-40 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <InitialTile name={post.title} aspect="wide" className="mb-4 h-40" />
            )}
            <h2 className="text-xl font-bold leading-9">
              <Link href={postPath(post)} className="transition-colors hover:text-red">
                {post.title}
              </Link>
            </h2>
            {post.excerpt && <p className="mt-3 text-sm font-light leading-8 text-smoke">{post.excerpt}</p>}
            <Link href={postPath(post)} className="mt-4 inline-block text-sm font-bold text-red underline underline-offset-8">
              خواندن مقاله
            </Link>
          </article>
        ))}
      </div>
      {posts.length === 0 && (
        <div className="container-site pb-16">
          <p className="border border-line bg-ivory-2 p-8 text-center text-sm leading-8 text-smoke">در حال حاضر نوشته‌ای منتشر نشده است.</p>
        </div>
      )}
    </div>
  );
}
