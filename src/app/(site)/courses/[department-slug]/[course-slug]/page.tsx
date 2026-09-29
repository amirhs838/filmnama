import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getCourse, getDepartment } from "@/lib/content";
import { coursePath, mediaSrc } from "@/lib/content-contract";
import { sanitizeCourseHtml } from "@/lib/course-html";
import { backendUrl } from "@/lib/content-config";
import { canonicalUrl, contentMetadata, withCustomCanonical } from "@/lib/content-seo";
import { courseJsonLd, faqJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { toFaDigits } from "@/lib/utils";

type Props = { params: Promise<{ "department-slug": string; "course-slug": string }> };
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

async function load(params: Props["params"]) {
  const route = await params;
  const [department, course] = await Promise.all([getDepartment(route["department-slug"]), getCourse(route["department-slug"], route["course-slug"])]);
  if (!department || !course) notFound();
  return { department, course };
}

export async function generateMetadata({ params }: Props) {
  const { course } = await load(params);
  const images = course.coverMedia ? [new URL(course.coverMedia.url, backendUrl()).href] : undefined;
  return withCustomCanonical(contentMetadata(course.title, course.description, coursePath(course), course.seo, images), course.customPath, course.seo.canonicalUrl);
}

export default async function CoursePage({ params }: Props) {
  const { department, course } = await load(params);
  const path = coursePath(course);
  const faq = faqJsonLd(course.faq);
  const contentHtml = sanitizeCourseHtml(course.contentHtml);
  const sections = [
    { id: "overview", title: "درباره این دوره", visible: Boolean(contentHtml.trim()) },
    { id: "syllabus", title: "سرفصل‌های دوره", visible: course.syllabus.length > 0 },
    { id: "instructors", title: "مدرسان دوره", visible: course.instructors.length > 0 },
    { id: "faq", title: "پرسش‌های متداول", visible: Boolean(faq) },
    { id: "enrollment", title: "راهنمای ثبت‌نام", visible: true },
  ].filter((section) => section.visible);
  const sectionIndex = (id: string) => String(sections.findIndex((section) => section.id === id) + 1).padStart(2, "0");

  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "دوره‌ها", path: "/courses/" }, { name: department.label, path: `/courses/${department.slug}/` }, { name: course.title, path }]} />
      </div>
      <header className="noise-overlay relative bg-ink text-ivory">
        <div className="container-site section-y relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <div className="min-w-0">
            <p className="text-label-latin text-red" dir="ltr">{course.latin}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-snug md:text-6xl">{course.title}</h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-9 text-fog">{course.description}</p>
            <dl className="mt-8 grid grid-cols-3 gap-3 text-sm sm:gap-4">
              <div className="border border-line-light p-3 sm:p-4"><dt className="text-xs text-fog sm:text-sm">دپارتمان</dt><dd className="mt-2 leading-7"><Link href={`/courses/${department.slug}/`} className="hover:text-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory">{department.label}</Link></dd></div>
              {course.duration && <div className="border border-line-light p-3 sm:p-4"><dt className="text-xs text-fog sm:text-sm">مدت دوره</dt><dd className="mt-2 leading-7">{toFaDigits(course.duration)}</dd></div>}
              {course.level && <div className="border border-line-light p-3 sm:p-4"><dt className="text-xs text-fog sm:text-sm">سطح دوره</dt><dd className="mt-2 leading-7">{course.level}</dd></div>}
            </dl>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href={`/?course=${encodeURIComponent(course.id)}#contact`} className="inline-flex min-h-12 items-center bg-red px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-red-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory">مشاوره و اطلاعات ثبت‌نام</a>
              {course.syllabus.length > 0 && <a href="#syllabus" className="inline-flex min-h-12 items-center text-sm font-bold text-fog underline decoration-red underline-offset-8 transition-colors hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory">مشاهده سرفصل‌ها</a>}
            </div>
          </div>
          {course.coverMedia && (
            <figure className="min-w-0 border border-line-light bg-ink-2 p-3">
              <img
                src={mediaSrc(course.coverMedia.id)}
                alt={course.coverMedia.alt || course.title}
                className="aspect-[4/3] w-full object-cover"
                loading="eager"
              />
            </figure>
          )}
        </div>
      </header>
      <div className="container-site grid gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16 lg:py-24">
        <aside className="min-w-0 lg:order-last">
          <div className="border border-line bg-ivory-2 p-6 lg:sticky lg:top-32">
            <nav aria-label="راهنمای محتوای دوره">
              <p className="mb-5 text-sm font-bold">در این صفحه</p>
              <ol className="space-y-2">
                {sections.map((section) => <li key={section.id}>
                  <a href={`#${section.id}`} className="flex min-h-11 items-center gap-4 py-2 text-sm leading-7 transition-colors hover:text-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red">
                    <span className="text-smoke" aria-hidden="true">{toFaDigits(sectionIndex(section.id))}</span>
                    {section.title}
                  </a>
                </li>)}
              </ol>
            </nav>
            <p className="mt-6 border-t border-line pt-6 text-sm leading-8 text-smoke">برای انتخاب مسیر متناسب با تجربه و هدف خود، با آموزش فیلم‌نما گفت‌وگو کنید.</p>
            <a href={`/?course=${encodeURIComponent(course.id)}#contact`} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold underline decoration-red underline-offset-8 hover:text-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red">ارتباط با آموزش</a>
          </div>
        </aside>
        <div className="min-w-0 space-y-16 lg:space-y-24">
          {contentHtml.trim() && <section id="overview" aria-label="درباره این دوره" className="scroll-mt-32">
            <SectionHeading index={sectionIndex("overview")} label="ABOUT THE COURSE" title="درباره این دوره" />
            <div
              className="mt-10 break-words text-base leading-9 text-ink-3 [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-bold [&_h4]:mb-3 [&_h4]:mt-6 [&_h4]:font-bold [&_h5]:font-bold [&_h6]:font-bold [&_p]:my-5 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:my-2 [&_li]:ps-2 [&_li::marker]:text-red [&_strong]:font-bold [&_blockquote]:my-6 [&_blockquote]:border-s-2 [&_blockquote]:border-red [&_blockquote]:ps-5 [&_blockquote]:text-smoke [&_hr]:my-8 [&_hr]:border-line [&_a]:underline [&_a]:decoration-red [&_a]:underline-offset-4 [&_a:hover]:text-red [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-red [&>:first-child]:mt-0"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </section>}
          {course.syllabus.length > 0 && <section id="syllabus" aria-label="سرفصل‌های دوره" className="scroll-mt-32">
            <SectionHeading index={sectionIndex("syllabus")} label="SYLLABUS" title="سرفصل‌های دوره" />
            <ol className="mt-10 list-decimal divide-y divide-line border-y border-line ps-8 marker:font-bold marker:text-red">
              {course.syllabus.map((item, index) => <li key={index} className="break-words py-5 ps-4 text-sm leading-8">{item}</li>)}
            </ol>
          </section>}
          {course.instructors.length > 0 && <section id="instructors" aria-label="مدرسان دوره" className="scroll-mt-32">
            <SectionHeading index={sectionIndex("instructors")} label="INSTRUCTORS" title="مدرسان دوره" />
            <div className="mt-10 grid gap-6 md:grid-cols-2">{course.instructors.map((instructor) => <div key={instructor.id} className="border border-line bg-ivory-3 p-6"><h3 className="text-xl font-bold">{instructor.name}</h3><p className="mt-4 whitespace-pre-line break-words text-sm font-light leading-8 text-smoke">{instructor.bio}</p></div>)}</div>
          </section>}
          {faq && <section id="faq" aria-label="پرسش‌های متداول" className="scroll-mt-32">
            <SectionHeading index={sectionIndex("faq")} label="FAQ" title="پرسش‌های متداول" />
            <div className="mt-10 divide-y divide-line border-y border-line">
              {course.faq.map((item, index) => <details key={index} className="group py-2 open:bg-ivory-2">
                <summary className="cursor-pointer break-words px-3 py-5 text-base font-bold leading-8 marker:text-red hover:text-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red">{item.question}</summary>
                <p className="whitespace-pre-line break-words px-6 pb-6 text-sm leading-8 text-ink-3">{item.answer}</p>
              </details>)}
            </div>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faq) }} />
          </section>}
          <section id="enrollment" aria-label="راهنمای ثبت‌نام" className="scroll-mt-32 border-t border-line pt-12">
            <SectionHeading index={sectionIndex("enrollment")} label="NEXT STEP" title="راهنمای ثبت‌نام" />
            <p className="mt-8 max-w-2xl text-base leading-9 text-ink-3">برای آگاهی از شرایط شرکت در دوره {course.title}، زمان‌بندی، شهریه و ظرفیت، با آموزش فیلم‌نما تماس بگیرید. هدف یادگیری و تجربه قبلی خود را مطرح کنید تا درباره پیش‌نیازها و انتخاب سطح مناسب راهنمایی بگیرید.</p>
            <a href={`/?course=${encodeURIComponent(course.id)}#contact`} className="mt-8 inline-flex min-h-12 items-center bg-red px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-red-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red">دریافت مشاوره ثبت‌نام</a>
          </section>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(courseJsonLd(course, canonicalUrl(path, course.seo.canonicalUrl))) }} />
    </article>
  );
}
