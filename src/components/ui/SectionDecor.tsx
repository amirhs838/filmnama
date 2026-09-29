"use client";

import { Plus } from "lucide-react";
import { FloatingObject } from "./FloatingObject";
import { cn } from "@/lib/utils";

interface SectionDecorProps {
  /** ivory-on-ink palette for dark sections */
  dark?: boolean;
  /** layout variation so neighbouring sections don't repeat a pattern */
  variant?: "a" | "b" | "c";
}

function RingArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <circle cx="20" cy="20" r="16" />
      <circle cx="20" cy="20" r="8" opacity="0.5" />
    </svg>
  );
}

/**
 * Sparse, slow-drifting decorative accents for a section's empty corners.
 * A handful of tiny low-opacity elements — deliberately quiet, never busy.
 * Hidden from assistive tech and frozen under reduced motion.
 */
export function SectionDecor({ dark = false, variant = "a" }: SectionDecorProps) {
  const dots = dark ? "dots-bg-light" : "dots-bg";
  const faint = dark ? "text-ivory/30" : "text-ink/30";
  const hairline = dark ? "bg-ivory/15" : "bg-ink/15";

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {variant === "a" && (
        <>
          <FloatingObject
            className={cn("right-[6%] top-[9%]", faint)}
            distance={8}
            duration={9}
          >
            <span className={cn("block h-14 w-24 opacity-40", dots)} />
          </FloatingObject>
          <FloatingObject
            className={cn("left-[5%] top-[40%]", faint)}
            distance={10}
            duration={8}
            delay={0.8}
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </FloatingObject>
          <FloatingObject
            className="bottom-[13%] left-[12%]"
            distance={6}
            duration={7}
            delay={1.4}
          >
            <span className="block size-1.5 bg-red" />
          </FloatingObject>
          <FloatingObject
            className={cn("left-[8%] top-[13%]", faint)}
            distance={7}
            duration={10}
            delay={0.4}
            rotate={3}
          >
            <RingArt className="size-7 opacity-60" />
          </FloatingObject>
          <span
            className={cn("absolute bottom-[17%] right-[9%] h-px w-20", hairline)}
          />
        </>
      )}

      {variant === "b" && (
        <>
          <FloatingObject
            className={cn("left-[7%] top-[11%]", faint)}
            distance={9}
            duration={9.5}
          >
            <span className={cn("block h-14 w-28 opacity-40", dots)} />
          </FloatingObject>
          <FloatingObject
            className={cn("right-[5%] top-[36%]", faint)}
            distance={10}
            duration={8}
            delay={0.6}
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </FloatingObject>
          <FloatingObject
            className="bottom-[11%] right-[11%]"
            distance={6}
            duration={7.5}
            delay={1.2}
          >
            <span className="block size-2 bg-red" />
          </FloatingObject>
          <FloatingObject
            className={cn("right-[13%] top-[14%]", faint)}
            distance={7}
            duration={10}
            delay={1.8}
            rotate={-3}
          >
            <Plus className="size-3.5 opacity-70" strokeWidth={1.5} />
          </FloatingObject>
          <span
            className={cn("absolute left-[9%] top-[30%] h-16 w-px", hairline)}
          />
        </>
      )}

      {variant === "c" && (
        <>
          <FloatingObject
            className={cn("left-[42%] top-[7%]", faint)}
            distance={8}
            duration={10}
          >
            <span className={cn("block h-12 w-24 opacity-30", dots)} />
          </FloatingObject>
          <FloatingObject
            className={cn("right-[5%] top-[16%]", faint)}
            distance={9}
            duration={9}
            delay={0.7}
            rotate={3}
          >
            <RingArt className="size-8 opacity-60" />
          </FloatingObject>
          <FloatingObject
            className={cn("bottom-[22%] left-[6%]", faint)}
            distance={10}
            duration={8.5}
            delay={1.1}
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </FloatingObject>
          <FloatingObject
            className="bottom-[26%] right-[13%]"
            distance={6}
            duration={7}
            delay={1.6}
          >
            <span className="block size-1.5 bg-red" />
          </FloatingObject>
          <span
            className={cn("absolute left-[10%] top-[38%] h-px w-14", hairline)}
          />
        </>
      )}
    </div>
  );
}
