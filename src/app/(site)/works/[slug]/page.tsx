import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { getWork } from "@/lib/public-content";
import { mediaSrc, workPath } from "@/lib/content-contract";
import { sanitizeCourseHtml } from "@/lib/course-html";
import { contentMetadata, withCustomCanonical } from "@/lib/content-seo";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props["params"]) {
  const { slug } = await params;
  const work = await getWork(slug);
  if (!work) notFound();
  return work;
}

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const work = await load(params);
  return withCustomCanonical(contentMetadata(work.title, work.student || work.title, workPath(work), work.seo), work.customPath, work.seo.canonicalUrl);
}

export default async function WorkPage({ params }: Props) {
  const work = await load(params);
  const path = workPath(work);
  const contentHtml = sanitizeCourseHtml(work.contentHtml);
  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "نمونه‌کارها", path: "/works/" }, { name: work.title, path }]} />
        <p className="text-sm text-smoke">{work.category}</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-snug md:text-5xl">{work.title}</h1>
        {work.student && <p className="mt-4 text-base font-light text-smoke">{work.student}</p>}
      </div>
      {work.mediaId && work.media && work.media.mimeType.startsWith("image/") && (
        <div className="container-site pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaSrc(work.mediaId)} alt={work.media.alt || work.title} loading="lazy" className="aspect-[16/9] w-full border border-line object-cover" />
        </div>
      )}
      {work.mediaId && work.media && work.media.mimeType.startsWith("video/") && (
        <div className="container-site pb-4">
          <video src={mediaSrc(work.mediaId)} controls preload="metadata" className="aspect-video w-full border border-line bg-ink" aria-label={work.media.alt || work.title} />
        </div>
      )}
      {contentHtml.trim() && (
        <div className="container-site py-12">
          <div
            className="max-w-3xl break-words text-base leading-9 text-ink-3 [&_p]:my-5 [&_a]:underline [&_a]:decoration-red [&_a]:underline-offset-4"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      )}
      {!contentHtml.trim() && <div className="container-site py-12" />}
    </div>
  );
}
