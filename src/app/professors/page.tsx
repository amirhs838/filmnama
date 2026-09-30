import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contentMetadata } from "@/lib/content-seo";
import { getInstructors } from "@/lib/public-content";
import { instructorPath } from "@/lib/content-contract";

export const revalidate = 3600;

// Content comes from the backend API at request time: never prerender this
// page at build time, so `next build` does not depend on a live backend.
export const dynamic = "force-dynamic";

export function generateMetadata() {
  const meta = contentMetadata("اساتید", "اساتید آموزشگاه سینمایی فیلم نما", "/professors/");
  return { ...meta, title: { absolute: "اساتید - فیلم نما" } };
}

export default async function ProfessorsPage() {
  const instructors = await getInstructors().catch(() => []);
  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "اساتید", path: "/professors/" }]} />
        <p className="text-label-latin mt-6 text-smoke" dir="ltr">PROFESSORS</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-snug md:text-5xl">اساتید</h1>
      </div>
      <div className="container-site section-y">
        <SectionHeading index="01" label="TEACHERS" title="اساتید فیلم نما" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map((person) => (
            <li key={person.id}>
              <Link href={instructorPath(person)} className="block border border-line bg-ivory-2 p-6 transition-colors hover:border-red">
                <span className="block text-lg font-bold transition-colors hover:text-red">{person.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
