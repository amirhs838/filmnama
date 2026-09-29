import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-site section-y mt-20">
      <p className="text-label-latin text-red" dir="ltr">404</p>
      <h1 className="mt-4 text-3xl font-extrabold">صفحه پیدا نشد</h1>
      <p className="mt-6 text-sm leading-8 text-smoke">این صفحه وجود ندارد یا دیگر منتشر نمی‌شود.</p>
      <Link href="/courses/" className="mt-8 inline-flex h-12 items-center bg-red px-6 text-sm font-medium text-ivory transition-colors hover:bg-red-deep">مشاهده دوره‌ها</Link>
    </section>
  );
}
