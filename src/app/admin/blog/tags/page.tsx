"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildTagPayload,
  listTags,
  removeTag,
  saveTag,
  type Tag,
  type TagFormState,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { Field, FormError, SubmitButton, TextInput } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

const EMPTY: TagFormState = { slug: "", title: "" };

export default function AdminBlogTagsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<TagFormState>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TagFormState>(EMPTY);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      setError(null);
      setForbidden(false);
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const result = await listTags(fetch);
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
        setError("دریافت برچسب‌ها ناموفق بود.");
        setPhase("ready");
      }
    }
    void initial();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    if (form.slug.trim().length === 0 || form.title.trim().length === 0) {
      setCreateError("پر کردن اسلاگ و عنوان ضروری است.");
      return;
    }
    setCreating(true);
    try {
      const created = await saveTag(fetch, buildTagPayload(form));
      setItems((prev) => [...prev, created]);
      setForm(EMPTY);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setCreateError("ساخت برچسب ناموفق بود.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: Tag) {
    setEditingId(item.id);
    setEditForm({ slug: item.slug, title: item.title });
    setSaveError(null);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setSaveError(null);
    if (editForm.slug.trim().length === 0 || editForm.title.trim().length === 0) {
      setSaveError("پر کردن اسلاگ و عنوان ضروری است.");
      return;
    }
    setSavingId(id);
    try {
      const updated = await saveTag(fetch, { ...buildTagPayload(editForm), id });
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
      setSaveError("ذخیره برچسب ناموفق بود.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("این برچسب حذف شود؟")) return;
    setError(null);
    setDeletingId(id);
    try {
      await removeTag(fetch, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("حذف برچسب ناموفق بود.");
    } finally {
      setDeletingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="tags-title" className="max-w-3xl">
        <h1 id="tags-title" className="text-h3">
          برچسب‌های وبلاگ
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="tags-title" className="max-w-xl">
        <h1 id="tags-title" className="text-h3">
          برچسب‌های وبلاگ
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت برچسب‌ها ابتدا وارد شوید.
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
    <section aria-labelledby="tags-title" className="max-w-3xl">
      <h1 id="tags-title" className="text-h3">
        برچسب‌های وبلاگ
      </h1>
      <p className="mt-4">
        <Link href="/admin/blog" className="text-sm underline">
          بازگشت به وبلاگ
        </Link>
      </p>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {error ?? ""}
      </p>
      {forbidden && (
        <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
          دسترسی به برچسب‌های وبلاگ ندارید.
        </p>
      )}
      {items.length === 0 && !forbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          هنوز برچسبی ثبت نشده است.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="border border-line bg-ivory px-4 py-3">
              {editingId === item.id ? (
                <form onSubmit={(event) => void handleSave(event, item.id)} className="flex flex-col gap-3" noValidate>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field htmlFor={`tag-edit-slug-${item.id}`} label="اسلاگ">
                      <TextInput
                        id={`tag-edit-slug-${item.id}`}
                        dir="ltr"
                        required
                        value={editForm.slug}
                        disabled={savingId === item.id}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, slug: event.target.value }))}
                      />
                    </Field>
                    <Field htmlFor={`tag-edit-title-${item.id}`} label="عنوان">
                      <TextInput
                        id={`tag-edit-title-${item.id}`}
                        required
                        value={editForm.title}
                        disabled={savingId === item.id}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </Field>
                  </div>
                  <FormError id={`tag-edit-error-${item.id}`} message={saveError} />
                  <div className="flex items-center gap-3">
                    <SubmitButton pending={savingId === item.id}>
                      {savingId === item.id ? "در حال ذخیره…" : "ذخیره"}
                    </SubmitButton>
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => setEditingId(null)}
                      className="border border-line-strong px-3 py-2 text-sm disabled:opacity-60"
                    >
                      انصراف
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="mt-1 text-xs text-smoke" dir="ltr">
                      {item.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-sm underline"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                      className="border border-line-strong px-3 py-1.5 text-sm disabled:opacity-60"
                    >
                      {deletingId === item.id ? "در حال حذف…" : "حذف"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-10 text-h3">ساخت برچسب</h2>
      <form onSubmit={(event) => void handleCreate(event)} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="tag-slug" label="اسلاگ">
            <TextInput
              id="tag-slug"
              dir="ltr"
              required
              value={form.slug}
              disabled={creating}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              aria-invalid={createError ? true : undefined}
              aria-describedby={createError ? "tag-form-error" : undefined}
            />
          </Field>
          <Field htmlFor="tag-title" label="عنوان">
            <TextInput
              id="tag-title"
              required
              value={form.title}
              disabled={creating}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              aria-invalid={createError ? true : undefined}
              aria-describedby={createError ? "tag-form-error" : undefined}
            />
          </Field>
        </div>
        <FormError id="tag-form-error" message={createError} />
        <div>
          <SubmitButton pending={creating}>{creating ? "در حال ساخت…" : "ساخت برچسب"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
