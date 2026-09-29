"use client";

import Link from "next/link";

const LINKS = [
  { href: "/admin/blog/posts", title: "نوشته‌ها", hint: "فهرست، پالایه، ساخت و ویرایش نوشته‌ها" },
  { href: "/admin/blog/categories", title: "دسته‌ها", hint: "ساخت و ویرایش دسته‌های وبلاگ" },
  { href: "/admin/blog/tags", title: "برچسب‌ها", hint: "ساخت و ویرایش برچسب‌های وبلاگ" },
];

export default function AdminBlogPage() {
  return (
    <section aria-labelledby="blog-title" className="max-w-2xl">
      <h1 id="blog-title" className="text-h3">
        وبلاگ
      </h1>
      <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
        مدیریت نوشته‌ها، دسته‌ها و برچسب‌های وبلاگ.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {LINKS.map((link) => (
          <li key={link.href} className="border border-line bg-ivory px-4 py-5">
            <p className="text-sm font-bold">
              <Link href={link.href} className="underline">
                {link.title}
              </Link>
            </p>
            <p className="mt-2 text-xs leading-6 text-smoke">{link.hint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
