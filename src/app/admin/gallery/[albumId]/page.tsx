"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildAlbumItemPayload,
  buildAlbumPayload,
  getAlbum,
  listAlbumItems,
  listMedia,
  removeAlbumItem,
  saveAlbum,
  saveAlbumItem,
  type AdminStatus,
  type AlbumFormState,
  type AlbumItem,
  type AlbumItemFormState,
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

type Phase = "loading" | "unauthenticated" | "ready";

const STATUSES: AdminStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

function emptyItemForm(albumId: string): AlbumItemFormState {
  return {
    albumId,
    mediaId: "",
    title: "",
    caption: "",
    position: "0",
    status: "DRAFT",
  };
}

export default function AdminAlbumDetailPage() {
  const params = useParams<{ albumId: string }>();
  const albumId = params.albumId;
  const [phase, setPhase] = useState<Phase>("loading");
  const [form, setForm] = useState<AlbumFormState | null>(null);
  const [covers, setCovers] = useState<Media[]>([]);
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [itemForm, setItemForm] = useState<AlbumItemFormState>(emptyItemForm(albumId));
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemOk, setItemOk] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const [album, page, media] = await Promise.all([
          getAlbum(fetch, albumId),
          listAlbumItems(fetch, { albumId }),
          listMedia(fetch, { limit: 100 }).catch(() => ({ items: [], nextCursor: null })),
        ]);
        if (cancelled) return;
        setCovers(media.items);
        setForm({
          slug: album.slug,
          title: album.title,
          description: album.description,
          coverMediaId: album.coverMediaId ?? "",
          status: album.status,
          seoTitle: album.seo.title ?? "",
          seoDescription: album.seo.description ?? "",
          seoCanonicalUrl: album.seo.canonicalUrl ?? "",
          seoNoindex: album.seo.noindex,
        });
        setItems(page.items);
        setItemForm(emptyItemForm(albumId));
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
        setError("دریافت آلبوم ناموفق بود.");
        setPhase("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  function set<K extends keyof AlbumFormState>(key: K, value: AlbumFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setItem<K extends keyof AlbumItemFormState>(key: K, value: AlbumItemFormState[K]) {
    setItemForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    setForbidden(false);
    setOk(null);
    if (
      form.slug.trim().length === 0 ||
      form.title.trim().length === 0 ||
      form.description.trim().length === 0
    ) {
      setError("پر کردن اسلاگ، عنوان و توضیح ضروری است.");
      return;
    }
    setSaving(true);
    try {
      await saveAlbum(fetch, { ...buildAlbumPayload(form), id: albumId });
      setOk("تغییرات آلبوم ذخیره شد.");
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("ذخیره آلبوم ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setItemError(null);
    setItemOk(null);
    if (
      itemForm.mediaId.trim().length === 0 ||
      itemForm.title.trim().length === 0 ||
      itemForm.position.trim().length === 0
    ) {
      setItemError("پر کردن شناسه رسانه، عنوان و جایگاه ضروری است.");
      return;
    }
    setAdding(true);
    try {
      const created = await saveAlbumItem(fetch, buildAlbumItemPayload({ ...itemForm, albumId }));
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1)),
      );
      setItemForm(emptyItemForm(albumId));
      setItemOk("عنصر به آلبوم افزوده شد.");
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setItemError("افزودن عنصر ناموفق بود.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteItem(id: string) {
    if (!window.confirm("این عنصر حذف شود؟")) return;
    setItemError(null);
    setDeletingId(id);
    try {
      await removeAlbumItem(fetch, id);
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
      setItemError("حذف عنصر ناموفق بود.");
    } finally {
      setDeletingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="album-detail-title" className="max-w-3xl">
        <h1 id="album-detail-title" className="text-h3">
          ویرایش آلبوم
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="album-detail-title" className="max-w-xl">
        <h1 id="album-detail-title" className="text-h3">
          ویرایش آلبوم
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ویرایش آلبوم ابتدا وارد شوید.
        </p>
        <p className="mt-6">
          <Link href="/admin/login" className="bg-ink px-4 py-2.5 text-sm text-ivory">
            رفتن به ورود
          </Link>
        </p>
      </section>
    );
  }

  if (!form) {
    return (
      <section aria-labelledby="album-detail-title" className="max-w-xl">
        <h1 id="album-detail-title" className="text-h3">
          ویرایش آلبوم
        </h1>
        <p aria-live="polite" role="alert" className="mt-4 text-sm text-red">
          {error ?? "موردی یافت نشد."}
        </p>
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به گالری ندارید.
          </p>
        )}
        <p className="mt-6">
          <Link href="/admin/gallery" className="text-sm underline">
            بازگشت به گالری
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="album-detail-title" className="max-w-3xl">
      <h1 id="album-detail-title" className="text-h3">
        ویرایش آلبوم
      </h1>
      <p className="mt-4">
        <Link href="/admin/gallery" className="text-sm underline">
          بازگشت به گالری
        </Link>
      </p>
      <form onSubmit={(event) => void handleSave(event)} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="album-slug" label="اسلاگ">
            <TextInput
              id="album-slug"
              dir="ltr"
              required
              value={form.slug}
              disabled={saving}
              onChange={(event) => set("slug", event.target.value)}
            />
          </Field>
          <Field htmlFor="album-title" label="عنوان">
            <TextInput
              id="album-title"
              required
              value={form.title}
              disabled={saving}
              onChange={(event) => set("title", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="album-description" label="توضیح">
          <Textarea
            id="album-description"
            required
            value={form.description}
            disabled={saving}
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>
        <Field htmlFor="album-cover" label="کاور">
          <Select
            id="album-cover"
            value={form.coverMediaId ?? ""}
            disabled={saving}
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
            disabled={saving}
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
              disabled={saving}
              onChange={(event) => set("seoTitle", event.target.value)}
            />
          </Field>
          <Field htmlFor="album-seo-canonical" label=" canonical سئو">
            <TextInput
              id="album-seo-canonical"
              dir="ltr"
              value={form.seoCanonicalUrl ?? ""}
              disabled={saving}
              onChange={(event) => set("seoCanonicalUrl", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="album-seo-description" label="توضیح سئو">
          <Textarea
            id="album-seo-description"
            rows={2}
            value={form.seoDescription ?? ""}
            disabled={saving}
            onChange={(event) => set("seoDescription", event.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="album-seo-noindex"
            type="checkbox"
            checked={form.seoNoindex === true}
            disabled={saving}
            onChange={(event) => set("seoNoindex", event.target.checked)}
            className="size-4"
          />
          <label htmlFor="album-seo-noindex" className="text-sm">
            عدم نمایه‌سازی (noindex)
          </label>
        </div>
        <FormError id="album-detail-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به گالری ندارید.
          </p>
        )}
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}
          </p>
        )}
        <div>
          <SubmitButton pending={saving}>{saving ? "در حال ذخیره…" : "ذخیره آلبوم"}</SubmitButton>
        </div>
      </form>

      <h2 className="mt-10 text-h3">عناصر آلبوم</h2>
      {items.length === 0 ? (
        <p aria-live="polite" className="mt-4 text-sm text-smoke">
          هنوز عنصری در این آلبوم ثبت نشده است.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-line bg-ivory px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  <span dir="ltr" className="ml-2 inline-block min-w-8 text-xs text-smoke">
                    #{item.position}
                  </span>
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-smoke" dir="ltr">
                  media: {item.mediaId}
                </p>
              </div>
              <button
                type="button"
                disabled={deletingId === item.id}
                onClick={() => void handleDeleteItem(item.id)}
                className="border border-line-strong px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {deletingId === item.id ? "در حال حذف…" : "حذف"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 text-h3">افزودن عنصر</h3>
      <form onSubmit={(event) => void handleAddItem(event)} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="item-media" label="شناسه رسانه">
            <TextInput
              id="item-media"
              dir="ltr"
              required
              value={itemForm.mediaId}
              disabled={adding}
              onChange={(event) => setItem("mediaId", event.target.value)}
            />
          </Field>
          <Field htmlFor="item-title" label="عنوان">
            <TextInput
              id="item-title"
              required
              value={itemForm.title}
              disabled={adding}
              onChange={(event) => setItem("title", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="item-caption" label="زیرنویس">
          <Textarea
            id="item-caption"
            rows={2}
            value={itemForm.caption ?? ""}
            disabled={adding}
            onChange={(event) => setItem("caption", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="item-position" label="جایگاه">
            <TextInput
              id="item-position"
              dir="ltr"
              required
              inputMode="numeric"
              value={itemForm.position}
              disabled={adding}
              onChange={(event) => setItem("position", event.target.value)}
            />
          </Field>
          <Field htmlFor="item-status" label="وضعیت">
            <Select
              id="item-status"
              value={itemForm.status}
              disabled={adding}
              onChange={(event) => setItem("status", event.target.value as AdminStatus)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <FormError id="album-item-error" message={itemError} />
        {itemOk && (
          <p aria-live="polite" className="text-sm">
            {itemOk}
          </p>
        )}
        <div>
          <SubmitButton pending={adding}>{adding ? "در حال افزودن…" : "افزودن عنصر"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
