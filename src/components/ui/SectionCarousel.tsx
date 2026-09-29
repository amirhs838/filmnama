"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { carouselActiveIndex, carouselScrollState, clampCarouselIndex } from "@/lib/carousel";
import { toFaDigits } from "@/lib/utils";
import { cn } from "@/lib/utils";

type FadeTone = "ink" | "ivory" | "ink-2";

const controlTones: Record<FadeTone, { button: string; counter: string }> = {
  ink: { button: "border-line-light text-ivory", counter: "text-fog" },
  ivory: { button: "border-line text-ink", counter: "text-smoke" },
  "ink-2": { button: "border-line-light text-ivory", counter: "text-fog" },
};

interface SectionCarouselProps {
  label: string;
  count: number;
  tone: FadeTone;
  trackClassName: string;
  itemClassName: string;
  spacerClassName: string;
  items: ReactNode[];
}

function slides(track: HTMLDivElement | null): HTMLElement[] {
  if (!track) return [];
  return Array.from(track.querySelectorAll<HTMLElement>("[data-carousel-item]"));
}

export function SectionCarousel({ label, count, tone, trackClassName, itemClassName, spacerClassName, items }: SectionCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const sync = useCallback(() => {
    const track = trackRef.current;
    const children = slides(track);
    if (!track || children.length === 0) return;
    const trackRect = track.getBoundingClientRect();
    const first = children[0]?.getBoundingClientRect();
    const last = children[children.length - 1]?.getBoundingClientRect();
    if (!first || !last) return;
    const state = carouselScrollState({
      firstRight: first.right,
      lastLeft: last.left,
      trackRight: trackRect.right,
      trackLeft: trackRect.left,
      trackWidth: trackRect.width,
      scrollLeft: track.scrollLeft,
      scrollWidth: track.scrollWidth,
      clientWidth: track.clientWidth,
    });
    setAtStart(state.atStart);
    setAtEnd(state.atEnd);
    setScrollable(state.scrollable);
    const centers = children.map((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    setActive(clampCarouselIndex(carouselActiveIndex(centers, trackRect.left + trackRect.width / 2), children.length));
  }, []);

  useEffect(() => {
    sync();
    const onResize = () => sync();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sync, count]);

  function onScroll() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      sync();
    });
  }

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  function goTo(index: number) {
    const track = trackRef.current;
    const children = slides(track);
    const clamped = clampCarouselIndex(index, children.length);
    const trackRect = track?.getBoundingClientRect();
    const child = children[clamped]?.getBoundingClientRect();
    if (!track || !trackRect || !child) return;
    const delta = child.right - trackRect.right - (trackRect.width - child.width) / 2;
    track.scrollBy({ left: delta, behavior: reduce ? "auto" : "smooth" });
  }

  const showControls = scrollable && count > 1;

  const controls = controlTones[tone];

  return (
    <div>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        className={cn(
          "no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red before:shrink-0 before:content-[''] after:shrink-0 after:content-[''] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0 md:before:hidden md:after:hidden",
          trackClassName,
          spacerClassName,
        )}
      >
        {items.map((item, index) => (
          <div
            key={index}
            role="group"
            data-carousel-item
            aria-roledescription="slide"
            aria-label={`${toFaDigits(index + 1)} از ${toFaDigits(count)}`}
            className={cn("min-w-0 shrink-0 snap-center md:w-auto", itemClassName)}
          >
            {item}
          </div>
        ))}
      </div>
      {showControls && (
        <div className="mt-6 flex items-center justify-center gap-5 md:hidden">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={atStart}
            aria-label="مورد قبلی"
            className={cn("grid size-11 shrink-0 place-items-center border transition-colors hover:border-red hover:bg-red hover:text-ivory disabled:cursor-not-allowed disabled:opacity-40", controls.button)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <p className={cn("min-w-16 text-center text-xs", controls.counter)} aria-hidden>
            {toFaDigits(active + 1)} از {toFaDigits(count)}
          </p>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={atEnd}
            aria-label="مورد بعدی"
            className={cn("grid size-11 shrink-0 place-items-center border transition-colors hover:border-red hover:bg-red hover:text-ivory disabled:cursor-not-allowed disabled:opacity-40", controls.button)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
