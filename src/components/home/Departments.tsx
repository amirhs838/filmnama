"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Aperture,
  Braces,
  Clapperboard,
  Cpu,
  Film,
  Music,
  Network,
  Terminal,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Department } from "@/data/courses";
import { coursePath, type CourseCardDto, type DepartmentDto } from "@/lib/content-contract";
import { courseIcons } from "@/lib/course-icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FloatingObject } from "@/components/ui/FloatingObject";
import { EASE_OUT } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */

interface WorldConfig {
  id: Department;
  index: string;
  latinTitle: string;
  bgWord: string;
  title: string;
  description: string;
  dark: boolean;
  icons: { icon: LucideIcon; position: string; size: string; duration: number }[];
}

const worlds: WorldConfig[] = [
  {
    id: "cinema",
    index: "۰۱",
    latinTitle: "WORLD 01 — CINEMA & PERFORMING ARTS",
    bgWord: "CINEMA",
    title: "دنیای هنرهای نمایشی",
    description:
      "بازیگری، فیلم‌برداری، کارگردانی و هر چیزی که پشت و جلوی دوربین اتفاق می‌افتد؛ با تمرین واقعی در فضای کارگاهی.",
    dark: true,
    icons: [
      { icon: Clapperboard, position: "left-[6%] top-[12%]", size: "size-16", duration: 9 },
      { icon: Film, position: "left-[14%] bottom-[16%]", size: "size-12", duration: 7.5 },
      { icon: Aperture, position: "left-[3%] bottom-[38%]", size: "size-10", duration: 8.5 },
    ],
  },
  {
    id: "tech",
    index: "۰۲",
    latinTitle: "WORLD 02 — PROFESSIONAL SKILLS",
    bgWord: "SKILLS",
    title: "دنیای مهارت‌های تخصصی",
    description:
      "موسیقی، برنامه‌نویسی، هوش مصنوعی، IT و زبان؛ مهارت‌هایی که مسیر حرفه‌ای شما را در دنیای امروز می‌سازند.",
    dark: false,
    icons: [
      { icon: Braces, position: "left-[6%] top-[12%]", size: "size-14", duration: 8 },
      { icon: Terminal, position: "left-[13%] bottom-[18%]", size: "size-12", duration: 9 },
      { icon: Cpu, position: "left-[4%] bottom-[40%]", size: "size-10", duration: 7.5 },
      { icon: Music, position: "left-[18%] top-[30%]", size: "size-9", duration: 8.5 },
      { icon: Network, position: "left-[10%] top-[45%]", size: "size-10", duration: 7 },
    ],
  },
];

/* ------------------------------------------------------------------ */

