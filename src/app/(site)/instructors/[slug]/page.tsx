import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { getInstructor } from "@/lib/public-content";
import { instructorPath } from "@/lib/content-contract";
import { contentMetadata, withCustomCanonical } from "@/lib/content-seo";

export const revalidate = 3600;

// Content comes from the backend API at request time: never prerender this
// page at build time, so `next build` does not depend on a live backend.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props["params"]) {
  const { slug } = await params;
  const instructor = await getInstructor(slug);
  if (!instructor) notFound();
  return instructor;
}

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const instructor = await load(params);
  return withCustomCanonical(contentMetadata(instructor.name, instructor.bio.slice(0, 160) || instructor.name, instructorPath(instructor)), instructor.customPath, null);
}

export default async function InstructorPage({ params }: Props) {
  const instructor = await load(params);
  const path = instructorPath(instructor);
  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "اساتید", path: "/instructors/" }, { name: instructor.name, path }]} />
        <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">{instructor.name}</h1>
        {instructor.image && (
          // Plain img: API hosts are not allowlisted for next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={instructor.image} alt={`تصویر ${instructor.name}`} className="mt-8 max-w-sm border border-line" loading="lazy" />
        )}
        <p className="mt-8 max-w-3xl whitespace-pre-line break-words text-base font-light leading-9 text-ink-3">{instructor.bio}</p>
      </div>
      <div className="container-site py-12" />
    </div>
  );
}
