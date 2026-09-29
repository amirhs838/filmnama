import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/courses/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getSearch } from "@/lib/public-content";
import {
  mediaSrc,
  normalizeSearchQuery,
  normalizeSearchTypesParam,
  searchTypeParams,
  type SearchItemDto,
} from "@/lib/content-contract";
import { toFaDigits } from "@/lib/utils";

type Props = {
  searchParams: Promise<{ q?: string | string[]; types?: string | string[] }>;
};

function rawFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const trimmed = (rawFirst(params.q) ?? "").trim().slice(0, 100);
  return {
    title: trimmed ? `جستجو: ${trimmed}` : "جستجو",
    description: "جستجو در دوره‌ها، نوشته‌ها و اساتید فیلم‌نما",
    robots: { index: false, follow: true },
  };
}

const POPULAR = ["بازیگری", "کارگردانی", "فیلم‌برداری", "تدوین", "موسیقی"];

const TYPE_OPTIONS = [
  { value: "courses", label: "دوره‌ها" },
  { value: "posts", label: "نوشته‌ها" },
  { value: "instructors", label: "اساتید" },
] as const;

const KIND_HEADINGS: Record<SearchItemDto["kind"], string> = {
  course: "دوره‌ها",
  post: "نوشته‌ها",
  instructor: "اساتید",
};

function ResultCard({ item }: { item: SearchItemDto }) {
  const href = item.path.endsWith("/") ? item.path : `${item.path}/`;
  return (
    <article className="border border-line bg-ivory-2 p-6">
      {item.coverMedia && (
        <img
          src={mediaSrc(item.coverMedia.id)}
          alt={item.coverMedia.alt || item.title}
          className="mb-4 h-40 w-full object-cover"
          loading="lazy"
        />
      )}
      <h3 className="text-lg font-bold leading-8">
        <Link href={href} className="transition-colors hover:text-red">
          {item.title}
        </Link>
      </h3>
      {item.latin && (
        <p className="mt-1 text-xs text-smoke" dir="ltr">
          {item.latin}
        </p>
      )}
      {item.excerpt && (
        <p className="mt-3 line-clamp-3 text-sm font-light leading-8 text-smoke">{item.excerpt}</p>
      )}
      <Link
        href={href}
        className="mt-4 inline-block text-sm font-bold text-red underline underline-offset-8"
      >
        مشاهده
      </Link>
    </article>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawQ = rawFirst(params.q) ?? "";
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const validQuery = normalizeSearchQuery(q);
  const typesParam = normalizeSearchTypesParam(params.types);
  const selected =
    typesParam === undefined || typesParam === null
      ? [...searchTypeParams]
      : typesParam.split(",");
  const isSelected = (value: string) => selected.includes(value);

  let items: SearchItemDto[] = [];
  if (validQuery !== null && typesParam !== null) {
    items =
      typesParam === undefined
        ? await getSearch(validQuery, { limit: 20 })
        : await getSearch(validQuery, { types: typesParam, limit: 20 });
  }

  const grouped: { kind: SearchItemDto["kind"]; list: SearchItemDto[] }[] = (
    ["course", "post", "instructor"] as const
  )
    .map((kind) => ({ kind, list: items.filter((item) => item.kind === kind) }))
    .filter((group) => group.list.length > 0);

  return (
    <div className="pt-32 lg:pt-40" dir="rtl">
      <div className="container-site">
        <Breadcrumbs
          items={[
            { name: "خانه", path: "/" },
            { name: "جستجو", path: "/search/" },
          ]}
        />
        <SectionHeading
          index="01"
          label="SEARCH"
          level="h1"
          title="جست‌وجو"
          description="در میان دوره‌ها، مطالب بلاگ و اساتید فیلم‌نما جست‌وجو کنید."
        />

        <form method="GET" action="/search/" role="search" className="mt-8 border border-line bg-ivory-2 p-6">
          <label htmlFor="search-q" className="mb-3 block text-sm font-bold">
            عبارت جستجو
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="search-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="مثلاً بازیگری…"
              maxLength={100}
              autoComplete="off"
              className="h-12 flex-1 border border-line bg-ivory px-4 text-sm outline-none placeholder:text-smoke/60 focus:border-red"
            />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center bg-red px-8 text-sm font-medium text-ivory transition-colors hover:bg-red-deep"
            >
              جستجو
            </button>
          </div>
          <fieldset className="mt-5">
            <legend className="text-sm font-bold">نوع نتایج</legend>
            <div className="mt-3 flex flex-wrap gap-5">
              {TYPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="types"
                    value={option.value}
                    defaultChecked={isSelected(option.value)}
                    className="size-4 accent-red"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      </div>

      <div className="container-site py-12">
        {validQuery === null ? (
          <section aria-labelledby="search-guide" className="border border-line bg-ivory-2 p-8">
            <h2 id="search-guide" className="text-xl font-bold">
              چه چیزی را جستجو می‌کنید؟
            </h2>
            <p className="mt-3 text-sm font-light leading-8 text-smoke">
              عبارتی وارد کنید تا در دوره‌ها، نوشته‌ها و اساتید جستجو شود. برای شروع، یکی از
              پیشنهادها را امتحان کنید:
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {POPULAR.map((hint) => (
                <li key={hint}>
                  <Link
                    href={`/search/?q=${encodeURIComponent(hint)}`}
                    className="inline-block border border-line px-4 py-2 text-sm transition-colors hover:border-red hover:text-red"
                  >
                    {hint}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div role="status" aria-live="polite">
            <p className="text-sm text-smoke">
              {toFaDigits(items.length)} نتیجه برای «{validQuery}»
            </p>
            {items.length === 0 ? (
              <div className="mt-6 border border-line bg-ivory-2 p-8">
                <p className="text-center text-sm leading-8 text-smoke">
                  نتیجه‌ای یافت نشد. عبارت دیگری را امتحان کنید.
                </p>
                <ul className="mt-5 flex flex-wrap justify-center gap-2">
                  {POPULAR.map((hint) => (
                    <li key={hint}>
                      <Link
                        href={`/search/?q=${encodeURIComponent(hint)}`}
                        className="inline-block border border-line px-4 py-2 text-sm transition-colors hover:border-red hover:text-red"
                      >
                        {hint}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-10">
                {grouped.map((group) => (
                  <section key={group.kind} aria-labelledby={`search-${group.kind}`}>
                    <h2 id={`search-${group.kind}`} className="text-2xl font-extrabold">
                      {KIND_HEADINGS[group.kind]}{" "}
                      <span className="text-sm font-light text-smoke">
                        ({toFaDigits(group.list.length)})
                      </span>
                    </h2>
                    <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {group.list.map((item) => (
                        <ResultCard key={`${item.kind}:${item.path}`} item={item} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
