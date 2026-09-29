"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Play, ChevronRight, ChevronLeft } from "lucide-react";
import { studentWorks, workCategories, type WorkCategory } from "@/data/works";
import Link from "next/link";
import { SectionCarousel } from "@/components/ui/SectionCarousel";
import { mediaSrc, workPath } from "@/lib/content-contract";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InitialTile } from "@/components/ui/InitialTile";
import { SectionDecor } from "@/components/ui/SectionDecor";
import { EASE_OUT } from "@/components/ui/Reveal";
import { cn, toFaDigits } from "@/lib/utils";

export interface StudentWorkCardItem { id: string; slug: string; title: string; student: string; category: string; mediaId: string | null; media: { mimeType: string; alt: string } | null }

export function StudentWorks({ works }: { works?: StudentWorkCardItem[] }) {
  const apiWorks = works && works.length > 0 ? works : null;
  const [category, setCategory] = useState<WorkCategory>("همه");
  const scroller = useRef<HTMLDivElement>(null);

  const visible =
    category === "همه"
      ? studentWorks
      : studentWorks.filter((w) => w.category === category);

  const scrollBy = (dir: 1 | -1) => {
    // RTL: scrolling "forward" is toward negative X
    scroller.current?.scrollBy({ left: dir * -320, behavior: "smooth" });
  };

  if (apiWorks) {
    return (
      <section id="works" aria-label="نمونه‌کار هنرجویان" className="noise-overlay section-y relative overflow-hidden bg-ink-2">
        <div className="grid-bg-light absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent_75%)]" aria-hidden />
        <SectionDecor dark variant="b" />
        <div className="container-site relative">
          <SectionHeading
            dark
            index="06"
            label="STUDENT WORKS"
            title="نمونه‌کار هنرجویان"
            description="خروجی واقعی کلاس‌ها؛ از فیلم کوتاه و گریم تا کد و هوش مصنوعی."
          />
          <div className="mt-10">
            <SectionCarousel
              label="نمونه‌کار هنرجویان"
              count={Math.min(apiWorks.length, 6)}
              tone="ink-2"
              trackClassName="gap-5 md:grid-cols-2 lg:grid-cols-3"
              itemClassName="w-[82%] sm:w-[46%]"
              spacerClassName="before:w-[calc(9%-1.25rem)] after:w-[calc(9%-1.25rem)] sm:before:w-[calc(27%-1.25rem)] sm:after:w-[calc(27%-1.25rem)]"
              items={apiWorks.slice(0, 6).map((work, i) => (
              <article key={work.id} className="group h-full border border-line-light p-6">
                {work.mediaId && work.media?.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(work.mediaId)} alt={work.media.alt || work.title} loading="lazy" className="mb-4 aspect-[16/10] w-full object-cover" />
                ) : !work.mediaId ? (
                  <InitialTile name={work.title} aspect="wide" tone="dark" className="mb-4" />
                ) : null}
                {work.mediaId && work.media?.mimeType.startsWith("video/") && (
                  <Link href={workPath(work)} aria-label={`تماشای ${work.title}`} className="relative mb-4 block">
                    <video src={mediaSrc(work.mediaId)} muted playsInline preload="metadata" className="aspect-[16/10] w-full object-cover" />
                    <span aria-hidden className="absolute inset-0 grid place-items-center">
                      <span className="grid size-12 place-items-center rounded-full bg-ink/70 text-ivory transition-colors group-hover:bg-red">▶</span>
                    </span>
                  </Link>
                )}
                <p className="text-xs text-fog/70">{work.category}</p>
                <h3 className="mt-2 text-[0.95rem] font-bold text-ivory transition-colors group-hover:text-red">
                  <Link href={workPath(work)}>{work.title}</Link>
                </h3>
                {work.student && <p className="mt-1 text-[0.75rem] font-light text-fog">{work.student}</p>}
                <span className="text-label-latin mt-3 block text-fog/60" dir="ltr">
                  {toFaDigits(String(i + 1).padStart(2, "0"))}
                </span>
              </article>
              ))}
            />
          </div>
          <p className="mt-8 text-center text-sm text-fog">
            <Link href="/works/" className="border-b border-red/50 text-ivory transition-colors hover:border-red hover:text-red">
              مشاهده همه نمونه‌کارها
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="works"
      aria-label="نمونه‌کار هنرجویان"
      className="noise-overlay section-y relative overflow-hidden bg-ink-2"
    >
      <div
        className="grid-bg-light absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent_75%)]"
        aria-hidden
      />
      <SectionDecor dark variant="b" />
      <div className="container-site relative">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            dark
            index="06"
            label="STUDENT WORKS"
            title="نمونه‌کار هنرجویان"
            description="خروجی واقعی کلاس‌ها؛ از فیلم کوتاه و گریم تا کد و هوش مصنوعی."
          />

          {/* scroller controls */}
          <div className="hidden gap-2 lg:flex">
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="نمونه‌کارهای بعدی"
              className="grid size-11 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:text-red"
            >
              <ChevronRight className="size-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="نمونه‌کارهای قبلی"
              className="grid size-11 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:text-red"
            >
              <ChevronLeft className="size-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* category filter */}
        <div
          role="tablist"
          aria-label="دسته‌بندی نمونه‌کارها"
          className="no-scrollbar mt-10 flex gap-2 overflow-x-auto pb-1"
        >
          {workCategories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "h-9 shrink-0 border px-4 text-[0.78rem] transition-colors duration-300",
                category === c
                  ? "border-red bg-red text-ivory"
                  : "border-line-light text-fog hover:border-ivory/40 hover:text-ivory"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* horizontal gallery */}
      <div className="relative mt-12">
        <div
          ref={scroller}
          className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 pe-[max(1.25rem,calc((100vw-1440px)/2+3.5rem))] ps-[max(1.25rem,calc((100vw-1440px)/2+3.5rem))]"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((work, i) => (
              <motion.article
                layout
                key={work.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.45, delay: i * 0.04, ease: EASE_OUT }}
                className="group w-72 shrink-0 snap-start md:w-80"
              >
                <div className="relative aspect-[8/5] overflow-hidden bg-ink-3">
                  <Image
                    src={work.image}
                    alt={work.title}
                    fill
                    sizes="(max-width: 768px) 288px, 320px"
                    className="object-cover grayscale transition-all duration-700 ease-(--ease-out-expo) group-hover:scale-[1.05] group-hover:grayscale-0"
                  />
                  {/* play badge for video works */}
                  {work.isVideo && (
                    <span
                      className="absolute inset-0 grid place-items-center"
                      aria-hidden
                    >
                      <span className="grid size-14 place-items-center rounded-full bg-ink/55 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:bg-red">
                        <Play
                          className="size-5 -translate-x-0.5 fill-ivory text-ivory"
                          aria-hidden
                        />
                      </span>
                    </span>
                  )}
                  <span
                    className="absolute right-3 top-3 bg-ink/70 px-2 py-1 text-[0.62rem] text-ivory backdrop-blur-sm"
                    aria-hidden
                  >
                    {work.category}
                  </span>
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[0.95rem] font-bold text-ivory transition-colors duration-300 group-hover:text-red">
                      {work.title}
                    </h3>
                    <p className="mt-1 text-[0.75rem] font-light text-fog">
                      {work.student}
                    </p>
                  </div>
                  <span
                    className="text-label-latin mt-1 shrink-0 text-fog/60"
                    dir="ltr"
                  >
                    {toFaDigits(String(work.id).padStart(2, "0"))}
                  </span>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
