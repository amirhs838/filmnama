import { toFaDigits } from "@/lib/utils";
import { Reveal } from "@/components/ui/Reveal";
import { SectionDecor } from "@/components/ui/SectionDecor";

const marqueeItems = [
  "بازیگری",
  "فیلم‌برداری",
  "کارگردانی",
  "گریم",
  "تدوین",
  "فیلم‌سازی",
  "جلوه‌های بصری",
  "موسیقی",
  "برنامه‌نویسی",
  "هوش مصنوعی",
  "IT و شبکه",
  "زبان انگلیسی",
];

/** Slow cinematic marquee band — doubles as a transition into the dark world. */
export function Marquee() {
  const row = [...marqueeItems, ...marqueeItems];
  return (
    <div
      className="relative overflow-hidden border-y border-line-light bg-ink py-5"
      aria-hidden
    >
      <div className="animate-marquee flex w-max items-center gap-8 [direction:ltr]">
        {[...row, ...row].map((item, i) => (
          <span key={i} className="flex items-center gap-8 whitespace-nowrap">
            <span className="text-sm font-medium tracking-wide text-ivory/80">
              {item}
            </span>
            <span className="size-1.5 rotate-45 bg-red" />
          </span>
        ))}
      </div>
    </div>
  );
}

const stats = [
  { value: 12, suffix: "+", label: "دوره تخصصی در دو دپارتمان" },
  { value: 11, suffix: "", label: "استاد باتجربه و فعال در صنعت" },
  { value: 100, suffix: "٪", label: "آموزش عملی و پروژه‌محور" },
];

/** Brand story strip — «فیلم‌نما چیست؟» */
export function BrandIntro() {
  return (
    <section
      id="about"
      aria-label="درباره فیلم‌نما"
      className="section-y relative bg-ink"
    >
      <div
        className="grid-bg-light absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
        aria-hidden
      />
      <SectionDecor dark variant="a" />
      <div className="container-site relative">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Reveal>
              <span
                className="flex items-center gap-3 text-label-latin text-fog"
                dir="ltr"
              >
                <span className="inline-block size-1.5 bg-red" aria-hidden />
                01
                <span className="h-px w-8 bg-line-light" aria-hidden />
                ABOUT FILMNAMA
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="text-h2 mt-6 text-ivory">
                فیلم‌نما بیشتر از یک آموزشگاه است؛
                <span className="text-red"> یک محیط ساختن</span> است.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="text-lead mt-7 max-w-2xl text-fog">
                ما باور داریم مهارت با تماشا کردن به دست نمی‌آید. در فیلم‌نما از
                همان جلسه اول مقابل دوربین، پشت میز تدوین، داخل کد و روی صحنه
                هستید؛ با استادی که خودش در صنعت کار می‌کند و مسیر حرفه‌ای شدن
                را قدم‌به‌قدم با شما می‌سازد.
              </p>
            </Reveal>
          </div>

          <dl className="flex flex-col justify-end gap-0 lg:col-span-5">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={0.1 + i * 0.08}>
                <div className="flex items-baseline justify-between gap-6 border-t border-line-light py-6 last:border-b">
                  <dt className="order-2 text-sm text-fog">{s.label}</dt>
                  <dd className="order-1 flex items-baseline gap-1 text-4xl font-extrabold text-ivory">
                    {toFaDigits(s.value)}
                    <span className="text-xl text-red">{s.suffix}</span>
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
