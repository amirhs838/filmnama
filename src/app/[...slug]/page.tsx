import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contentMetadata } from "@/lib/content-seo";
import { resolveCustomPath } from "@/lib/custom-paths";
import works from "@/data/wp/works.json";
import CoursePage, { generateMetadata as courseMetadata } from "@/app/(site)/courses/[department-slug]/[course-slug]/page";
import InstructorPage, { generateMetadata as instructorMetadata } from "@/app/(site)/instructors/[slug]/page";
import BlogPostPage, { generateMetadata as postMetadata } from "@/app/(site)/blog/[slug]/page";
import WorkPage, { generateMetadata as workMetadata } from "@/app/(site)/works/[slug]/page";

export const revalidate = 3600;

interface WorkEntry {
  path: string;
  title: string;
  h1: string;
  content_type: string;
  description: string;
}

const workEntries = works as WorkEntry[];

// Persian hub pages. Unknown slugs fall through to the custom-path resolver
// below, then to notFound() — never the homepage (no soft 404s).
const HUBS: Record<string, { title: string; heading: string; label: string; description: string }> = {
  "/استادها/": {
    title: "استادها - فیلم نما",
    heading: "استادها",
    label: "OSTADHA",
    description: "استادهای آموزشگاه سینمایی فیلم نما",
  },
  "/ساخته-های-فیلم-نما/": {
    title: "ساخته های فیلم نما - فیلم نما",
    heading: "ساخته های فیلم نما",
    label: "WORKS",
    description: "فیلم‌ها و ساخته‌های هنرجویان فیلم نما",
  },
  "/گالری-ویدیوهای-دورهها/": {
    title: "گالری ویدئو‌های دوره‌ها - فیلم نما",
    heading: "گالری ویدیو‌های دوره‌ها",
    label: "COURSE VIDEOS",
    description: "ویدیوهای کلاس‌ها و دوره‌های فیلم نما",
  },
};

export function generateStaticParams() {
  return Object.keys(HUBS).map((path) => ({
    slug: [path.replace(/^\/|\/$/g, "")],
  }));
}

type Props = { params: Promise<{ slug: string[] }> };

function resolvePath(slug: string[]): string {
  return `/${slug.map((s) => decodeURIComponent(s)).join("/")}/`;
}

export async function generateMetadata({ params }: Props) {
  const slug = (await params).slug;
  const hub = HUBS[resolvePath(slug)];
  if (hub) {
    const meta = contentMetadata(hub.heading, hub.description, resolvePath(slug));
    return { ...meta, title: { absolute: hub.title } };
  }
  const resolved = await resolveCustomPath(slug).catch(() => null);
  if (!resolved) return {};
  if (resolved.kind === "course")
    return courseMetadata({ params: Promise.resolve({ "department-slug": resolved.department!, "course-slug": resolved.slug }) });
  if (resolved.kind === "instructor")
    return instructorMetadata({ params: Promise.resolve({ slug: resolved.slug }) });
  if (resolved.kind === "post")
    return postMetadata({ params: Promise.resolve({ slug: resolved.slug }) });
  return workMetadata({ params: Promise.resolve({ slug: resolved.slug }) });
}

export default async function CustomPathPage({ params }: Props) {
  const slug = (await params).slug;
  const path = resolvePath(slug);
  const hub = HUBS[path];
  if (hub) {
    const videos = workEntries.filter((work) => work.content_type === "video");
    const items = workEntries.filter((work) => work.content_type === "work");
    return (
      <article className="pt-32 lg:pt-40" dir="rtl">
        <div className="container-site">
          <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: hub.heading, path }]} />
          <p className="text-label-latin mt-6 text-smoke" dir="ltr">{hub.label}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-snug md:text-5xl">{hub.heading}</h1>
          <p className="mt-5 max-w-2xl text-base font-light leading-9 text-smoke">{hub.description}</p>
        </div>
        <div className="container-site section-y">
          <SectionHeading index="01" label={hub.label} title={hub.heading} />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(path === "/گالری-ویدیوهای-دورهها/" ? videos : [...videos, ...items]).map((work) => (
              <Link key={work.path} href={work.path} className="group block border border-line bg-ivory-2 p-6 transition-colors hover:border-red">
                <h2 className="text-lg font-bold leading-9 transition-colors group-hover:text-red">{work.h1}</h2>
              </Link>
            ))}
          </div>
        </div>
      </article>
    );
  }
  const resolved = await resolveCustomPath(slug).catch(() => null);
  if (!resolved) notFound();
  if (resolved.kind === "course")
    return <CoursePage params={Promise.resolve({ "department-slug": resolved.department!, "course-slug": resolved.slug })} />;
  if (resolved.kind === "instructor")
    return <InstructorPage params={Promise.resolve({ slug: resolved.slug })} />;
  if (resolved.kind === "post")
    return <BlogPostPage params={Promise.resolve({ slug: resolved.slug })} />;
  return <WorkPage params={Promise.resolve({ slug: resolved.slug })} />;
}
