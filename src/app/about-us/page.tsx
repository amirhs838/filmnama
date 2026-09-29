import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

export function generateMetadata() {
  const meta = contentMetadata(
    "درباره ما",
    "درباره ما خانه صفحه اصلی معرفی آموزشگاه آزاد سینمایی فیلم نما مجموعه بزرگ فیلم نما با فضائی مناسب و اساتید مجرب به بهترین شکل ممکن در راه آموزش صحیح اقدام",
    "/about-us/",
  );
  return { ...meta, title: { absolute: "درباره ما - فیلم نما" } };
}

// Course/teacher detail pages are managed in the CMS now — this page links
// the hubs so no link ever goes dead.
const courses = [
  { name: "بازیگری مقابل دوربین" },
  { name: "بازیگری تئاتر" },
  { name: "تدوین فیلم" },
  { name: "گویندگی" },
  { name: "فن بیان و بدن" },
  { name: "گریم سینمایی" },
  { name: "فیلمنامه نویسی" },
  { name: "عکاسی سینمایی" },
];

const teachers = [
  { name: "بهنام شعبانی مهر", role: "مدیر موسسه" },
  { name: "رامین راستاد", role: "" },
  { name: "رحیم نوروزی", role: "" },
  { name: "حدیث تهرانی", role: "" },
  { name: "کریم رجبی", role: "" },
];

const testimonials = [
  { text: "من در کلاس های بازیگری و تئاتر شرکت کردم و از اسایتد مجموعه بسیار راضی هستم،", name: "مریم", role: "هنرجوی بازیگری" },
  { text: "کلاس های عکاسی رو شرکت کردم و بسیار مفید بود", name: "وحید", role: "هنرجوی عکاسی" },
  { text: "در کلاس فن بیان شرکت کردم و از مجموعه فیلم نما تشکر فراوان رو دارم", name: "مریم", role: "هنرجوی فن بیان" },
  { text: "کلاس های تدوین فیلم رو من دوره دیدم و در بازار کار مشغول کار هستم", name: "سارینا", role: "هنرجوی تدوین فیلم" },
];

export default function AboutUsPage() {
  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "درباره ما", path: "/about-us/" }]} />
        <p className="text-label-latin mt-6 text-smoke" dir="ltr">ABOUT US</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-snug md:text-5xl">درباره ما</h1>
      </div>
      <section aria-label="معرفی آموزشگاه آزاد سینمایی فیلم نما" className="container-site section-y">
        <SectionHeading index="01" label="FILMNAMA" title="معرفی آموزشگاه آزاد سینمایی فیلم نما" />
        <div className="mt-10 grid max-w-4xl gap-6 text-base font-light leading-9 text-ink-3">
          <p>مجموعه بزرگ فیلم نما با فضائی مناسب و اساتید مجرب به بهترین شکل ممکن در راه آموزش صحیح اقدام نموده تا فارغ التحصیلان این آموزشگاه موجبات افتخار آفرینی این مجموعه را فراهم سازند</p>
          <p>مجموعه فیلم نما دارای دوره های آموزشی بازیگری مقابل دوربین و تئاتر،گریم سینمایی، آموزش تدوین و فیلمبرداری و عکاسی، فن بیان و گویندگی می باشد</p>
        </div>
      </section>
      <section aria-label="دوره های آموزشی فیلم نما" className="bg-ivory-3"><div className="container-site section-y">
        <SectionHeading index="02" label="COURSES" title="دوره های آموزشی فیلم نما" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course) => (
            <li key={course.name} className="block border border-line bg-ivory-2 p-5 text-sm font-bold">
              {course.name}
            </li>
          ))}
        </ul>
        <p className="mt-6">
          <Link href="/training-course/" className="text-sm font-bold text-ink underline decoration-red underline-offset-8 hover:text-red">
            معرفی دوره ها
          </Link>
        </p>
      </div></section>
      <section aria-label="اساتید آموزشگاه فیلم نما" className="container-site section-y">
        <SectionHeading index="03" label="TEACHERS" title="اساتید آموزشگاه فیلم نما" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => (
            <li key={teacher.name} className="border border-line p-6">
              <span className="text-lg font-bold">{teacher.name}</span>
              {teacher.role && <p className="mt-2 text-sm font-light text-smoke">{teacher.role}</p>}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="نظرات هنرجویان" className="bg-ink text-ivory"><div className="container-site section-y">
        <SectionHeading dark index="04" label="TESTIMONIALS" title="هنرجویان فیلم نما" />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {testimonials.map((item, index) => (
            <figure key={index} className="border border-line-light p-6">
              <blockquote className="text-sm font-light leading-8 text-fog">{item.text}</blockquote>
              <figcaption className="mt-4 text-sm font-bold">{item.name} <span className="font-light text-fog">— {item.role}</span></figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/training-course/" className="inline-flex min-h-12 items-center bg-red px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-red-deep">معرفی دوره ها</Link>
          <Link href="/contact-us/" className="inline-flex min-h-12 items-center border border-line-light px-6 py-3 text-sm font-medium text-ivory transition-colors hover:border-red hover:text-red">تماس با ما</Link>
        </div>
      </div></section>
    </article>
  );
}
