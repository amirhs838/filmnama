import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Briefcase, FileText, Film, GraduationCap, Images, Inbox, Layers, LayoutDashboard, LogIn, Newspaper, Settings, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "مدیریت فیلم‌نما",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-ivory text-ink">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-l border-line bg-ink px-5 py-8 text-ivory">
        <p className="text-sm font-extrabold">مدیریت فیلم‌نما</p>
        <nav aria-label="ناوبری مدیریت">
          <ul className="flex flex-col gap-2">
            <li>
              <Link
                href="/admin"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <LayoutDashboard
                  className="size-4 shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                داشبورد
              </Link>
            </li>
            <li>
              <Link
                href="/admin/courses"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <BookOpen
                  className="size-4 shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                دوره‌ها
              </Link>
            </li>
            <li>
              <Link
                href="/admin/departments"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Layers className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                دپارتمان‌ها
              </Link>
            </li>
            <li>
              <Link
                href="/admin/instructors"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <GraduationCap className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                اساتید
              </Link>
            </li>
            <li>
              <Link
                href="/admin/blog"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Newspaper className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                وبلاگ
              </Link>
            </li>
            <li>
              <Link
                href="/admin/gallery"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Images className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                گالری
              </Link>
            </li>
            <li>
              <Link
                href="/admin/works"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Briefcase className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                نمونه‌کار
              </Link>
            </li>
            <li>
              <Link
                href="/admin/media"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Film className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                رسانه
              </Link>
            </li>
            <li>
              <Link
                href="/admin/leads"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Inbox className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                پیام‌ها
              </Link>
            </li>
            <li>
              <Link
                href="/admin/settings"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Settings className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                تنظیمات
              </Link>
            </li>
            <li>
              <Link
                href="/admin/users"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <Users className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                کاربران
              </Link>
            </li>
            <li>
              <Link
                href="/admin/reports"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <FileText className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                گزارش‌ها
              </Link>
            </li>
            <li>
              <Link
                href="/admin/login"
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fog transition-colors hover:bg-ink-3 hover:text-ivory"
              >
                <LogIn className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                ورود
              </Link>
            </li>
          </ul>
        </nav>
        <p className="mt-auto text-xs leading-6 text-fog">
          بخش‌های مدیریتی در گام بعد اضافه می‌شود.
        </p>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">{children}</main>
    </div>
  );
}
