"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { instructors } from "@/data/instructors";
import Link from "next/link";
import { instructorPath } from "@/lib/content-contract";
import { departmentMeta } from "@/data/courses";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InitialTile } from "@/components/ui/InitialTile";
import { SectionDecor } from "@/components/ui/SectionDecor";
import { Reveal } from "@/components/ui/Reveal";
import { SectionCarousel } from "@/components/ui/SectionCarousel";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 5000;

export interface InstructorCardItem { id: string; slug: string; name: string; bio: string; image: string | null }

function portraitSrc(image: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("/") || image.startsWith("https://")) return image;
  return null;
}

/** Black editorial section — instructors as an auto-playing horizontal carousel. */
export function Instructors({ items }: { items?: InstructorCardItem[] }) {
  const apiItems = items && items.length > 0 ? items : null;
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const syncTimer = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = instructors.length;

  const goTo = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      setActive(next);
      const track = trackRef.current;
      const child = track?.children.item(next);
      if (!track || !child) return;
      // Scroll ONLY the horizontal track — never the page itself.
      // Rect-based delta is independent of the browser's RTL scrollLeft model.
      const delta =
        child.getBoundingClientRect().right -
        track.getBoundingClientRect().right;
      track.scrollBy({ left: delta, behavior: reduce ? "auto" : "smooth" });
    },
    [count, reduce]
  );

  // Auto-advance every 5s. The timer restarts whenever `active` changes,
  // so manual navigation also resets the countdown.
  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => goTo(active + 1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [active, paused, reduce, goTo]);

  // Sync the active index after a manual swipe/scroll settles.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const sync = () => {
      const children = Array.from(track.children) as HTMLElement[];
      if (children.length === 0) return;
      const scrolled = Math.abs(track.scrollLeft);
      const base = children[0].offsetLeft;
      let best = 0;
      let bestDist = Infinity;
      children.forEach((child, i) => {
        const dist = Math.abs(scrolled - (base - child.offsetLeft));
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive((prev) => (prev === best ? prev : best));
    };

    const onScroll = () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(sync, 120);
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, []);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  if (apiItems) {
    return (
      <section id="instructors" aria-label="اساتید فیلم‌نما" className="noise-overlay section-y relative overflow-hidden bg-ink">
        <SectionDecor dark variant="c" />
        <div className="container-site relative">
          <SectionHeading
            dark
            index="04"
            label="INSTRUCTORS"
            title="اساتید فیلم‌نما"
            description="کسانی که خودشان در صنعت کار می‌کنند؛ از صحنه و پشت دوربین تا کد و استودیو."
          />
          <div className="mt-10">
            <SectionCarousel
              label="اساتید فیلم‌نما"
              count={Math.min(apiItems.length, 8)}
              tone="ink"
              trackClassName="gap-6 md:grid-cols-2 lg:grid-cols-4"
              itemClassName="w-[74%] sm:w-[45%]"
              spacerClassName="before:w-[calc(13%-1.5rem)] after:w-[calc(13%-1.5rem)] sm:before:w-[calc(27.5%-1.5rem)] sm:after:w-[calc(27.5%-1.5rem)]"
              items={apiItems.slice(0, 8).map((person) => {
                const portrait = portraitSrc(person.image);
                return (
                <article key={person.id} className="h-full border border-line-light p-6">
                  {portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portrait} alt={`تصویر ${person.name}`} loading="lazy" className="mb-4 aspect-[3/4] w-full object-cover grayscale" />
                  ) : (
                    <InitialTile name={person.name} aspect="portrait" tone="dark" className="mb-4" />
                  )}
                  <h3 className="text-lg font-bold text-ivory">
                    <Link href={instructorPath(person)} className="transition-colors hover:text-red">
                      {person.name}
                    </Link>
                  </h3>
                  <span className="mt-2 block h-px w-8 bg-red" aria-hidden />
                  <p className="text-caption mt-3 font-light leading-6 text-fog/80">{person.bio}</p>
                </article>
                );
              })}
            />
          </div>
          <p className="mt-8 text-center text-sm text-fog">
            <Link href="/instructors/" className="border-b border-red/50 text-ivory transition-colors hover:border-red hover:text-red">
              مشاهده همه اساتید
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="instructors"
      aria-label="اساتید فیلم‌نما"
      className="noise-overlay section-y relative overflow-hidden bg-ink"
    >
      <SectionDecor dark variant="c" />
      <div className="container-site relative">
        <SectionHeading
          dark
          index="04"
          label="INSTRUCTORS"
          title="اساتید فیلم‌نما"
          description="کسانی که خودشان در صنعت کار می‌کنند؛ از صحنه و پشت دوربین تا کد و استودیو."
        />

        {/* control bar — arrows + counter */}
        <div className="mt-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label="استاد قبلی"
              className="grid size-11 place-items-center border border-line-light text-ivory transition-colors duration-300 hover:border-red hover:bg-red"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="استاد بعدی"
              className="grid size-11 place-items-center border border-line-light text-ivory transition-colors duration-300 hover:border-red hover:bg-red"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          </div>
          <span className="text-label-latin text-fog" dir="ltr">
            {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
        </div>

        {/* horizontal snap track */}
        <div
          ref={trackRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="فهرست اساتید"
          onMouseEnter={pause}
          onMouseLeave={resume}
          onPointerDown={pause}
          onPointerUp={resume}
          onFocusCapture={pause}
          onBlurCapture={resume}
          className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto"
        >
          {instructors.map((person) => (
            <article
              key={person.id}
              className="group w-[78%] shrink-0 snap-start sm:w-[47%] lg:w-[31.5%] xl:w-[23.6%]"
            >
              {/* portrait */}
              <div className="relative aspect-[3/4] overflow-hidden bg-ink-3">
                <Image
                  src={person.image}
                  alt={`تصویر ${person.name}`}
                  fill
                  sizes="(max-width: 640px) 78vw, (max-width: 1024px) 47vw, (max-width: 1280px) 32vw, 24vw"
                  className="object-cover grayscale transition-all duration-700 ease-(--ease-out-expo) group-hover:scale-[1.04] group-hover:grayscale-0"
                />
                {/* department chip */}
                <span
                  className={cn(
                    "absolute right-3 top-3 px-2.5 py-1 text-[0.65rem] font-medium",
                    person.department === "cinema"
                      ? "bg-red text-ivory"
                      : "bg-ivory text-ink"
                  )}
                >
                  {departmentMeta[person.department].label}
                </span>
              </div>

              {/* meta — description below the portrait */}
              <div className="mt-5">
                <h3 className="text-lg font-bold text-ivory">{person.name}</h3>
                {/* growing red line */}
                <span
                  className="mt-2 block h-px w-8 bg-red transition-[width] duration-500 ease-(--ease-out-expo) group-hover:w-16"
                  aria-hidden
                />
                <p className="mt-3 text-[0.85rem] text-fog">
                  {person.specialty}
                </p>
                <p className="text-caption mt-1.5 font-light leading-6 text-fog/70">
                  {person.bio}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* progress segments — also act as navigation */}
        <div className="mt-8 flex items-center gap-1.5">
          {instructors.map((person, i) => (
            <button
              key={person.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`نمایش ${person.name}`}
              aria-current={i === active}
              className="relative h-1 flex-1 bg-line-light transition-colors duration-300 hover:bg-fog/40"
            >
              {i === active &&
                (reduce ? (
                  <span className="absolute inset-0 bg-red" />
                ) : (
                  <span
                    key={active}
                    className={cn(
                      "autoplay-fill absolute inset-y-0 right-0 bg-red",
                      paused && "[animation-play-state:paused]"
                    )}
                  />
                ))}
            </button>
          ))}
        </div>

        <Reveal className="mt-14 border-t border-line-light pt-8 text-center">
          <p className="text-sm text-fog">
            با همه اساتید در جلسه مشاوره رایگان آشنا شوید؛{" "}
            <a
              href="#contact"
              className="border-b border-red/50 text-ivory transition-colors hover:border-red hover:text-red"
            >
              هماهنگی مشاوره
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
