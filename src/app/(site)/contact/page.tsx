import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ConsultationForm } from "@/components/layout/ConsultationForm";
import type { ConsultationCourse } from "@/lib/consultation";
import { getCourses } from "@/lib/content";
import { contentMetadata } from "@/lib/content-seo";
import { backendUrl, contentSource } from "@/lib/content-config";
import { breadcrumbJsonLd, faqJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { siteOrigin } from "@/lib/content-seo";
import { site } from "@/data/site";

export const revalidate = 3600;

// Content comes from the backend API at request time: never prerender this
// page at build time, so `next build` does not depend on a live backend.
export const dynamic = "force-dynamic";

const TITLE = "تماس با ما";
const DESCRIPTION = "راه‌های ارتباط با آموزشگاه سینمایی فیلم‌نما: درخواست مشاوره، تلفن و نشانی.";

export function generateMetadata() {
  return contentMetadata(TITLE, DESCRIPTION, "/contact/");
}

const faqs = [
  {
    question: "چطور ثبت‌نام کنم؟",
    answer: "فرم درخواست مشاوره همین صفحه را بفرستید یا با شماره‌های آموزشگاه تماس بگیرید تا درباره سطح، زمان‌بندی و شهریه راهنمایی بگیرید.",
  },
  {
    question: "نشانی آموزشگاه کجاست؟",
    answer: `نشانی: ${site.address}`,
  },
];

export default async function ContactPage() {
  let available = false;
  let courses: ConsultationCourse[] = [];
  let optionsUnavailable = false;
  try {
    if (contentSource() === "api") {
      backendUrl();
      available = true;
      courses = (await getCourses()).filter((course) => course.id.trim() === course.id && course.id.length <= 100).map(({ id, title }) => ({ id, title }));
      optionsUnavailable = courses.length === 0;
    }
  } catch {
    optionsUnavailable = true;
  }
  const crumbs = [{ name: "خانه", path: "/" }, { name: TITLE, path: "/contact/" }];
  const origin = siteOrigin();
  const faq = faqJsonLd(faqs);

  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={crumbs} />
      </div>
      <header className="noise-overlay relative bg-ink text-ivory">
        <div className="container-site section-y relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
          <div className="min-w-0">
            <p className="text-label-latin text-red" dir="ltr">CONTACT FILMNAMA</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-snug md:text-6xl">{TITLE}</h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-9 text-fog">{DESCRIPTION}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href={`tel:${site.mobile}`} dir="ltr" className="inline-flex min-h-12 items-center bg-red px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-red-deep">{site.mobile}</a>
              <a href={`tel:${site.phone}`} dir="ltr" className="inline-flex min-h-12 items-center border border-line-light px-6 py-3 text-sm font-medium text-ivory transition-colors hover:border-red hover:text-red">{site.phone}</a>
            </div>
          </div>
          <address className="grid min-w-0 content-center gap-4 border border-line-light bg-ink-2 p-6 text-sm font-light leading-8 text-fog not-italic sm:p-8">
            <p>{site.address}</p>
            <p><a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-ivory underline decoration-red underline-offset-8 hover:text-red"><span dir="ltr">@{site.instagram}</span></a></p>
            <p><Link href="/about/" className="text-ivory underline decoration-red underline-offset-8 hover:text-red">درباره فیلم‌نما</Link></p>
          </address>
        </div>
      </header>

      <section aria-label="پرسش‌های متداول" className="container-site section-y">
        <SectionHeading index="01" label="FAQ" title="سؤال‌های پرتکرار" />
        <div className="mt-10 max-w-3xl divide-y divide-line border-y border-line">
          {faqs.map((item) => (
            <details key={item.question} className="group py-2 open:bg-ivory-2">
              <summary className="cursor-pointer break-words px-3 py-5 text-base font-bold leading-8 marker:text-red hover:text-red">{item.question}</summary>
              <p className="whitespace-pre-line break-words px-6 pb-6 text-sm leading-8 text-ink-3">{item.answer}</p>
            </details>
          ))}
        </div>
        {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faq) }} />}
      </section>

      <div className="noise-overlay relative bg-ink text-ivory">
        <ConsultationForm available={available} courses={courses} optionsUnavailable={optionsUnavailable} />
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs, origin)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ "@context": "https://schema.org", "@type": "ContactPage", name: TITLE, description: DESCRIPTION, url: `${origin}/contact` }) }} />
    </article>
  );
}
