import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InitialTile } from "@/components/ui/InitialTile";
import { getInstructors } from "@/lib/public-content";
import { instructorPath } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

export function generateMetadata() {
  return contentMetadata("اساتید", "مدرسان و اساتید فیلم‌نما", "/instructors/");
}

export default async function InstructorsPage() {
  const instructors = await getInstructors();
  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "اساتید", path: "/instructors/" }]} />
        <SectionHeading index="01" label="INSTRUCTORS" level="h1" title="اساتید فیلم‌نما" description="کسانی که خودشان در صنعت کار می‌کنند." />
      </div>
      <div className="container-site grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {instructors.map((person) => {
          const portrait = person.image && (person.image.startsWith("/") || person.image.startsWith("https://")) ? person.image : null;
          return (
          <article key={person.id} className="border border-line bg-ivory-2 p-6">
            {portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait} alt={`تصویر ${person.name}`} loading="lazy" className="mb-4 aspect-[3/4] w-full object-cover grayscale" />
            ) : (
              <InitialTile name={person.name} aspect="portrait" className="mb-4" />
            )}
            <h2 className="text-xl font-bold">
              <Link href={instructorPath(person)} className="transition-colors hover:text-red">
                {person.name}
              </Link>
            </h2>
            <p className="mt-3 whitespace-pre-line break-words text-sm font-light leading-8 text-smoke">{person.bio}</p>
          </article>
          );
        })}
      </div>
      {instructors.length === 0 && (
        <div className="container-site pb-16">
          <p className="border border-line bg-ivory-2 p-8 text-center text-sm leading-8 text-smoke">فهرست اساتید به‌زودی منتشر می‌شود.</p>
        </div>
      )}
    </div>
  );
}
