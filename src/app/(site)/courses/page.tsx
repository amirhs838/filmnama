import { Courses } from "@/components/home/Courses";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { getCourses, getDepartments } from "@/lib/content";
import { toCourseCard } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

// Content comes from the backend API at request time: never prerender this
// page at build time, so `next build` does not depend on a live backend.
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return contentMetadata("دوره‌های آموزشی", "مسیرهای آموزشی فیلم‌نما در هنرهای نمایشی و مهارت‌های تخصصی", "/courses/");
}

export default async function CoursesPage() {
  const [courses, departments] = await Promise.all([getCourses(), getDepartments()]);
  return (
    <div className="pt-32 lg:pt-40">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "دوره‌ها", path: "/courses/" }]} />
        <h1 className="text-3xl font-extrabold md:text-5xl">دوره‌های آموزشی</h1>
        <nav aria-label="دپارتمان‌ها" className="mt-8 flex flex-wrap gap-6">
          {departments.map((department) => <a key={department.id} href={`/courses/${department.slug}/`} className="border-b border-red/50 pb-2 text-sm transition-colors hover:text-red">{department.label}</a>)}
        </nav>
      </div>
      <Courses courses={courses.map(toCourseCard)} departments={departments} />
    </div>
  );
}
