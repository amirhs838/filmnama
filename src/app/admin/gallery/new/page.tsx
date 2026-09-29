"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildAlbumPayload,
  listMedia,
  saveAlbum,
  type AdminStatus,
  type AlbumFormState,
  type Media,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { mediaSrc } from "@/lib/content-contract";
import {
  Field,
  FormError,
  Select,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/admin/AdminForm";

const EMPTY: AlbumFormState = {
  slug: "",
  title: "",
  description: "",
  coverMediaId: "",
  status: "DRAFT",
  seoTitle: "",
  seoDescription: "",
  seoCanonicalUrl: "",
  seoNoindex: false,
};

const STATUSES: AdminStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export default function AdminGalleryNewPage() {
  const [form, setForm] = useState<AlbumFormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [covers, setCovers] = useState<Media[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAdminTokens()) return;
      try {
        const media = await listMedia(fetch, { limit: 100 });
        if (!cancelled) setCovers(media.items);
      } catch {
        if (!cancelled) setCovers([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof AlbumFormState>(key: K, value: AlbumFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setForbidden(false);
    setOk(null);
    if (!getAdminTokens()) {
      setUnauthenticated(true);
      return;
    }
    if (
      form.slug.trim().length === 0 ||
      form.title.trim().length === 0 ||
      form.description.trim().length === 0
    ) {
      setError("پر کردن اسلاگ، عنوان و توضیح ضروری است.");
      return;
    }
    setPending(true);
    try {
      const created = await saveAlbum(fetch, buildAlbumPayload(form));
      setForm(EMPTY);
      setOk(`آلبوم ساخته شد: ${created.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setUnauthenticated(true);
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("ساخت آلبوم ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (unauthenticated) {
    return (
      <section aria-labelledby="album-new-title" className="max-w-xl">
        <h1 id="album-new-title" className="text-h3">
          آلبوم تازه
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ساخت آلبوم ابتدا وارد شوید.
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
    <section aria-labelledby="album-new-title" className="max-w-3xl">
      <h1 id="album-new-title" className="text-h3">
        آلبوم تازه
      </h1>
      <p className="mt-4">
        <Link href="/admin/gallery" className="text-sm underline">
          بازگشت به گالری
        </Link>
      </p>
      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="album-slug" label="اسلاگ">
            <TextInput
              id="album-slug"
              dir="ltr"
              required
              value={form.slug}
              disabled={pending}
              onChange={(event) => set("slug", event.target.value)}
            />
          </Field>
          <Field htmlFor="album-title" label="عنوان">
            <TextInput
              id="album-title"
              required
              value={form.title}
              disabled={pending}
              onChange={(event) => set("title", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="album-description" label="توضیح">
          <Textarea
            id="album-description"
            required
            value={form.description}
            disabled={pending}
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>
        <Field htmlFor="album-cover" label="کاور">
          <Select
            id="album-cover"
            value={form.coverMediaId ?? ""}
            disabled={pending}
            onChange={(event) => set("coverMediaId", event.target.value)}
          >
            <option value="">بدون کاور</option>
            {covers.map((option) => (
              <option key={option.id} value={option.id}>
                {(option.alt || option.id).slice(0, 80)} · {option.mimeType}
              </option>
            ))}
          </Select>
        </Field>
        {(form.coverMediaId ?? "").trim().length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaSrc((form.coverMediaId ?? "").trim())}
            alt="پیش‌نمایش کاور"
            className="max-h-48 w-auto border border-line"
            loading="lazy"
          />
        )}
        <Field htmlFor="album-status" label="وضعیت">
          <Select
            id="album-status"
            value={form.status}
            disabled={pending}
            onChange={(event) => set("status", event.target.value as AdminStatus)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="album-seo-title" label="عنوان سئو">
            <TextInput
              id="album-seo-title"
              value={form.seoTitle ?? ""}
              disabled={pending}
              onChange={(event) => set("seoTitle", event.target.value)}
            />
          </Field>
          <Field htmlFor="album-seo-canonical" label=" canonical سئو">
            <TextInput
              id="album-seo-canonical"
              dir="ltr"
              value={form.seoCanonicalUrl ?? ""}
              disabled={pending}
              onChange={(event) => set("seoCanonicalUrl", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="album-seo-description" label="توضیح سئو">
          <Textarea
            id="album-seo-description"
            rows={2}
            value={form.seoDescription ?? ""}
            disabled={pending}
            onChange={(event) => set("seoDescription", event.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="album-seo-noindex"
            type="checkbox"
            checked={form.seoNoindex === true}
            disabled={pending}
            onChange={(event) => set("seoNoindex", event.target.checked)}
            className="size-4"
          />
          <label htmlFor="album-seo-noindex" className="text-sm">
            عدم نمایه‌سازی (noindex)
          </label>
        </div>
        <FormError id="album-new-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به گالری ندارید.
          </p>
        )}
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}{" "}
            <Link href="/admin/gallery" className="underline">
              بازگشت به گالری
            </Link>
          </p>
        )}
        <div>
          <SubmitButton pending={pending}>{pending ? "در حال ساخت…" : "ساخت آلبوم"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
