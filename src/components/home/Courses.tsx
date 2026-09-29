"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clock3, Gauge } from "lucide-react";
import Link from "next/link";
import { coursePath, type CourseCardDto, type DepartmentDto } from "@/lib/content-contract";
import { courseIcons } from "@/lib/course-icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDecor } from "@/components/ui/SectionDecor";
import { EASE_OUT } from "@/components/ui/Reveal";
import { cn, toFaDigits } from "@/lib/utils";

type Filter = string;

/** Tracks the cursor so each card can light up where it is hovered. */
function trackSpotlight(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
  el.style.setProperty("--my", `${e.clientY - rect.top}px`);
}

export function Courses({ courses, departments, initialFilter = "all" }: { courses: CourseCardDto[]; departments: DepartmentDto[]; initialFilter?: string }) {
  const filters = [{ id: "all", label: "همه دوره‌ها" }, ...departments.map((department) => ({ id: department.slug, label: department.label }))];
  const labels = new Map(departments.map((department) => [department.slug, department.label]));
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const visible =
    filter === "all" ? courses : courses.filter((c) => c.department === filter);

  return (
    <section
      id="courses"
      aria-label="دوره‌های آموزشی"
      className="section-y relative bg-ivory"
    >
      <SectionDecor variant="b" />
      {/* soft ambient glow behind the grid */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-3/5 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red/[0.035] blur-3xl"
        aria-hidden
      />

      <div className="container-site relative">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            index="03"
            label="COURSES"
            title="دوره‌هایی برای ساختن آینده"
            description={`${toFaDigits(String(courses.length))} مسیر آموزشی، همه با یک اصل: یادگیری با تجربه واقعی و خروجی قابل نمایش.`}
          />

          {/* segmented filter with sliding pill */}
          <div className="flex flex-col items-start gap-3">
            <div
              role="tablist"
              aria-label="فیلتر دوره‌ها"
              className="flex border border-line-strong p-1"
            >
              {filters.map((f) => {
                const isActive = filter === f.id;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setFilter(f.id)}
                    className="relative h-9 px-4 text-[0.8rem] whitespace-nowrap"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="course-filter-pill"
                        className="absolute inset-0 bg-ink"
                        transition={{ duration: 0.35, ease: EASE_OUT }}
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 transition-colors duration-300",
                        isActive ? "text-ivory" : "text-smoke hover:text-ink"
                      )}
                    >
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-[0.72rem] text-smoke">
              {toFaDigits(String(visible.length).padStart(2, "0"))} دوره
              {filter !== "all" && ` · دپارتمان ${labels.get(filter) ?? filter}`}
            </span>
          </div>
        </div>

        {visible.length === 0 && <p role="status" className="mt-14 text-sm text-smoke">در حال حاضر دوره‌ای منتشر نشده است.</p>}
        {/* cards */}
        <motion.ul
          layout
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((course, i) => {
              const Icon = courseIcons[course.iconKey];
              return (
                <motion.li
                  layout
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.45, delay: i * 0.03, ease: EASE_OUT }}
                  onMouseMove={trackSpotlight}
                  className="group relative bg-[linear-gradient(150deg,rgba(244,242,237,0.2),rgba(17,17,17,0.08)_45%,rgba(215,25,32,0.45)_130%)] p-px transition-transform duration-400 ease-(--ease-out-expo) hover:-translate-y-1.5"
                >
                  {/* red halo behind the card */}
                  <span
                    className="pointer-events-none absolute -inset-3 -z-10 bg-[radial-gradient(65%_60%_at_50%_35%,rgba(215,25,32,0.28),transparent_70%)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden
                  />

                  {/* card body — dark, against the ivory section */}
                  <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-2 to-ink p-6 shadow-[0_10px_30px_-18px_rgba(17,17,17,0.4)] transition-shadow duration-400 group-hover:shadow-[0_26px_50px_-18px_rgba(17,17,17,0.55)]">
                    {/* ghost icon watermark */}
                    <Icon
                      className="absolute -bottom-7 -left-7 size-32 rotate-12 text-ivory/[0.05] transition-all duration-500 ease-(--ease-out-expo) group-hover:rotate-6 group-hover:text-red/10"
                      strokeWidth={1}
                      aria-hidden
                    />

                    <div className="flex items-start justify-between">
                      {/* icon box — flips to red with glow on hover */}
                      <span className="grid size-12 place-items-center border border-line-light bg-ivory/[0.06] transition-all duration-400 group-hover:border-red group-hover:bg-red group-hover:shadow-[0_10px_24px_-8px_rgba(215,25,32,0.6)]">
                        <Icon
                          className="size-5 text-ivory/85 transition-colors duration-400 group-hover:text-ivory"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </span>
                      <span className="text-label-latin text-fog/50" dir="ltr">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="mt-7">
                      <p
                        className="text-[0.62rem] tracking-[0.25em] text-fog/70"
                        dir="ltr"
                      >
                        {course.latin}
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-ivory transition-transform duration-400 ease-(--ease-out-expo) group-hover:-translate-y-0.5">
                        {course.title}
                      </h3>
                      <p className="text-caption mt-2 line-clamp-2 font-light text-fog">
                        {course.description}
                      </p>
                    </div>

                    {/* meta chips */}
                    <div className="mt-5 mb-6 flex flex-wrap gap-1.5">
                      <span className="flex items-center gap-1.5 border border-line-light px-2 py-1 text-[0.68rem] text-fog">
                        <Clock3 className="size-3 text-red" strokeWidth={1.75} aria-hidden />
                        {toFaDigits(course.duration)}
                      </span>
                      <span className="flex items-center gap-1.5 border border-line-light px-2 py-1 text-[0.68rem] text-fog">
                        <Gauge className="size-3 text-red" strokeWidth={1.75} aria-hidden />
                        {course.level}
                      </span>
                    </div>

                    {/* footer */}
                    <div className="mt-auto flex items-center justify-between border-t border-line-light pt-4">
                      <span className="text-[0.7rem] text-fog/70">
                        {labels.get(course.department) ?? course.department}
                      </span>
                      <Link href={coursePath(course)} aria-label={`جزئیات دوره ${course.title}`} className="flex items-center gap-1.5 text-[0.78rem] font-medium text-ivory after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-red">
                        جزئیات
                        <ArrowLeft
                          className="size-4 text-red transition-transform duration-400 ease-(--ease-out-expo) group-hover:-translate-x-1"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </Link>
                    </div>

                    {/* cursor spotlight */}
                    <span
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(230px circle at var(--mx, 50%) var(--my, 50%), rgba(215,25,32,0.14), transparent 65%)",
                      }}
                      aria-hidden
                    />
                    {/* shine sweep */}
                    <span
                      className="pointer-events-none absolute inset-0 -translate-x-[130%] skew-x-12 bg-gradient-to-l from-transparent via-ivory/[0.09] to-transparent transition-transform duration-1000 ease-(--ease-out-expo) group-hover:translate-x-[130%]"
                      aria-hidden
                    />
                    {/* red top bar — sweeps in on hover */}
                    <span
                      className="absolute inset-x-0 top-0 h-0.5 origin-right scale-x-0 bg-red transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-x-100"
                      aria-hidden
                    />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      </div>
    </section>
  );
}
