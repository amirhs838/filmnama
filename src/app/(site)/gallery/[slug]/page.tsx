import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { getAlbum } from "@/lib/public-content";
import { albumPath, mediaSrc } from "@/lib/content-contract";
import { contentMetadata } from "@/lib/content-seo";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props["params"]) {
  const { slug } = await params;
  const album = await getAlbum(slug);
  if (!album) notFound();
  return album;
}

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const album = await load(params);
  return contentMetadata(album.title, album.description || album.title, albumPath(album), album.seo);
}

export default async function AlbumPage({ params }: Props) {
  const album = await load(params);
  const path = albumPath(album);
  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs items={[{ name: "خانه", path: "/" }, { name: "گالری", path: "/gallery/" }, { name: album.title, path }]} />
        <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">{album.title}</h1>
        {album.description && <p className="mt-4 max-w-2xl text-base font-light leading-9 text-smoke">{album.description}</p>}
      </div>
      <div className="container-site grid gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
        {album.items.map((item) => (
          <figure key={item.id} className="border border-line bg-ivory-2 p-6">
            {item.media.mimeType.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaSrc(item.mediaId)} alt={item.media.alt || item.title} loading="lazy" className="mb-4 aspect-[4/3] w-full border border-line object-cover" />
            )}
            {item.media.mimeType.startsWith("video/") && (
              <video src={mediaSrc(item.mediaId)} controls preload="metadata" className="mb-4 aspect-[4/3] w-full border border-line bg-ink" aria-label={item.media.alt || item.title} />
            )}
            <figcaption className="text-base font-bold">{item.title}</figcaption>
            {item.media.alt && <p className="mt-2 text-sm font-light text-smoke">{item.media.alt}</p>}
          </figure>
        ))}
      </div>
      {album.items.length === 0 && (
        <div className="container-site pb-16">
          <p className="border border-line bg-ivory-2 p-8 text-center text-sm leading-8 text-smoke">این آلبوم هنوز تصویری ندارد.</p>
        </div>
      )}
    </div>
  );
}
