"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildDepartmentPayload,
  getDepartment,
  saveDepartment,
  type DepartmentFormState,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { Field, FormError, Select, SubmitButton, TextInput, Textarea } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminDepartmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [phase, setPhase] = useState<Phase>("loading");
  const [form, setForm] = useState<DepartmentFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const item = await getDepartment(fetch, id);
        if (cancelled) return;
        setForm({
          slug: item.slug,
          label: item.label,
          latin: item.latin,
          description: item.description,
          status: item.status,
          seoTitle: item.seo.title ?? "",
          seoDescription: item.seo.description ?? "",
          seoCanonicalUrl: item.seo.canonicalUrl ?? "",
          seoNoindex: item.seo.noindex,
        });
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "unauthorized") {
          setPhase("unauthenticated");
          return;
        }
        setError("دریافت دپارتمان ناموفق بود.");
        setPhase("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function set<K extends keyof DepartmentFormState>(key: K, value: DepartmentFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    setOk(null);
    if (
      form.slug.trim().length === 0 ||
      form.label.trim().length === 0 ||
      form.latin.trim().length === 0 ||
      form.description.trim().length === 0
    ) {
      setError("پر کردن اسلاگ، عنوان، لاتین و توضیح ضروری است.");
      return;
    }
    setSaving(true);
    try {
      await saveDepartment(fetch, { ...buildDepartmentPayload(form), id });
      setOk("تغییرات ذخیره شد.");
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      setError("ذخیره دپارتمان ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="dep-detail-title" className="max-w-2xl">
        <h1 id="dep-detail-title" className="text-h3">
          ویرایش دپارتمان
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="dep-detail-title" className="max-w-xl">
        <h1 id="dep-detail-title" className="text-h3">
          ویرایش دپارتمان
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ویرایش دپارتمان ابتدا وارد شوید.
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
      <section aria-labelledby="dep-detail-title" className="max-w-xl">
        <h1 id="dep-detail-title" className="text-h3">
          ویرایش دپارتمان
        </h1>
        <p aria-live="polite" role="alert" className="mt-4 text-sm text-red">
          {error ?? "موردی یافت نشد."}
        </p>
        <p className="mt-6">
          <Link href="/admin/departments" className="text-sm underline">
            بازگشت به دپارتمان‌ها
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="dep-detail-title" className="max-w-2xl">
      <h1 id="dep-detail-title" className="text-h3">
        ویرایش دپارتمان
      </h1>
      <p className="mt-4">
        <Link href="/admin/departments" className="text-sm underline">
          بازگشت به دپارتمان‌ها
        </Link>
      </p>
      <form onSubmit={(event) => void handleSave(event)} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="dep-edit-slug" label="اسلاگ">
            <TextInput
              id="dep-edit-slug"
              dir="ltr"
              required
              value={form.slug}
              disabled={saving}
              onChange={(event) => set("slug", event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "dep-edit-error" : undefined}
            />
          </Field>
          <Field htmlFor="dep-edit-label" label="عنوان">
            <TextInput
              id="dep-edit-label"
              required
              value={form.label}
              disabled={saving}
              onChange={(event) => set("label", event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "dep-edit-error" : undefined}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="dep-edit-latin" label="عنوان لاتین">
            <TextInput
              id="dep-edit-latin"
              dir="ltr"
              required
              value={form.latin}
              disabled={saving}
              onChange={(event) => set("latin", event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "dep-edit-error" : undefined}
            />
          </Field>
          <Field htmlFor="dep-edit-status" label="وضعیت">
            <Select
              id="dep-edit-status"
              value={form.status}
              disabled={saving}
              onChange={(event) => set("status", event.target.value as DepartmentFormState["status"])}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </Select>
          </Field>
        </div>
        <Field htmlFor="dep-edit-description" label="توضیح">
          <Textarea
            id="dep-edit-description"
            required
            value={form.description}
            disabled={saving}
            onChange={(event) => set("description", event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "dep-edit-error" : undefined}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="dep-edit-seo-title" label="عنوان سئو">
            <TextInput
              id="dep-edit-seo-title"
              value={form.seoTitle ?? ""}
              disabled={saving}
              onChange={(event) => set("seoTitle", event.target.value)}
            />
          </Field>
          <Field htmlFor="dep-edit-seo-canonical" label=" canonical سئو">
            <TextInput
              id="dep-edit-seo-canonical"
              dir="ltr"
              value={form.seoCanonicalUrl ?? ""}
              disabled={saving}
              onChange={(event) => set("seoCanonicalUrl", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="dep-edit-seo-description" label="توضیح سئو">
          <Textarea
            id="dep-edit-seo-description"
            rows={2}
            value={form.seoDescription ?? ""}
            disabled={saving}
            onChange={(event) => set("seoDescription", event.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="dep-edit-seo-noindex"
            type="checkbox"
            checked={form.seoNoindex === true}
            disabled={saving}
            onChange={(event) => set("seoNoindex", event.target.checked)}
            className="size-4"
          />
          <label htmlFor="dep-edit-seo-noindex" className="text-sm">
            عدم نمایه‌سازی (noindex)
          </label>
        </div>
        <FormError id="dep-edit-error" message={error} />
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}
          </p>
        )}
        <div>
          <SubmitButton pending={saving}>{saving ? "در حال ذخیره…" : "ذخیره"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
