"use client";

import { Quote } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDecor } from "@/components/ui/SectionDecor";
import { StaggerGroup, staggerItem } from "@/components/ui/Reveal";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Testimonials() {
  return (
    <section
      aria-label="نظرات هنرجویان"
      className="section-y relative bg-ivory"
    >
      <SectionDecor variant="c" />
      <div className="container-site">
        <SectionHeading
          index="07"
          label="TESTIMONIALS"
          title="هنرجوها درباره فیلم‌نما چه می‌گویند؟"
        />

        <StaggerGroup
          className="mt-14 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3"
          gap={0.12}
        >
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.id}
              variants={staggerItem}
              className={cn(
                "relative flex flex-col justify-between gap-10 bg-ivory p-8 md:p-10",
                i === 0 && "lg:col-span-1 md:col-span-2 lg:row-span-1"
              )}
            >
              <div>
                <Quote
                  className="size-7 -scale-x-100 fill-red text-red"
                  strokeWidth={1}
                  aria-hidden
                />
                <blockquote className="text-lead mt-6 text-ink">
                  «{t.quote}»
                </blockquote>
              </div>
              <figcaption className="flex items-center gap-4 border-t border-line pt-5">
                <span
                  className="grid size-10 place-items-center bg-ink text-sm font-bold text-ivory"
                  aria-hidden
                >
                  {t.name.charAt(0)}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-ink">{t.name}</span>
                  <span className="text-[0.75rem] text-smoke">{t.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
