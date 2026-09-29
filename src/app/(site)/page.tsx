import { Hero } from "@/components/home/Hero";
import { Marquee, BrandIntro } from "@/components/home/BrandIntro";
import { Departments } from "@/components/home/Departments";
import { Courses } from "@/components/home/Courses";
import { Instructors } from "@/components/home/Instructors";
import { Gallery } from "@/components/home/Gallery";
import { StudentWorks } from "@/components/home/StudentWorks";
import { Testimonials } from "@/components/home/Testimonials";
import { CTA } from "@/components/home/CTA";

import { getCourses, getDepartments } from "@/lib/content";
import { getAlbums, getInstructors, getWorks } from "@/lib/public-content";
import { toCourseCard } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

export function generateMetadata() {
  const meta = contentMetadata(
    "فیلم نما",
    "آموزشگاه سینمایی فیلم نما در اندیشه و شهریار اولین گارگاه سینمایی با مدرک بین المللی در غرب تهران با حضور اساتید شاخص می باشد. دوره های بازیگری، تئاتر،",
    "/",
  );
  return { ...meta, title: { absolute: "فیلم نما بهترین آموزشگاه سینمایی غرب تهران" } };
}

export default async function Home() {
  const [courses, departments, instructors, albums, works] = await Promise.all([
    getCourses(),
    getDepartments(),
    getInstructors().catch(() => []),
    getAlbums().catch(() => []),
    getWorks().catch(() => []),
  ]);
  const cards = courses.map(toCourseCard);
  return (
    <>
      {/* 01 — Editorial hero */}
      <Hero />

      {/* transition band into the dark world */}
      <Marquee />

      {/* 02 — Brand story */}
      <BrandIntro />

      {/* 03 — Two worlds: cinema / tech switch */}
      <Departments courses={cards} departments={departments} />

      {/* 04 — Courses */}
      <Courses courses={cards} departments={departments} />

      {/* 05 — Instructors */}
      <Instructors items={instructors} />

      {/* 06 — Gallery */}
      <Gallery albums={albums} />

      {/* 07 — Student works */}
      <StudentWorks works={works} />

      {/* 08 — Testimonials */}
      <Testimonials />

      {/* 09 — Call to action */}
      <CTA />
    </>
  );
}
