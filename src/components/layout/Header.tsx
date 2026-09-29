"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X, Phone, Search } from "lucide-react";
import { navLinks, site } from "@/data/site";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/components/ui/Reveal";

function Wordmark() {
  return (
      <Link
        href="/#home"
        className="flex items-center gap-3"
        aria-label={site.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="logo-mark h-14 w-auto shrink-0"
        />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold text-ivory">فیلم‌نما</span>
        <span className="mt-1 text-[0.62rem] font-light tracking-[0.18em] text-fog">
          آموزشگاه سینمایی
        </span>
      </span>
    </Link>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 bg-ink transition-[background-color,backdrop-filter,border-color] duration-500",
          scrolled
            ? "border-b border-line-light bg-ink/85 backdrop-blur-md"
            : "border-b border-transparent"
        )}
      >
        <div className="container-site flex h-[4.5rem] items-center justify-between lg:h-20">
          <Wordmark />

          {/* Desktop nav */}
          <nav aria-label="ناوبری اصلی" className="hidden xl:block">
            <ul className="flex items-center gap-7">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group relative py-2 text-[0.82rem] font-normal text-fog transition-colors duration-300 hover:text-ivory"
                  >
                    {link.label}
                    <span
                      className="absolute inset-x-0 -bottom-0.5 h-px origin-right scale-x-0 bg-red transition-transform duration-300 ease-(--ease-out-expo) group-hover:scale-x-100"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/search/"
              aria-label="جستجو"
              className="grid size-10 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:text-red"
            >
              <Search className="size-5" strokeWidth={1.5} />
            </Link>
            <Link
              href="/#courses"
              className="hidden h-10 items-center bg-red px-5 text-[0.82rem] font-medium text-ivory transition-colors duration-300 hover:bg-red-deep md:inline-flex"
            >
              مشاهده دوره‌ها
            </Link>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={open}
              className="grid size-10 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:text-red xl:hidden"
            >
              <Menu className="size-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile full-screen menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="منوی موبایل"
            className="noise-overlay fixed inset-0 z-[60] flex flex-col bg-ink"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <div className="container-site flex h-[4.5rem] items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن منو"
                className="grid size-10 place-items-center border border-line-light text-ivory transition-colors hover:border-red hover:text-red"
              >
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>

            <nav
              aria-label="ناوبری موبایل"
              className="container-site flex flex-1 flex-col justify-center overflow-y-auto py-8"
            >
              <ul className="flex flex-col">
                {navLinks.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={reduce ? false : { opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.08 + i * 0.05,
                      duration: 0.5,
                      ease: EASE_OUT,
                    }}
                    className="border-b border-line-light/60"
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-baseline justify-between py-4 text-2xl font-bold text-ivory transition-colors hover:text-red"
                    >
                      {link.label}
                      <span
                        className="text-label-latin text-fog transition-colors group-hover:text-red"
                        dir="ltr"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5, ease: EASE_OUT }}
                className="mt-10 flex flex-col gap-5"
              >
                <Link
                  href="/search/"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center gap-2 border border-line-light px-6 text-sm font-medium text-ivory transition-colors hover:border-red hover:text-red"
                >
                  <Search className="size-4" strokeWidth={1.5} />
                  جستجو
                </Link>
                <Link
                  href="/#courses"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center bg-red px-6 text-sm font-medium text-ivory transition-colors hover:bg-red-deep"
                >
                  مشاهده دوره‌ها
                </Link>
                <a
                  href={`tel:${site.mobile}`}
                  className="flex items-center gap-2.5 text-sm text-fog transition-colors hover:text-ivory"
                >
                  <Phone className="size-4 text-red" strokeWidth={1.5} />
                  <span dir="ltr">{site.mobile}</span>
                </a>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
