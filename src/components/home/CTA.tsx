import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/data/site";

export function CTA() {
  return (
    <section
      aria-label="شروع همکاری با فیلم‌نما"
      className="noise-overlay relative overflow-hidden bg-ink"
    >
      {/* red corner accents */}
      <span className="absolute right-0 top-0 h-24 w-px bg-red" aria-hidden />
      <span className="absolute right-0 top-0 h-px w-24 bg-red" aria-hidden />
      <span className="absolute bottom-0 left-0 h-24 w-px bg-red/50" aria-hidden />
      <span className="absolute bottom-0 left-0 h-px w-24 bg-red/50" aria-hidden />

      {/* giant background word */}
      <span
        className="text-outline pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[16vw] font-black leading-none"
        dir="ltr"
        aria-hidden
      >
        START NOW
      </span>

      <div className="container-site relative flex flex-col items-center py-28 text-center md:py-40">
        <Reveal>
          <span
            className="flex items-center justify-center gap-3 text-label-latin text-fog"
            dir="ltr"
          >
            <span className="inline-block size-1.5 bg-red" aria-hidden />
            08 — LET’S GO
          </span>
        </Reveal>

        <Reveal delay={0.1} blur>
          <h2 className="text-display mt-8 text-ivory">
            وقتشه شروع کنی<span className="text-red">.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="text-lead mt-7 max-w-lg text-fog">
            دوره‌ای را انتخاب کن که مسیر بعدی تو را می‌سازد؛ بقیه‌اش را با هم
            قدم‌به‌قدم پیش می‌رویم.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
            <Button href="#courses" size="lg" withArrow>
              مشاهده دوره‌ها
            </Button>
            <Button href={`tel:${site.mobile}`} variant="light" size="lg">
              تماس با فیلم‌نما
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
