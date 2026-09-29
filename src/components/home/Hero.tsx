"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Music, Plus } from "lucide-react";
import { FloatingObject } from "@/components/ui/FloatingObject";
import { Button } from "@/components/ui/Button";
import { EASE_OUT } from "@/components/ui/Reveal";

/* ------------------------------------------------------------------ */
/*  Minimal line-art decorations (editorial, not cartoon)              */
/* ------------------------------------------------------------------ */

function ClapperboardArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 118"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={className}
      aria-hidden
    >
      {/* board */}
      <rect x="10" y="46" width="120" height="64" rx="2" />
      <line x1="10" y1="66" x2="130" y2="66" />
      {/* slanted stick */}
      <path d="M14 46 L126 22 L129 34 L17 58 Z" fill="currentColor" stroke="none" />
      {/* stick stripes */}
      <path d="M34 41 L40 52 M58 35 L64 46 M82 29 L88 40 M106 23 L112 34" stroke="#F4F2ED" strokeWidth="4" />
      {/* hinge */}
      <circle cx="16" cy="52" r="5" fill="#F4F2ED" strokeWidth="2.5" />
      {/* board details */}
      <line x1="22" y1="78" x2="70" y2="78" strokeWidth="2" opacity="0.6" />
      <line x1="22" y1="88" x2="86" y2="88" strokeWidth="2" opacity="0.6" />
      <line x1="22" y1="98" x2="62" y2="98" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}

function LensArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <circle cx="60" cy="60" r="52" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="40" strokeWidth="1.5" opacity="0.55" />
      <circle cx="60" cy="60" r="27" strokeWidth="2" />
      <circle cx="60" cy="60" r="12" strokeWidth="1.5" opacity="0.7" />
      {/* aperture blades */}
      <path d="M60 33 L70 52 M87 60 L68 66 M60 87 L50 68 M33 60 L52 54" strokeWidth="1.5" opacity="0.55" />
      <circle cx="48" cy="44" r="4" fill="currentColor" stroke="none" opacity="0.8" />
    </svg>
  );
}

