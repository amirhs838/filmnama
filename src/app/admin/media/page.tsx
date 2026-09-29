"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildMediaPayload,
  createMedia,
  listMedia,
  patchMediaAlt,
  removeMedia,
  uploadFileError,
  uploadMedia,
  MEDIA_MIME_TYPES,
  type Media,
  type MediaFormState,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { mediaSrc } from "@/lib/content-contract";
import {
  Field,
  FormError,
  Select,
  SubmitButton,
  TextInput,
} from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

const EMPTY: MediaFormState = {
  storageKey: "",
  mimeType: "image/jpeg",
  size: "",
  alt: "",
};

export default function AdminMediaPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<Media[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [mimeFilter, setMimeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [form, setForm] = useState<MediaFormState>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [savingAlt, setSavingAlt] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!getAdminTokens()) {
        setPhase("unauthenticated");
        return;
      }
      const page = await listMedia(fetch, {
        mime: mimeFilter.length > 0 ? mimeFilter : undefined,
        limit: 20,
        cursor: cursor ?? undefined,
      });
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setPhase("ready");
    },
    [mimeFilter],
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
        setError("دریافت رسانه‌ها ناموفق بود.");
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
      setError("دریافت رسانه‌ها ناموفق بود.");
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

  function set<K extends keyof MediaFormState>(key: K, value: MediaFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreateOk(null);
    if (
      form.storageKey.trim().length === 0 ||
      form.mimeType.trim().length === 0 ||
      form.size.trim().length === 0
    ) {
      setCreateError("پر کردن کلید ذخیره‌سازی، نوع و اندازه ضروری است.");
      return;
    }
    setCreating(true);
    try {
      const created = await createMedia(fetch, buildMediaPayload(form));
      setItems((prev) => [created, ...prev]);
      setForm(EMPTY);
      setCreateOk(`رسانه ساخته شد: ${created.id}`);
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
        setCreateError("این کلید ذخیره‌سازی قبلاً ثبت شده است.");
        return;
      }
      setCreateError("ساخت رسانه ناموفق بود.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveAlt(id: string) {
    setError(null);
    setSavingAlt(true);
    try {
      const updated = await patchMediaAlt(fetch, id, editAlt.trim());
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setEditingId(null);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("ذخیره متن جایگزین ناموفق بود.");
    } finally {
      setSavingAlt(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("این رسانه حذف شود؟")) return;
    setError(null);
    setDeletingId(id);
    try {
      await removeMedia(fetch, id);
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
        setError("این رسانه هنوز به آلبوم یا نمونه‌کاری ارجاع دارد و حذف نمی‌شود.");
        return;
      }
      setError("حذف رسانه ناموفق بود.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setUploadOk(null);
    if (!file) {
      setUploadError("فایلی انتخاب نشده است.");
      return;
    }
    const problem = uploadFileError({ size: file.size, type: file.type });
    if (problem === "unsupported_type") {
      setUploadError("نوع فایل مجاز نیست (jpeg/png/webp/mp4).");
      return;
    }
    if (problem === "too_large") {
      setUploadError("حجم فایل بیشتر از ۱۲ مگابایت است.");
      return;
    }
    if (problem === "empty") {
      setUploadError("فایل انتخاب‌شده خالی است.");
      return;
    }
    setUploading(true);
    try {
      const created = await uploadMedia(fetch, file, uploadAlt.trim());
      setItems((prev) => [created, ...prev]);
      setFile(null);
      setUploadAlt("");
      if (fileRef.current) fileRef.current.value = "";
      setUploadOk(`فایل بارگذاری شد: ${created.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      if (err instanceof Error && err.message === "rejected") {
        setUploadError("فایل نامعتبر است.");
        return;
      }
      if (err instanceof Error && err.message === "body_too_large") {
        setUploadError("حجم فایل بیشتر از ۱۲ مگابایت است.");
        return;
      }
      if (err instanceof Error && err.message === "unsupported_media_type") {
        setUploadError("نوع فایل مجاز نیست (jpeg/png/webp/mp4).");
        return;
      }
      setUploadError("بارگذاری فایل ناموفق بود.");
    } finally {
      setUploading(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="media-title" className="max-w-4xl">
        <h1 id="media-title" className="text-h3">
          رسانه‌ها
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="media-title" className="max-w-xl">
        <h1 id="media-title" className="text-h3">
          رسانه‌ها
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت رسانه‌ها ابتدا وارد شوید.
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
    <section aria-labelledby="media-title" className="max-w-4xl">
      <h1 id="media-title" className="text-h3">
        رسانه‌ها
      </h1>
      <form onSubmit={(event) => void handleApply(event)} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
        <Field htmlFor="media-mime-filter" label="پالایه نوع">
          <Select
            id="media-mime-filter"
            value={mimeFilter}
            disabled={applying}
            onChange={(event) => setMimeFilter(event.target.value)}
          >
            <option value="">همه</option>
            {MEDIA_MIME_TYPES.map((mime) => (
              <option key={mime} value={mime}>
                {mime}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
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
          دسترسی به رسانه‌ها ندارید.
        </p>
      )}
      {items.length === 0 && !forbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          رسانه‌ای یافت نشد.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border border-line text-sm">
            <thead>
              <tr className="bg-ink text-ivory">
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  کلید ذخیره‌سازی
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  نوع
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  اندازه
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  متن جایگزین
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  عملیات
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-3 py-2.5" dir="ltr">
                    {item.mimeType.startsWith("image/") ? (
                      <span className="flex items-center gap-2">
                        <img
                          src={mediaSrc(item.id)}
                          alt={item.alt || "پیش‌نمایش"}
                          className="h-10 w-auto border border-line"
                          loading="lazy"
                        />
                        <span>{item.storageKey}</span>
                      </span>
                    ) : (
                      item.storageKey
                    )}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {item.mimeType}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {item.size}
                  </td>
                  <td className="px-3 py-2.5">
                    {editingId === item.id ? (
                      <span className="flex items-center gap-2">
                        <TextInput
                          id={`media-alt-${item.id}`}
                          aria-label="متن جایگزین"
                          value={editAlt}
                          disabled={savingAlt}
                          onChange={(event) => setEditAlt(event.target.value)}
                        />
                        <button
                          type="button"
                          disabled={savingAlt}
                          onClick={() => void handleSaveAlt(item.id)}
                          className="border border-line-strong px-3 py-1.5 text-sm disabled:opacity-60"
                        >
                          {savingAlt ? "در حال ذخیره…" : "ذخیره"}
                        </button>
                        <button
                          type="button"
                          disabled={savingAlt}
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-sm underline disabled:opacity-60"
                        >
                          انصراف
                        </button>
                      </span>
                    ) : (
                      item.alt
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-3">
                      {editingId !== item.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditAlt(item.alt);
                          }}
                          className="text-sm underline"
                        >
                          ویرایش alt
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item.id)}
                        className="border border-line-strong px-3 py-1.5 text-sm disabled:opacity-60"
                      >
                        {deletingId === item.id ? "در حال حذف…" : "حذف"}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      <h2 className="mt-10 text-h3">بارگذاری فایل</h2>
      <form onSubmit={(event) => void handleUpload(event)} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="media-file" label="فایل" hint="jpeg/png/webp/mp4 تا ۱۲ مگابایت">
            <input
              id="media-file"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              disabled={uploading}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="border border-line-strong bg-ivory px-3 py-2.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
            />
          </Field>
          <Field htmlFor="media-upload-alt" label="متن جایگزین">
            <TextInput
              id="media-upload-alt"
              value={uploadAlt}
              maxLength={500}
              disabled={uploading}
              onChange={(event) => setUploadAlt(event.target.value)}
            />
          </Field>
        </div>
        <FormError id="media-upload-error" message={uploadError} />
        {uploadOk && (
          <p aria-live="polite" className="text-sm">
            {uploadOk}
          </p>
        )}
        <div>
          <SubmitButton pending={uploading}>{uploading ? "در حال بارگذاری…" : "بارگذاری فایل"}</SubmitButton>
        </div>
      </form>

      <h2 className="mt-10 text-h3">ثبت فراداده رسانه</h2>
      <form onSubmit={(event) => void handleCreate(event)} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="media-storage" label="کلید ذخیره‌سازی">
            <TextInput
              id="media-storage"
              dir="ltr"
              required
              value={form.storageKey}
              disabled={creating}
              onChange={(event) => set("storageKey", event.target.value)}
            />
          </Field>
          <Field htmlFor="media-mime" label="نوع">
            <Select
              id="media-mime"
              value={form.mimeType}
              disabled={creating}
              onChange={(event) => set("mimeType", event.target.value)}
            >
              {MEDIA_MIME_TYPES.map((mime) => (
                <option key={mime} value={mime}>
                  {mime}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="media-size" label="اندازه (بایت)">
            <TextInput
              id="media-size"
              dir="ltr"
              required
              inputMode="numeric"
              value={form.size}
              disabled={creating}
              onChange={(event) => set("size", event.target.value)}
            />
          </Field>
          <Field htmlFor="media-alt" label="متن جایگزین">
            <TextInput
              id="media-alt"
              value={form.alt}
              disabled={creating}
              onChange={(event) => set("alt", event.target.value)}
            />
          </Field>
        </div>
        <FormError id="media-create-error" message={createError} />
        {createOk && (
          <p aria-live="polite" className="text-sm">
            {createOk}
          </p>
        )}
        <div>
          <SubmitButton pending={creating}>{creating ? "در حال ثبت…" : "ثبت رسانه"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