function DisciplineRow({ course, dark, i }: { course: CourseCardDto; dark: boolean; i: number }) {
  const Icon = courseIcons[course.iconKey];
  return (
    <motion.li
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, delay: 0.15 + i * 0.06, ease: EASE_OUT }}
    >
      <Link
        href={coursePath(course)}
        className={cn(
          "group flex items-center gap-4 border-t py-4 transition-colors duration-300 md:gap-6 md:py-5",
          dark
            ? "border-line-light hover:bg-white/[0.03]"
            : "border-line hover:bg-ink/[0.025]"
        )}
      >
        <span
          className={cn(
            "text-label-latin w-7 shrink-0",
            dark ? "text-fog" : "text-smoke"
          )}
          dir="ltr"
        >
          {String(i + 1).padStart(2, "0")}
        </span>
        <Icon
          className={cn(
            "size-5 shrink-0 transition-colors duration-300",
            dark ? "text-ivory/70 group-hover:text-red" : "text-ink/70 group-hover:text-red"
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-4">
          <h3
            className={cn(
              "text-base font-bold md:text-lg",
              dark ? "text-ivory" : "text-ink"
            )}
          >
            {course.title}
          </h3>
          <p
            className={cn(
              "line-clamp-1 text-[0.8rem] font-light",
              dark ? "text-fog" : "text-smoke"
            )}
          >
            {course.description}
          </p>
        </div>
        <span
          className={cn(
            "hidden text-[0.62rem] tracking-[0.25em] sm:block",
            dark ? "text-fog/70" : "text-smoke/70"
          )}
          dir="ltr"
        >
          {course.latin}
        </span>
        <ArrowLeft
          className="size-4 shrink-0 -translate-x-1 text-red opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
          strokeWidth={1.75}
          aria-hidden
        />
      </Link>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */

export function Departments({ courses, departments }: { courses: CourseCardDto[]; departments: DepartmentDto[] }) {
  const availableWorlds = worlds.flatMap((world) => {
    const department = departments.find((item) => item.slug === world.id);
    return department ? [{ ...world, label: department.label, title: `دنیای ${department.label}`, latinTitle: `WORLD ${world.id === "cinema" ? "01" : "02"} — ${department.latin}`, description: department.description, courses: courses.filter((course) => course.department === world.id) }] : [];
  });
  const [active, setActive] = useState<Department>(availableWorlds[0]?.id ?? "cinema");
  const reduce = useReducedMotion();

  return (
    <section
      id="departments"
      aria-label="دپارتمان‌های آموزشی"
      className="relative bg-ivory"
    >
      <div className="container-site section-y">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            index="02"
            label="TWO WORLDS"
            title="دو دنیای آموزشی، یک مسیر حرفه‌ای"
            description="از صحنه و دوربین تا کد و هوش مصنوعی؛ دنیای خودت را انتخاب کن."
          />

          {/* ------- world switch ------- */}
          <div
            role="tablist"
            aria-label="انتخاب دپارتمان"
            className="flex w-full max-w-md border border-line-strong"
          >
            {availableWorlds.map((w) => {
              const isActive = active === w.id;
              return (
                <button
                  key={w.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(w.id)}
                  className={cn(
                    "relative flex flex-1 flex-col items-start gap-1 px-5 py-4 text-start transition-colors duration-300",
                    isActive
                      ? "bg-ink text-ivory"
                      : "bg-transparent text-smoke hover:text-ink"
                  )}
                >
                  <span className="text-label-latin opacity-70" dir="ltr">
                    {w.id === "cinema" ? "WORLD 01" : "WORLD 02"}
                  </span>
                  <span className="text-sm font-bold">
                    {w.label}
                  </span>
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-0.5 bg-red transition-transform duration-500 ease-(--ease-out-expo)",
                      isActive ? "scale-x-100" : "scale-x-0"
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* ------- world panels (stacked, mask-wipe transition) ------- */}
        <div className="relative mt-14 grid">
          <AnimatePresence initial={false} mode="sync">
            {availableWorlds.map((w) => {
              const isActive = active === w.id;
              return (
                <motion.div
                  key={w.id}
                  role="tabpanel"
                  aria-hidden={!isActive}
                  inert={!isActive}
                  className={cn(
                    "noise-overlay relative col-start-1 row-start-1 overflow-hidden",
                    w.dark ? "bg-ink" : "bg-ivory-3 border border-line",
                    !isActive && "pointer-events-none"
                  )}
                  initial={false}
                  animate={
                    isActive
                      ? {
                          opacity: 1,
                          clipPath: "inset(0% 0% 0% 0%)",
                          zIndex: 10,
                        }
                      : {
                          opacity: 0,
                          clipPath: reduce
                            ? "inset(0% 0% 0% 0%)"
                            : "inset(0% 0% 100% 0%)",
                          zIndex: 0,
                        }
                  }
                  transition={{ duration: reduce ? 0.2 : 0.7, ease: EASE_OUT }}
                >
                  {/* huge background word */}
                  <span
                    className={cn(
                      "pointer-events-none absolute -bottom-8 left-0 select-none text-[18vw] font-black leading-none tracking-tight lg:text-[11rem]",
                      w.dark ? "text-outline" : "text-outline-dark"
                    )}
                    dir="ltr"
                    aria-hidden
                  >
                    {w.bgWord}
                  </span>

                  {/* floating decorative icons */}
                  {w.icons.map(({ icon: Icon, position, size, duration }, idx) => (
                    <FloatingObject
                      key={idx}
                      className={cn(
                        "hidden lg:block",
                        position,
                        w.dark ? "text-red/20" : "text-ink/12"
                      )}
                      distance={10}
                      duration={duration}
                      delay={idx * 0.8}
                    >
                      <Icon className={size} strokeWidth={1} />
                    </FloatingObject>
                  ))}
                  {/* red accents */}
                  <span
                    className={cn(
                      "absolute right-0 top-0 h-full w-px",
                      w.dark ? "bg-red/40" : "bg-ink/15"
                    )}
                    aria-hidden
                  />

                  <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-12 lg:gap-8 lg:p-14">
                    {/* world intro */}
                    <div className="flex flex-col justify-between gap-8 lg:col-span-4">
                      <div>
                        <motion.span
                          key={`label-${w.id}`}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
                          className={cn("text-label-latin", w.dark ? "text-red" : "text-red")}
                          dir="ltr"
                        >
                          {w.latinTitle}
                        </motion.span>
                        <motion.h3
                          key={`title-${w.id}`}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.55, delay: 0.16, ease: EASE_OUT }}
                          className={cn(
                            "mt-4 text-2xl font-extrabold md:text-3xl",
                            w.dark ? "text-ivory" : "text-ink"
                          )}
                        >
                          {w.title}
                        </motion.h3>
                        <motion.p
                          key={`desc-${w.id}`}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.55, delay: 0.22, ease: EASE_OUT }}
                          className={cn(
                            "mt-4 text-sm font-light leading-8",
                            w.dark ? "text-fog" : "text-smoke"
                          )}
                        >
                          {w.description}
                        </motion.p>
                      </div>
                      <motion.a
                        key={`cta-${w.id}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
                        href={`/courses/${w.id}`}
                        className={cn(
                          "group inline-flex w-fit items-center gap-2.5 border-b pb-2 text-sm font-medium transition-colors",
                          w.dark
                            ? "border-red/50 text-ivory hover:border-red hover:text-red"
                            : "border-ink/30 text-ink hover:border-red hover:text-red"
                        )}
                      >
                        دیدن دوره‌های این دپارتمان
                        <ArrowLeft
                          className="size-4 transition-transform duration-300 group-hover:-translate-x-1"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </motion.a>
                    </div>

                    {/* disciplines */}
                    <ul className="lg:col-span-8">
                      {isActive &&
                        w.courses.map((c, i) => (
                          <DisciplineRow
                            key={c.id}
                            course={c}
                            dark={w.dark}
                            i={i}
                          />
                        ))}
                      <li
                        className={cn(
                          "border-t",
                          w.dark ? "border-line-light" : "border-line"
                        )}
                        aria-hidden
                      />
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
