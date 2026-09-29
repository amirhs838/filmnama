"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildDepartmentPayload,
  listDepartments,
  removeDepartment,
  saveDepartment,
  type Department,
  type DepartmentFormState,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { Field, FormError, Select, SubmitButton, TextInput, Textarea } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

const EMPTY: DepartmentFormState = {
  slug: "",
  label: "",
  latin: "",
  description: "",
  status: "DRAFT",
  seoTitle: "",
  seoDescription: "",
  seoCanonicalUrl: "",
  seoNoindex: false,
};

export default function AdminDepartmentsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentFormState>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      setError(null);
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const result = await listDepartments(fetch);
        if (cancelled) return;
        setItems(result.items);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "unauthorized") {
          setPhase("unauthenticated");
          return;
        }
        setError("دریافت دپارتمان‌ها ناموفق بود.");
        setPhase("ready");
      }
    }
    void initial();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof DepartmentFormState>(key: K, value: DepartmentFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreateOk(null);
    if (
      form.slug.trim().length === 0 ||
      form.label.trim().length === 0 ||
      form.latin.trim().length === 0 ||
      form.description.trim().length === 0
    ) {
      setCreateError("پر کردن اسلاگ، عنوان، لاتین و توضیح ضروری است.");
      return;
    }
    setCreating(true);
    try {
      const created = await saveDepartment(fetch, buildDepartmentPayload(form));
      setItems((prev) => [...prev, created]);
      setForm(EMPTY);
      setCreateOk("دپارتمان ساخته شد.");
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      setCreateError("ساخت دپارتمان ناموفق بود.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("این دپارتمان حذف شود؟")) return;
    setError(null);
    setDeletingId(id);
    try {
      await removeDepartment(fetch, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      setError("حذف دپارتمان ناموفق بود.");
    } finally {
      setDeletingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="departments-title" className="max-w-3xl">
        <h1 id="departments-title" className="text-h3">
          دپارتمان‌ها
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="departments-title" className="max-w-xl">
        <h1 id="departments-title" className="text-h3">
          دپارتمان‌ها
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت دپارتمان‌ها ابتدا وارد شوید.
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
    <section aria-labelledby="departments-title" className="max-w-3xl">
      <h1 id="departments-title" className="text-h3">
        دپارتمان‌ها
      </h1>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {error ?? ""}
      </p>
      {items.length === 0 ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          هنوز دپارتمانی ثبت نشده است.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-line bg-ivory px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold">{item.label}</p>
                <p className="mt-1 text-xs text-smoke" dir="ltr">
                  {item.slug} — {item.status}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/admin/departments/${item.id}`} className="text-sm underline">
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
      <h2 className="mt-10 text-h3">ساخت دپارتمان</h2>
      <form onSubmit={(event) => void handleCreate(event)} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="dep-slug" label="اسلاگ">
            <TextInput
              id="dep-slug"
              dir="ltr"
              required
              value={form.slug}
              disabled={creating}
              onChange={(event) => set("slug", event.target.value)}
              aria-invalid={createError ? true : undefined}
              aria-describedby={createError ? "dep-form-error" : undefined}
            />
          </Field>
          <Field htmlFor="dep-label" label="عنوان">
            <TextInput
              id="dep-label"
              required
              value={form.label}
              disabled={creating}
              onChange={(event) => set("label", event.target.value)}
              aria-invalid={createError ? true : undefined}
              aria-describedby={createError ? "dep-form-error" : undefined}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="dep-latin" label="عنوان لاتین">
            <TextInput
              id="dep-latin"
              dir="ltr"
              required
              value={form.latin}
              disabled={creating}
              onChange={(event) => set("latin", event.target.value)}
              aria-invalid={createError ? true : undefined}
              aria-describedby={createError ? "dep-form-error" : undefined}
            />
          </Field>
          <Field htmlFor="dep-status" label="وضعیت">
            <Select
              id="dep-status"
              value={form.status}
              disabled={creating}
              onChange={(event) => set("status", event.target.value as DepartmentFormState["status"])}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </Select>
          </Field>
        </div>
        <Field htmlFor="dep-description" label="توضیح">
          <Textarea
            id="dep-description"
            required
            value={form.description}
            disabled={creating}
            onChange={(event) => set("description", event.target.value)}
            aria-invalid={createError ? true : undefined}
            aria-describedby={createError ? "dep-form-error" : undefined}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="dep-seo-title" label="عنوان سئو">
            <TextInput
              id="dep-seo-title"
              value={form.seoTitle ?? ""}
              disabled={creating}
              onChange={(event) => set("seoTitle", event.target.value)}
            />
          </Field>
          <Field htmlFor="dep-seo-canonical" label=" canonical سئو">
            <TextInput
              id="dep-seo-canonical"
              dir="ltr"
              value={form.seoCanonicalUrl ?? ""}
              disabled={creating}
              onChange={(event) => set("seoCanonicalUrl", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="dep-seo-description" label="توضیح سئو">
          <Textarea
            id="dep-seo-description"
            rows={2}
            value={form.seoDescription ?? ""}
            disabled={creating}
            onChange={(event) => set("seoDescription", event.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="dep-seo-noindex"
            type="checkbox"
            checked={form.seoNoindex === true}
            disabled={creating}
            onChange={(event) => set("seoNoindex", event.target.checked)}
            className="size-4"
          />
          <label htmlFor="dep-seo-noindex" className="text-sm">
            عدم نمایه‌سازی (noindex)
          </label>
        </div>
        <FormError id="dep-form-error" message={createError} />
        {createOk && (
          <p aria-live="polite" className="text-sm">
            {createOk}
          </p>
        )}
        <div>
          <SubmitButton pending={creating}>{creating ? "در حال ساخت…" : "ساخت دپارتمان"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
