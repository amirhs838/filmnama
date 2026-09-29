import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getCourses, getDepartments } from "@/lib/content";
import { getSettings } from "@/lib/public-content";
import { canonicalUrl, contentMetadata, siteOrigin } from "@/lib/content-seo";
import { aboutPageJsonLd, breadcrumbJsonLd, faqJsonLd, organizationJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { toFaDigits } from "@/lib/utils";
import { site } from "@/data/site";

export const revalidate = 3600;

const TITLE = "درباره فیلم‌نما";
const DESCRIPTION = "فیلم‌نما آموزشگاه سینمایی است؛ با دپارتمان هنرهای نمایشی و دپارتمان مهارت‌های تخصصی، از بازیگری و فیلم‌سازی تا موسیقی، برنامه‌نویسی و زبان.";

export function generateMetadata() {
  return contentMetadata(TITLE, DESCRIPTION, "/about/");
}

const faqs = [
  {
    question: "فیلم‌نما فقط آموزش سینما می‌دهد؟",
    answer: "نه. ریشه فیلم‌نما آموزش سینماست، اما دپارتمان مهارت‌های تخصصی هم دارد: موسیقی، برنامه‌نویسی، هوش مصنوعی، IT و شبکه و زبان انگلیسی.",
  },
  {
    question: "بدون هیچ تجربه‌ای می‌توانم شروع کنم؟",
    answer: "بله. بیشتر دوره‌ها سطح مقدماتی دارند و از مبانی شروع می‌شوند؛ دوره‌های متوسط پیش‌نیازشان در همان صفحه دوره نوشته شده است. اگر مطمئن نیستید، از مشاوره استفاده کنید.",
  },
  {
    question: "چطور ثبت‌نام کنم؟",
    answer: "از فرم درخواست مشاوره در پایین همین سایت اقدام کنید یا با شماره‌های تماس آموزشگاه در ارتباط باشید تا درباره سطح، زمان‌بندی و شهریه راهنمایی بگیرید.",
  },
];

export default async function AboutPage() {
  const [departments, courses, settings] = await Promise.all([
    getDepartments().catch(() => []),
    getCourses().catch(() => []),
    getSettings().catch(() => null),
  ]);
  const contact = {
    mobile: settings?.contact.mobile || site.mobile,
    phone: settings?.contact.phone || site.phone,
    address: settings?.contact.address || site.address,
    instagram: settings?.contact.instagram || site.instagram,
  };
  const origin = siteOrigin();
  const url = canonicalUrl("/about/");
  const crumbs = [{ name: "خانه", path: "/" }, { name: TITLE, path: "/about/" }];
  const faq = faqJsonLd(faqs);

  return (
    <article className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={crumbs} />
      </div>
      <header className="noise-overlay relative bg-ink text-ivory">
        <div className="container-site section-y relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
          <div className="min-w-0">
            <p className="text-label-latin text-red" dir="ltr">ABOUT FILMNAMA</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-snug md:text-6xl">{TITLE}</h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-9 text-fog">{DESCRIPTION}</p>
            <dl className="mt-8 grid max-w-md grid-cols-2 gap-3 text-sm sm:gap-4">
              <div className="border border-line-light p-3 sm:p-4"><dt className="text-xs text-fog sm:text-sm">دپارتمان</dt><dd className="mt-2 text-xl font-bold">{toFaDigits(departments.length)}</dd></div>
              <div className="border border-line-light p-3 sm:p-4"><dt className="text-xs text-fog sm:text-sm">دوره فعال</dt><dd className="mt-2 text-xl font-bold">{toFaDigits(courses.length)}</dd></div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/courses/" className="inline-flex min-h-12 items-center bg-red px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-red-deep">مشاهده دوره‌ها</Link>
              <Link href="/#contact" className="inline-flex min-h-12 items-center border border-line-light px-6 py-3 text-sm font-medium text-ivory transition-colors hover:border-red hover:text-red">درخواست مشاوره</Link>
            </div>
          </div>
          <figure className="hidden min-w-0 border border-line-light bg-ink-2 p-8 sm:block lg:p-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="نشان فیلم‌نما" loading="eager" className="logo-mark mx-auto aspect-[3/4] w-full max-w-56 object-contain" />
          </figure>
        </div>
      </header>

      <section aria-label="داستان فیلم‌نما" className="container-site section-y">
        <SectionHeading index="01" label="OUR STORY" title="از سینما شروع شد" />
        <div className="mt-10 grid max-w-4xl gap-6 text-base font-light leading-9 text-ink-3">
          <p>فیلم‌نما یک آموزشگاه سینمایی است؛ جایی که آموزش از دل تمرین واقعی می‌آید، نه فقط جزوه و اسلاید. مسیر هر دوره از مبانی شروع می‌شود و با پروژه و بازخورد جلو می‌رود، تا هنرجو در پایان چیزی برای نشان دادن داشته باشد.</p>
          <p>در کنار سینما، دپارتمان مهارت‌های تخصصی هم داریم؛ چون دنیای امروز فقط دوربین نیست. موسیقی، برنامه‌نویسی، هوش مصنوعی، IT و زبان انگلیسی در همین‌جا و با همان منطق کارگاهی آموزش داده می‌شوند.</p>
        </div>
      </section>

      {departments.length > 0 && <section aria-label="دپارتمان‌ها" className="bg-ivory-3"><div className="container-site section-y">
        <SectionHeading index="02" label="DEPARTMENTS" title="دو دپارتمان، یک منطق" />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {departments.map((department) => (
            <Link key={department.slug} href={`/courses/${department.slug}/`} className="group border border-line bg-ivory-2 p-6 transition-colors hover:border-red">
              <p className="text-label-latin text-smoke" dir="ltr">{department.latin}</p>
              <h3 className="mt-3 text-xl font-bold transition-colors group-hover:text-red">{department.label}</h3>
              {department.description && <p className="mt-3 text-sm font-light leading-8 text-smoke">{department.description}</p>}
            </Link>
          ))}
        </div>
      </div></section>}

      <section aria-label="شیوه آموزش" className="container-site section-y">
        <SectionHeading index="03" label="HOW WE TEACH" title="شیوه ما" />
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {[["تمرین عملی", "هر مبحث با تمرین و بازبینی همراه است؛ یادگیری با انجام دادن تثبیت می‌شود."], ["مسیر شفاف", "پیش‌نیاز، سرفصل و معیار ارزیابی هر دوره از قبل روشن است و غافلگیری ندارد."], ["پروژه پایانی", "هر دوره به یک خروجی مشخص می‌رسد؛ فیلمی کوتاه، قطعه‌ای موسیقی یا برنامه‌ای قابل اجرا."]].map(([title, text]) => (
            <li key={title} className="border border-line p-6">
              <h3 className="text-lg font-bold">{title}</h3>
              <span className="mt-3 block h-px w-8 bg-red" aria-hidden />
              <p className="mt-3 text-sm font-light leading-8 text-smoke">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="پرسش‌های متداول" className="container-site section-y">
        <SectionHeading index="04" label="FAQ" title="سؤال‌های پرتکرار" />
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

      <section aria-label="تماس" className="bg-ink text-ivory"><div className="container-site section-y">
        <SectionHeading dark index="05" label="VISIT US" title="بیایید صحبت کنیم" />
        <address className="mt-10 grid max-w-3xl gap-4 text-sm font-light leading-8 text-fog not-italic">
          <p>{contact.address}</p>
          <p><a href={`tel:${contact.mobile}`} dir="ltr" className="hover:text-red">{contact.mobile}</a> · <a href={`tel:${contact.phone}`} dir="ltr" className="hover:text-red">{contact.phone}</a></p>
          <p><Link href="/#contact" className="font-bold text-ivory underline decoration-red underline-offset-8 hover:text-red">فرم درخواست مشاوره</Link></p>
        </address>
      </div></section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs, origin)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutPageJsonLd(TITLE, DESCRIPTION, url)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd({ name: site.name, url: `${origin}/`, logo: `${origin}/logo.png`, sameAs: [site.instagramUrl], telephone: contact.mobile, address: contact.address })) }} />
    </article>
  );
}
