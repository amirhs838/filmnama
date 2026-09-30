import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contentMetadata } from "@/lib/content-seo";
import { getCourses } from "@/lib/content";
import { coursePath, toCourseCard } from "@/lib/content-contract";

export const revalidate = 3600;

// Content comes from the backend API at request time: never prerender this
// page at build time, so `next build` does not depend on a live backend.
export const dynamic = "force-dynamic";

export function generateMetadata() {
  const meta = contentMetadata("معرفی دوره ها", "دوره های آموزشی آموزشگاه سینمایی فیلم نما", "/training-course/");
  return { ...meta, title: { absolute: "معرفی دوره ها - فیلم نما" } };
}

export default async function TrainingCoursePage() {
  const cards = (await getCourses().catch(() => [])).map(toCourseCard);
  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "معرفی دوره ها", path: "/training-course/" }]} />
        <p className="text-label-latin mt-6 text-smoke" dir="ltr">TRAINING COURSES</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-snug md:text-5xl">معرفی دوره ها</h1>
      </div>
      <section aria-label="دوره های آموزشی" className="container-site section-y">
        <SectionHeading index="01" label="COURSES" title="دوره های آموزشی" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((course) => (
            <Link key={course.id} href={coursePath(course)} className="group block border border-line bg-ivory-2 p-6 transition-colors hover:border-red">
              <h2 className="text-lg font-bold leading-9 transition-colors group-hover:text-red">{course.title}</h2>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
