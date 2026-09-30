import { notFound } from "next/navigation";
import { Courses } from "@/components/home/Courses";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { getCourses, getDepartment } from "@/lib/content";
import { toCourseCard } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

type Props = { params: Promise<{ "department-slug": string }> };
export const revalidate = 3600;

// Content comes from the backend API at request time: never prerender this
// page at build time, so `next build` does not depend on a live backend.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const department = await getDepartment((await params)["department-slug"]);
  if (!department) notFound();
  return contentMetadata(department.label, department.description, `/courses/${department.slug}/`);
}

export default async function DepartmentPage({ params }: Props) {
  const department = await getDepartment((await params)["department-slug"]);
  if (!department) notFound();
  const courses = await getCourses(department.slug);
  return (
    <div className="pt-32 lg:pt-40">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "دوره‌ها", path: "/courses/" }, { name: department.label, path: `/courses/${department.slug}/` }]} />
        <p className="text-label-latin text-red" dir="ltr">{department.latin}</p>
        <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">{department.label}</h1>
        <p className="mt-6 max-w-2xl text-sm font-light leading-8 text-smoke">{department.description}</p>
      </div>
      <Courses courses={courses.map(toCourseCard)} departments={[department]} initialFilter={department.slug} />
    </div>
  );
}
