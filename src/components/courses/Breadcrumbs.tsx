import Link from "next/link";
import { breadcrumbJsonLd, serializeJsonLd, type BreadcrumbItem } from "@/lib/structured-data";
import { siteOrigin } from "@/lib/content-seo";

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <>
      <nav aria-label="مسیر صفحه" className="mb-10 text-sm text-smoke">
        <ol className="flex flex-wrap items-center gap-3">
          {items.map((item, index) => (
            <li key={item.path} className="flex items-center gap-3">
              {index > 0 && <span aria-hidden className="text-red">/</span>}
              {index === items.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.path} className="transition-colors hover:text-red">{item.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(items, siteOrigin())) }} />
    </>
  );
}
