import Link from "next/link";
import { Phone, MapPin } from "lucide-react";
import { navLinks, site } from "@/data/site";
import { departmentMeta } from "@/data/courses";
import { toFaDigits } from "@/lib/utils";
import { getCourses } from "@/lib/content";
import { backendUrl, contentSource } from "@/lib/content-config";
import type { ConsultationCourse } from "@/lib/consultation";
import { ConsultationForm } from "./ConsultationForm";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export async function Footer() {
  let available = false;
  let courses: ConsultationCourse[] = [];
  let optionsUnavailable = false;
  let contact: { address: string; mobile: string; phone: string; instagram: string; instagramUrl: string } = { address: site.address, mobile: site.mobile, phone: site.phone, instagram: site.instagram, instagramUrl: site.instagramUrl };
  try {
    if (contentSource() === "api") {
      backendUrl();
      available = true;
      courses = (await getCourses()).filter((course) => course.id.trim() === course.id && course.id.length <= 100).map(({ id, title }) => ({ id, title }));
      optionsUnavailable = courses.length === 0;
      const { getSettings } = await import("@/lib/public-content");
      const settings = await getSettings().catch(() => null);
      if (settings) {
        contact = {
          address: settings.contact.address || site.address,
          mobile: settings.contact.mobile || site.mobile,
          phone: settings.contact.phone || site.phone,
          instagram: settings.contact.instagram || site.instagram,
          instagramUrl: site.instagramUrl,
        };
      }
    }
  } catch {
    optionsUnavailable = true;
  }
  return (
    <footer
      id="contact"
      aria-label="پانوشت و تماس"
      className="noise-overlay relative border-t border-line-light bg-ink"
    >
      <ConsultationForm available={available} courses={courses} optionsUnavailable={optionsUnavailable} />
      <div className="container-site grid gap-14 py-16 md:py-20 lg:grid-cols-12 lg:gap-10">
        {/* brand */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Link href="/#home" className="flex w-fit items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt=""
              aria-hidden
              className="logo-mark h-20 w-auto shrink-0"
            />
            <span className="flex flex-col leading-none">
              <span className="text-xl font-extrabold text-ivory">فیلم‌نما</span>
              <span className="mt-1 text-[0.65rem] font-light tracking-[0.18em] text-fog">
                آموزشگاه سینمایی
              </span>
            </span>
          </Link>
          <p className="max-w-sm text-sm font-light leading-8 text-fog">
            {site.tagline} دو دپارتمان، دوازده دوره تخصصی و یک مسیر واقعی به
            دنیای حرفه‌ای‌ها.
          </p>
          <a
            href={contact.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-fit items-center gap-3 text-sm text-fog transition-colors hover:text-ivory"
            aria-label={`اینستاگرام فیلم‌نما: ${contact.instagram}`}
          >
            <span className="grid size-10 place-items-center border border-line-light transition-colors group-hover:border-red group-hover:text-red">
              <InstagramIcon className="size-4.5" />
            </span>
            <span dir="ltr">{contact.instagram}@</span>
          </a>
        </div>

        {/* quick links */}
        <nav aria-label="دسترسی سریع" className="lg:col-span-2">
          <h3 className="flex items-center gap-3 text-[0.8rem] font-bold text-ivory">
            <span className="size-1.5 bg-red" aria-hidden />
            دسترسی سریع
          </h3>
          <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[0.85rem] font-light text-fog transition-colors hover:text-red"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* departments */}
        <div className="lg:col-span-2">
          <h3 className="flex items-center gap-3 text-[0.8rem] font-bold text-ivory">
            <span className="size-1.5 bg-red" aria-hidden />
            دپارتمان‌ها
          </h3>
          <ul className="mt-6 space-y-3">
            <li>
              <Link
                href="/#departments"
                className="text-[0.85rem] font-light text-fog transition-colors hover:text-red"
              >
                {departmentMeta.cinema.label}
              </Link>
            </li>
            <li>
              <Link
                href="/#departments"
                className="text-[0.85rem] font-light text-fog transition-colors hover:text-red"
              >
                {departmentMeta.tech.label}
              </Link>
            </li>
          </ul>
        </div>

        {/* site guide */}
        <nav aria-label="راهنمای سایت" className="lg:col-span-2">
          <h3 className="flex items-center gap-3 text-[0.8rem] font-bold text-ivory">
            <span className="size-1.5 bg-red" aria-hidden />
            راهنمای سایت
          </h3>
          <ul className="mt-6 space-y-3">
            {[
              { href: "/training-course/", label: "معرفی دوره ها" },
              { href: "/professors/", label: "اساتید" },
              { href: "/ساخته-های-فیلم-نما/", label: "ساخته های فیلم نما" },
              { href: "/گالری-ویدیوهای-دورهها/", label: "گالری ویدیوهای دوره‌ها" },
              { href: "/blog/", label: "اطلاعیه و اخبار" },
              { href: "/about-us/", label: "درباره ما" },
              { href: "/contact-us/", label: "تماس با ما" },
              { href: "/faq/", label: "سوالات متداول" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[0.85rem] font-light text-fog transition-colors hover:text-red"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* contact */}
        <address className="not-italic lg:col-span-2">
          <h3 className="flex items-center gap-3 text-[0.8rem] font-bold text-ivory">
            <span className="size-1.5 bg-red" aria-hidden />
            تماس
          </h3>
          <ul className="mt-6 space-y-5">
            <li className="flex gap-3">
              <MapPin className="mt-1 size-4 shrink-0 text-red" strokeWidth={1.5} aria-hidden />
              <p className="text-[0.8rem] font-light leading-7 text-fog">
                {contact.address}
              </p>
            </li>
            <li>
              <a
                href={`tel:${contact.mobile}`}
                className="flex w-fit items-center gap-3 text-fog transition-colors hover:text-ivory"
              >
                <Phone className="size-4 shrink-0 text-red" strokeWidth={1.5} aria-hidden />
                <span className="flex flex-col">
                  <span className="text-[0.65rem] text-fog/70">موبایل</span>
                  <span dir="ltr" className="text-[0.85rem]">
                    {contact.mobile}
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a
                href={`tel:${contact.phone}`}
                className="flex w-fit items-center gap-3 text-fog transition-colors hover:text-ivory"
              >
                <Phone className="size-4 shrink-0 text-red" strokeWidth={1.5} aria-hidden />
                <span className="flex flex-col">
                  <span className="text-[0.65rem] text-fog/70">تلفن ثابت</span>
                  <span dir="ltr" className="text-[0.85rem]">
                    {contact.phone}
                  </span>
                </span>
              </a>
            </li>
          </ul>
        </address>
      </div>

      {/* bottom bar */}
      <div className="border-t border-line-light">
        <div className="container-site flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
          <p className="text-[0.75rem] font-light text-fog">
            © {toFaDigits(1405)} {site.name} — تمامی حقوق محفوظ است.
          </p>
          <p className="text-label-latin text-fog/60" dir="ltr">
            LEARN · EXPERIENCE · CREATE
          </p>
        </div>
      </div>
    </footer>
  );
}
