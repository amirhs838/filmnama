"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listAlbums, removeAlbum, type Album } from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminGalleryPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<Album[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const result = await listAlbums(fetch);
        if (cancelled) return;
        setItems(result.items);
        setPhase("ready");
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
        setError("دریافت آلبوم‌ها ناموفق بود.");
        setPhase("ready");
      }
    }
    void initial();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("این آلبوم حذف شود؟")) return;
    setError(null);
    setDeletingId(id);
    try {
      await removeAlbum(fetch, id);
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
      if (err instanceof Error && err.message === "conflict") {
        setError("آلبوم دارای عنصر است؛ ابتدا عناصر آن را حذف کنید.");
        return;
      }
      setError("حذف آلبوم ناموفق بود.");
    } finally {
      setDeletingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="gallery-title" className="max-w-4xl">
        <h1 id="gallery-title" className="text-h3">
          گالری
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="gallery-title" className="max-w-xl">
        <h1 id="gallery-title" className="text-h3">
          گالری
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت گالری ابتدا وارد شوید.
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
    <section aria-labelledby="gallery-title" className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 id="gallery-title" className="text-h3">
          گالری
        </h1>
        <Link href="/admin/gallery/new" className="bg-ink px-4 py-2.5 text-sm text-ivory">
          آلبوم تازه
        </Link>
      </div>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {error ?? ""}
      </p>
      {forbidden && (
        <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
          دسترسی به گالری ندارید.
        </p>
      )}
      {items.length === 0 && !forbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          هنوز آلبومی ثبت نشده است.
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
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/admin/gallery/${item.id}`} className="text-sm underline">
                  ویرایش و عناصر
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
    </section>
  );
}
