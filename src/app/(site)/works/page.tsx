import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InitialTile } from "@/components/ui/InitialTile";
import { getWorks } from "@/lib/public-content";
import { mediaSrc, workPath } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

type Props = { searchParams: Promise<{ category?: string }> };

export async function generateMetadata({ searchParams }: Props) {
  const { category } = await searchParams;
  const clean = typeof category === "string" && category.trim() && category.length <= 100 ? category : undefined;
  return contentMetadata(
    clean ? `نمونه‌کارها | ${clean}` : "نمونه‌کار هنرجویان",
    "خروجی واقعی کلاس‌های فیلم‌نما",
    "/works/",
  );
}

export default async function WorksPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const clean = typeof category === "string" && category.trim() && category.length <= 100 ? category : undefined;
  const works = await getWorks(clean ? { category: clean } : undefined);
  const categories = [...new Set(works.map((work) => work.category))].slice(0, 20);

  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "نمونه‌کارها", path: "/works/" }]} />
        <SectionHeading index="01" label="STUDENT WORKS" level="h1" title="نمونه‌کار هنرجویان" description="خروجی واقعی کلاس‌ها." />
        {categories.length > 0 && (
          <nav aria-label="پالایه نمونه‌کارها" className="mt-8 flex flex-wrap gap-2">
            <Link
              href="/works/"
              aria-current={!clean ? "page" : undefined}
              className={!clean ? "border border-red bg-red px-4 py-2 text-sm text-ivory" : "border border-line px-4 py-2 text-sm hover:text-red"}
            >
              همه
            </Link>
            {categories.map((item) => (
              <Link
                key={item}
                href={`/works/?category=${encodeURIComponent(item)}`}
                aria-current={clean === item ? "page" : undefined}
                className={clean === item ? "border border-red bg-red px-4 py-2 text-sm text-ivory" : "border border-line px-4 py-2 text-sm hover:text-red"}
              >
                {item}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="container-site grid gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
        {works.map((work) => (
          <article key={work.id} className="border border-line bg-ivory-2 p-6">
            {work.media?.mimeType.startsWith("image/") && work.mediaId ? (
              // eslint-disable-next-line @next/next/no-img-element -- API hosts are not allowlisted for next/image.
              <img
                src={mediaSrc(work.mediaId)}
                alt={work.title}
                className="mb-4 aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            ) : work.media?.mimeType.startsWith("video/") && work.mediaId ? (
              <video src={mediaSrc(work.mediaId)} muted playsInline preload="metadata" className="mb-4 aspect-[16/10] w-full object-cover" />
            ) : (
              <InitialTile name={work.title} aspect="wide" className="mb-4" />
            )}
            <p className="text-xs text-smoke">{work.category}</p>
            <h2 className="mt-2 text-xl font-bold leading-8">
              <Link href={workPath(work)} className="transition-colors hover:text-red">
                {work.title}
              </Link>
            </h2>
            {work.student && <p className="mt-2 text-sm font-light text-smoke">{work.student}</p>}
          </article>
        ))}
      </div>
      {works.length === 0 && (
        <div className="container-site pb-16">
          <p className="border border-line bg-ivory-2 p-8 text-center text-sm leading-8 text-smoke">نمونه‌کاری برای نمایش وجود ندارد.</p>
        </div>
      )}
    </div>
  );
}
