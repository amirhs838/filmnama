"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { galleryItems } from "@/data/gallery";
import Link from "next/link";
import { albumPath, mediaSrc } from "@/lib/content-contract";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InitialTile } from "@/components/ui/InitialTile";
import { SectionDecor } from "@/components/ui/SectionDecor";
import { Reveal, EASE_OUT } from "@/components/ui/Reveal";
import { SectionCarousel } from "@/components/ui/SectionCarousel";
import { cn, toFaDigits } from "@/lib/utils";

/**
 * Bento layout — tiles a 4-col grid into full rows (16 cells, 9 items).
 * Mobile: first tile spans full width, the rest are equal pairs.
 */
const bentoSpans = [
  "col-span-2 md:row-span-2", // feature tile
  "",
  "",
  "md:row-span-2", // tall
  "md:col-span-2", // wide
  "",
  "",
  "md:col-span-2",
  "md:col-span-2",
];

export interface GalleryAlbumItem { id: string; slug: string; title: string; description: string; coverMedia: { id: string; url: string; alt: string } | null }

export function Gallery({ albums }: { albums?: GalleryAlbumItem[] }) {
  const apiAlbums = albums && albums.length > 0 ? albums : null;
  const [selected, setSelected] = useState<number | null>(null);

  const close = useCallback(() => setSelected(null), []);
  const step = useCallback(
    (dir: 1 | -1) =>
      setSelected((s) =>
        s === null
          ? s
          : (s + dir + galleryItems.length) % galleryItems.length
      ),
    []
  );

  // keyboard navigation + scroll lock
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(1);
      if (e.key === "ArrowRight") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selected, close, step]);

  const item = selected !== null ? galleryItems[selected] : null;

  if (apiAlbums) {
    return (
      <section id="gallery" aria-label="گالری فیلم‌نما" className="section-y relative bg-ivory">
        <SectionDecor variant="a" />
        <div className="container-site">
          <SectionHeading
            index="05"
            label="GALLERY"
            title="فضای واقعی، تجربه واقعی"
            description="نگاهی به کلاس‌ها، کارگاه‌ها و پشت صحنه‌هایی که در فیلم‌نما اتفاق می‌افتد."
          />
          <div className="mt-14">
            <SectionCarousel
              label="آلبوم‌های گالری"
              count={Math.min(apiAlbums.length, 6)}
              tone="ivory"
              trackClassName="gap-4 md:grid-cols-3"
              itemClassName="w-[82%] sm:w-[46%]"
              spacerClassName="before:w-[calc(9%-1rem)] after:w-[calc(9%-1rem)] sm:before:w-[calc(27%-1rem)] sm:after:w-[calc(27%-1rem)]"
              items={apiAlbums.slice(0, 6).map((album) => (
                <Link key={album.id} href={albumPath(album)} className="group block h-full border border-line bg-ivory-2 p-6 transition-colors hover:border-red">
                  {album.coverMedia ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaSrc(album.coverMedia.id)} alt={album.coverMedia.alt || album.title} loading="lazy" className="mb-4 aspect-[16/10] w-full object-cover" />
                  ) : (
                    <InitialTile name={album.title} aspect="wide" className="mb-4" />
                  )}
                  <h3 className="text-lg font-bold transition-colors group-hover:text-red">{album.title}</h3>
                  {album.description && <p className="mt-2 text-sm font-light leading-7 text-smoke">{album.description}</p>}
                </Link>
              ))}
            />
          </div>
          <p className="mt-8 text-center text-sm">
            <Link href="/gallery/" className="border-b border-red/50 transition-colors hover:text-red">
              مشاهده همه آلبوم‌ها
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="gallery"
      aria-label="گالری فیلم‌نما"
      className="section-y relative bg-ivory"
    >
      <SectionDecor variant="a" />
      <div className="container-site">
        <SectionHeading
          index="05"
          label="GALLERY"
          title="فضای واقعی، تجربه واقعی"
          description="نگاهی به کلاس‌ها، کارگاه‌ها و پشت صحنه‌هایی که در فیلم‌نما اتفاق می‌افتد."
        />

        {/* bento grid */}
        <div className="mt-14 grid grid-flow-dense grid-cols-2 gap-3 auto-rows-[9.5rem] md:grid-cols-4 md:gap-4 md:auto-rows-[12.5rem]">
          {galleryItems.map((g, i) => (
            <Reveal
              key={g.id}
              delay={(i % 4) * 0.06}
              className={cn(
                "group relative overflow-hidden bg-ivory-3",
                bentoSpans[i % bentoSpans.length]
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`بزرگ‌نمایی تصویر: ${g.title}`}
                className="absolute inset-0 block w-full cursor-pointer text-start"
              >
                <Image
                  src={g.image}
                  alt={g.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover grayscale transition-all duration-700 ease-(--ease-out-expo) group-hover:scale-[1.05] group-hover:grayscale-0"
                />
                {/* red frame on hover */}
                <span
                  className="pointer-events-none absolute inset-0 border-2 border-red opacity-0 transition-opacity duration-500"
                  aria-hidden
                />
                {/* hover overlay */}
                <span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent opacity-0 transition-opacity duration-500"
                  aria-hidden
                />
                {/* persistent index */}
                <span
                  className="absolute bottom-3 left-3 text-label-latin text-ivory/80 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  dir="ltr"
                  aria-hidden
                >
                  {String(g.id).padStart(2, "0")}
                </span>
                {/* caption — slides up on hover */}
                <span
                  className="absolute inset-x-0 bottom-0 flex translate-y-3 items-end justify-between p-4 opacity-0 transition-all duration-500 ease-(--ease-out-expo) group-hover:translate-y-0 group-hover:opacity-100"
                  aria-hidden
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-[0.65rem] font-medium text-red">
                      {g.category}
                    </span>
                    <span className="text-[0.85rem] font-bold text-ivory">
                      {g.title}
                    </span>
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center border border-ivory/40 text-ivory">
                    <Plus className="size-3.5" strokeWidth={1.5} />
                  </span>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ------------------------- lightbox ------------------------- */}
      <AnimatePresence>
        {item && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`نمایش تصویر: ${item.title}`}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95 p-4 backdrop-blur-md md:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
          >
            {/* close */}
            <button
              type="button"
              onClick={close}
              aria-label="بستن"
              className="absolute right-5 top-5 z-10 grid size-11 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:bg-red"
            >
              <X className="size-5" strokeWidth={1.5} />
            </button>

            {/* prev / next (RTL: right arrow = next) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label="تصویر بعدی"
              className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:bg-red md:right-8"
            >
              <ChevronRight className="size-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label="تصویر قبلی"
              className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:bg-red md:left-8"
            >
              <ChevronLeft className="size-5" strokeWidth={1.5} />
            </button>

            <motion.figure
              key={item.id}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="relative flex max-h-full w-full max-w-4xl flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-3 md:aspect-[16/10]">
                <Image
                  src={item.image.replace(/\/\d+\/\d+$/, "/1600/1000")}
                  alt={item.title}
                  fill
                  sizes="(max-width: 896px) 100vw, 896px"
                  className="object-cover"
                  priority
                />
              </div>

              <figcaption className="flex items-center justify-between border-t border-line-light py-4">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[0.7rem] text-red">{item.category}</span>
                  <span className="text-base font-bold text-ivory">
                    {item.title}
                  </span>
                </span>
                <span className="text-sm text-fog">
                  {toFaDigits(String(item.id).padStart(2, "0"))} /{" "}
                  {toFaDigits(String(galleryItems.length).padStart(2, "0"))}
                </span>
              </figcaption>

              {/* thumbnail strip */}
              <div
                className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
                role="tablist"
                aria-label="پیش‌نمایش تصاویر"
              >
                {galleryItems.map((g, i) => (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={i === selected}
                    aria-label={`نمایش ${g.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(i);
                    }}
                    className={cn(
                      "relative h-14 w-20 shrink-0 overflow-hidden transition-all duration-300",
                      i === selected
                        ? "opacity-100 ring-2 ring-red ring-offset-2 ring-offset-ink"
                        : "opacity-40 hover:opacity-80"
                    )}
                  >
                    <Image
                      src={g.image}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
