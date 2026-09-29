"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listPosts,
  removePost,
  type Post,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { Field, TextInput } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminBlogPostsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!getAdminTokens()) {
        setPhase("unauthenticated");
        return;
      }
      const page = await listPosts(fetch, {
        category: category.trim().length > 0 ? category.trim() : undefined,
        tag: tag.trim().length > 0 ? tag.trim() : undefined,
        limit: 20,
        cursor: cursor ?? undefined,
      });
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setPhase("ready");
    },
    [category, tag],
  );

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      try {
        await fetchPage(null, false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "unauthorized") {
          setPhase("unauthenticated");
          return;
        }
        if (err instanceof Error && err.message === "forbidden") {
          setForbidden(true);
          setPhase("ready");
          return;
        }
        setError("دریافت نوشته‌ها ناموفق بود.");
        setPhase("ready");
      }
    }
    void initial();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function handleApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setForbidden(false);
    setApplying(true);
    try {
      await fetchPage(null, false);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("دریافت نوشته‌ها ناموفق بود.");
    } finally {
      setApplying(false);
    }
  }

  async function handleMore() {
    if (!nextCursor) return;
    setError(null);
    setLoadingMore(true);
    try {
      await fetchPage(nextCursor, true);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("دریافت صفحه بعد ناموفق بود.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("این نوشته حذف شود؟")) return;
    setError(null);
    setDeletingId(id);
    try {
      await removePost(fetch, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("حذف نوشته ناموفق بود.");
    } finally {
      setDeletingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="posts-title" className="max-w-4xl">
        <h1 id="posts-title" className="text-h3">
          نوشته‌ها
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="posts-title" className="max-w-xl">
        <h1 id="posts-title" className="text-h3">
          نوشته‌ها
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت نوشته‌ها ابتدا وارد شوید.
        </p>
        <p className="mt-6">
          <Link href="/admin/login" className="bg-ink px-4 py-2.5 text-sm text-ivory">
            رفتن به ورود
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="posts-title" className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 id="posts-title" className="text-h3">
          نوشته‌ها
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/blog" className="text-sm underline">
            وبلاگ
          </Link>
          <Link href="/admin/blog/posts/new" className="bg-ink px-4 py-2.5 text-sm text-ivory">
            نوشته تازه
          </Link>
        </div>
      </div>
      <form onSubmit={(event) => void handleApply(event)} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
        <Field htmlFor="posts-category" label="پالایه دسته (اسلاگ)">
          <TextInput
            id="posts-category"
            dir="ltr"
            value={category}
            disabled={applying}
            onChange={(event) => setCategory(event.target.value)}
          />
        </Field>
        <Field htmlFor="posts-tag" label="پالایه برچسب (اسلاگ)">
          <TextInput
            id="posts-tag"
            dir="ltr"
            value={tag}
            disabled={applying}
            onChange={(event) => setTag(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={applying}
            className="h-11 bg-ink px-4 text-sm font-medium text-ivory transition-colors hover:bg-ink-3 disabled:opacity-60"
          >
            {applying ? "در حال اعمال…" : "اعمال پالایه"}
          </button>
        </div>
      </form>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {error ?? ""}
      </p>
      {forbidden && (
        <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
          دسترسی به نوشته‌های وبلاگ ندارید.
        </p>
      )}
      {items.length === 0 && !forbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          نوشته‌ای یافت نشد.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-line bg-ivory px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-1 text-xs text-smoke" dir="ltr">
                  {item.slug} — {item.status}
                </p>
                {item.customPath && (
                  <p className="mt-1 text-xs font-bold text-red" dir="ltr">
                    /{item.customPath}/
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={item.customPath ? `/${item.customPath}/` : `/blog/${item.slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                >
                  مشاهده
                </a>
                <Link href={`/admin/blog/posts/${item.id}`} className="text-sm underline">
                  ویرایش
                </Link>
                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={() => void handleDelete(item.id)}
                  className="border border-line-strong px-3 py-1.5 text-sm disabled:opacity-60"
                >
                  {deletingId === item.id ? "در حال حذف…" : "حذف"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {nextCursor && (
        <div className="mt-6">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void handleMore()}
            className="h-11 border border-line-strong px-4 text-sm disabled:opacity-60"
          >
            {loadingMore ? "در حال بارگذاری…" : "صفحه بعد"}
          </button>
        </div>
      )}
    </section>
  );
}