/** Small red tick square */
function RedTick({ className }: { className?: string }) {
  return <span className={`absolute block bg-red ${className ?? ""}`} aria-hidden />;
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

const latinDepartments = [
  "CINEMA",
  "TECHNOLOGY",
  "LANGUAGE",
  "MUSIC",
  "IT",
  "DESIGN",
];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Very subtle parallax layers
  const yDecor = useTransform(scrollYProgress, [0, 1], [0, -46]);
  const yContent = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const opacityContent = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const fadeIn = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.9, delay, ease: EASE_OUT },
        };

  return (
    <section
      ref={ref}
      id="home"
      aria-label="معرفی فیلم‌نما"
      className="noise-overlay relative flex min-h-svh flex-col overflow-hidden bg-ivory"
    >
      {/* architectural grid, faded toward edges */}
      <div
        className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_42%,black,transparent_78%)]"
        aria-hidden
      />

      {/* ----------------------- decorative layer ----------------------- */}
      <motion.div
        className="absolute inset-0"
        style={reduce ? undefined : { y: yDecor }}
        aria-hidden
      >
        {/* viewfinder corner brackets */}
        <span className="absolute right-5 top-24 h-9 w-9 border-r-2 border-t-2 border-ink/60 md:h-14 md:w-14 lg:right-10" />
        <span className="absolute left-5 top-24 h-9 w-9 border-l-2 border-t-2 border-ink/25 md:h-14 md:w-14 lg:left-10" />
        <span className="absolute bottom-10 right-5 h-9 w-9 border-b-2 border-r-2 border-ink/25 md:h-14 md:w-14 lg:right-10" />
        <span className="absolute bottom-10 left-5 h-9 w-9 border-b-2 border-l-2 border-ink/60 md:h-14 md:w-14 lg:left-10" />

        {/* diagonal red hairlines */}
        <span className="absolute -left-24 top-16 hidden h-px w-[46rem] origin-left -rotate-[38deg] bg-red/50 lg:block" />
        <span className="absolute -right-28 bottom-24 hidden h-px w-[42rem] origin-right -rotate-[32deg] bg-red/40 lg:block" />

        {/* LEARN / EXPERIENCE / CREATE — top right */}
        <motion.div
          {...fadeIn(0.9)}
          className="absolute right-8 top-28 hidden lg:block xl:right-16"
        >
          <p
            className="text-label-latin space-y-2 text-left text-ink/80"
            dir="ltr"
          >
            <span className="block">LEARN</span>
            <span className="block">EXPERIENCE</span>
            <span className="block">CREATE</span>
          </p>
          <RedTick className="-right-4 top-0 size-2" />
        </motion.div>

        {/* clapperboard + lens — left side */}
        <FloatingObject
          className="left-[6%] top-[24%] text-ink"
          distance={12}
          duration={8}
          rotate={-2}
        >
          <motion.div {...fadeIn(1.0)}>
            <ClapperboardArt className="w-20 -rotate-6 opacity-60 sm:w-24 md:w-32 md:opacity-100 xl:w-40" />
          </motion.div>
        </FloatingObject>
        <FloatingObject
          className="left-[10%] top-[46%] text-ink/85"
          distance={9}
          duration={9}
          delay={1.2}
        >
          <motion.div {...fadeIn(1.15)}>
            <LensArt className="w-16 opacity-60 sm:w-20 md:w-24 md:opacity-100 xl:w-28" />
          </motion.div>
        </FloatingObject>

        {/* dotted halos behind lens */}
        <span className="dots-bg absolute left-[7%] top-[52%] hidden h-24 w-40 opacity-40 lg:block" />

        {/* latin department list — right side */}
        <motion.ul
          {...fadeIn(1.05)}
          className="absolute right-[7%] top-[30%] hidden space-y-2.5 lg:block xl:right-[9%]"
          dir="ltr"
        >
          {latinDepartments.map((d) => (
            <li
              key={d}
              className="flex items-center gap-2.5 text-[0.66rem] font-medium tracking-[0.28em] text-ink/75"
            >
              <span className="size-1 bg-red" />
              {d}
            </li>
          ))}
        </motion.ul>

        {/* code snippet box */}
        <motion.div
          {...fadeIn(1.2)}
          className="absolute right-[8%] top-[52%] hidden border border-line bg-ivory-2/80 px-4 py-3 lg:block"
          dir="ltr"
        >
          <p className="font-mono text-[0.7rem] leading-6 tracking-wider text-ink/70">
            <span className="text-ink/40">&lt;</span> creative{" "}
            <span className="text-ink/40">&gt;</span>
            <br />
            <span className="text-ink/40">&lt;</span> education{" "}
            <span className="text-ink/40">&gt;</span>
            <br />
            <span className="text-ink/40">&lt;</span>{" "}
            <span className="text-red">future</span>{" "}
            <span className="text-ink/40">/&gt;</span>
          </p>
        </motion.div>

        {/* braces — far right */}
        <FloatingObject
          className="right-[4%] top-[38%] hidden text-ink/50 xl:block"
          distance={8}
          duration={7.5}
          delay={0.6}
        >
          <span className="font-mono text-4xl" dir="ltr">
            {"{ }"}
          </span>
        </FloatingObject>

        {/* music note + ABC — bottom left */}
        <FloatingObject
          className="bottom-[22%] left-[7%] hidden items-center gap-5 text-ink/80 lg:flex"
          distance={10}
          duration={8.5}
          delay={0.9}
        >
          <motion.div {...fadeIn(1.25)} className="flex items-center gap-5">
            <Music className="size-6" strokeWidth={1.5} />
            <span className="flex items-center gap-2 text-xl font-bold tracking-widest" dir="ltr">
              <span className="text-red">A</span>
              <span>B</span>
              <span>C</span>
            </span>
          </motion.div>
        </FloatingObject>

        {/* dotted grid cluster — top center-left & bottom right */}
        <span className="dots-bg absolute left-[30%] top-[13%] h-12 w-24 opacity-50 md:h-20 md:w-36" />
        <span className="dots-bg absolute bottom-[16%] right-[22%] h-12 w-24 opacity-40 md:h-20 md:w-36" />

        {/* scattered plus signs */}
        <Plus className="absolute left-[24%] top-[18%] size-4 text-ink/45" strokeWidth={1.5} />
        <Plus className="absolute right-[26%] top-[12%] size-3.5 text-ink/40" strokeWidth={1.5} />
        <Plus className="absolute bottom-[30%] left-[16%] hidden size-3.5 text-ink/40 lg:block" strokeWidth={1.5} />
        <Plus className="absolute bottom-[26%] right-[14%] hidden size-4 text-ink/45 lg:block" strokeWidth={1.5} />

        {/* red squares */}
        <RedTick className="left-[3.5%] top-[58%] size-2" />
        <RedTick className="right-[4%] top-[62%] size-1.5" />
        <RedTick className="bottom-[13%] left-[38%] size-1.5" />

        {/* small play triangles — bottom left, under the lens */}
        <span className="absolute bottom-[10%] left-[12%] hidden items-center gap-1.5 lg:flex">
          <span className="size-0 border-y-[4px] border-r-[7px] border-y-transparent border-r-red" />
          <span className="size-0 border-y-[4px] border-r-[7px] border-y-transparent border-r-ink/60" />
          <span className="size-0 border-y-[4px] border-r-[7px] border-y-transparent border-r-ink/30" />
        </span>
      </motion.div>

      {/* --------------------------- content ---------------------------- */}
      <motion.div
        style={reduce ? undefined : { y: yContent, opacity: opacityContent }}
        className="container-site relative z-10 flex flex-1 flex-col items-center justify-center pb-16 pt-24 text-center md:pt-28"
      >
        {/* logo — the focal point */}
        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, scale: 0.94, filter: "blur(10px)" },
                animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
                transition: { duration: 1.1, delay: 0.15, ease: EASE_OUT },
              })}
          className="relative"
        >
          <Image
            src="/logo.png"
            alt="لوگوی آموزشگاه سینمایی فیلم‌نما"
            width={359}
            height={517}
            priority
            className="h-auto w-36 sm:w-44 md:w-48 lg:w-52"
          />
        </motion.div>

        {/* headline */}
        <motion.h1
          {...fadeIn(0.45)}
          className="text-display mt-6 max-w-3xl text-ink md:mt-8"
        >
          آموزشگاه آزاد سینمایی فیلم نما
        </motion.h1>

        {/* divider */}
        <motion.span
          {...fadeIn(0.6)}
          className="mt-6 flex items-center gap-3"
          aria-hidden
        >
          <span className="h-px w-14 bg-ink/30" />
          <span className="size-1.5 bg-red" />
          <span className="h-px w-14 bg-ink/30" />
        </motion.span>

        {/* lead */}
        <motion.p
          {...fadeIn(0.7)}
          className="text-lead mt-6 max-w-2xl text-smoke"
        >
          فیلم‌نما، فضایی برای پرورش استعدادها در هنرهای نمایشی، فناوری، زبان،
          موسیقی و مهارت‌های تخصصی؛ جایی که آموزش با تجربه واقعی و مسیر
          حرفه‌ای همراه می‌شود.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeIn(0.85)}
          className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button href="#courses" size="lg" withArrow>
            مشاهده دوره‌ها
          </Button>
          <Button href="#about" variant="ghost" size="lg">
            آشنایی با فیلم‌نما
          </Button>
        </motion.div>
      </motion.div>

      {/* scroll cue — only when the viewport is tall enough to clear the content */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-3 [@media(min-height:980px)]:flex"
        aria-hidden
      >
        <span className="text-[0.62rem] tracking-[0.3em] text-smoke">
          اسکرول
        </span>
        <span className="relative h-10 w-px overflow-hidden bg-ink/15">
          <motion.span
            className="absolute left-0 top-0 h-4 w-px bg-red"
            animate={reduce ? undefined : { y: [-16, 40] }}
            transition={
              reduce
                ? undefined
                : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            }
          />
        </span>
      </motion.div>
    </section>
  );
}
