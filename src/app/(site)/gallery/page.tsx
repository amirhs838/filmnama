import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InitialTile } from "@/components/ui/InitialTile";
import { getAlbums } from "@/lib/public-content";
import { mediaSrc } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

export function generateMetadata() {
  const meta = contentMetadata("گالری", "آلبوم‌های تصویری فیلم‌نما", "/gallery/");
  return { ...meta, title: { absolute: "گالری - فیلم نما" } };
}

export default async function GalleryPage() {
  const albums = await getAlbums();
  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "گالری", path: "/gallery/" }]} />
        {/* H1 keeps the exact WP hub heading (migration: same-URL KEEP). */}
        <SectionHeading index="01" label="GALLERY" level="h1" title="گالری" description="منتخبی از حال‌وهوای کلاس‌ها و پشت صحنه." />
      </div>
      <div className="container-site grid gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => (
          <article key={album.id} className="border border-line bg-ivory-2 p-6">
            {album.coverMedia ? (
              // eslint-disable-next-line @next/next/no-img-element -- API hosts are not allowlisted for next/image.
              <img
                src={mediaSrc(album.coverMedia.id)}
                alt={album.coverMedia.alt || album.title}
                className="mb-4 aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            ) : (
              <InitialTile name={album.title} aspect="wide" className="mb-4" />
            )}
            <h2 className="text-xl font-bold">
              <Link href={`/gallery/${album.slug}/`} className="transition-colors hover:text-red">
                {album.title}
              </Link>
            </h2>
            {album.description && <p className="mt-3 text-sm font-light leading-8 text-smoke">{album.description}</p>}
          </article>
        ))}
      </div>
      {albums.length === 0 && (
        <div className="container-site pb-16">
          <p className="border border-line bg-ivory-2 p-8 text-center text-sm leading-8 text-smoke">آلبومی برای نمایش وجود ندارد.</p>
        </div>
      )}
    </div>
  );
}
