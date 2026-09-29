"use client";

import Link from "next/link";
import { useState } from "react";
import {
  buildWorkPayload,
  saveWork,
  type AdminStatus,
  type WorkFormState,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import {
  Field,
  FormError,
  Select,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/admin/AdminForm";

const STATUSES: AdminStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export const EMPTY_WORK_FORM: WorkFormState = {
  slug: "",
  customPath: "",
  title: "",
  student: "",
  category: "",
  mediaId: "",
  contentHtml: "",
  seoTitle: "",
  seoDescription: "",
  seoCanonicalUrl: "",
  seoNoindex: false,
  status: "DRAFT",
};

type WorkFieldsProps = {
  form: WorkFormState;
  pending: boolean;
  onChange: <K extends keyof WorkFormState>(key: K, value: WorkFormState[K]) => void;
  prefix: string;
};

export function WorkFields({ form, pending, onChange, prefix }: WorkFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor={`${prefix}-slug`} label="اسلاگ">
          <TextInput
            id={`${prefix}-slug`}
            dir="ltr"
            required
            value={form.slug}
            disabled={pending}
            onChange={(event) => onChange("slug", event.target.value)}
          />
        </Field>
        <Field htmlFor={`${prefix}-custom-path`} label="مسیر دلخواه" hint="مثل 2024/09/25/عنوان-اثر — خالی یعنی همان آدرس پیش‌فرض">
          <TextInput
            id={`${prefix}-custom-path`}
            dir="ltr"
            value={form.customPath ?? ""}
            disabled={pending}
            onChange={(event) => onChange("customPath", event.target.value)}
            placeholder="2024/09/25/..."
          />
        </Field>
        <Field htmlFor={`${prefix}-title`} label="عنوان">
          <TextInput
            id={`${prefix}-title`}
            required
            value={form.title}
            disabled={pending}
            onChange={(event) => onChange("title", event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor={`${prefix}-student`} label="هنرجو">
          <TextInput
            id={`${prefix}-student`}
            value={form.student ?? ""}
            disabled={pending}
            onChange={(event) => onChange("student", event.target.value)}
          />
        </Field>
        <Field htmlFor={`${prefix}-category`} label="دسته">
          <TextInput
            id={`${prefix}-category`}
            required
            value={form.category}
            disabled={pending}
            onChange={(event) => onChange("category", event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor={`${prefix}-media`} label="شناسه رسانه (اختیاری)">
          <TextInput
            id={`${prefix}-media`}
            dir="ltr"
            value={form.mediaId ?? ""}
            disabled={pending}
            onChange={(event) => onChange("mediaId", event.target.value)}
          />
        </Field>
        <Field htmlFor={`${prefix}-status`} label="وضعیت">
          <Select
            id={`${prefix}-status`}
            value={form.status}
            disabled={pending}
            onChange={(event) => onChange("status", event.target.value as AdminStatus)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field htmlFor={`${prefix}-content`} label="محتوای HTML">
        <Textarea
          id={`${prefix}-content`}
          rows={8}
          required
          dir="ltr"
          value={form.contentHtml}
          disabled={pending}
          onChange={(event) => onChange("contentHtml", event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor={`${prefix}-seo-title`} label="عنوان سئو">
          <TextInput
            id={`${prefix}-seo-title`}
            value={form.seoTitle ?? ""}
            disabled={pending}
            onChange={(event) => onChange("seoTitle", event.target.value)}
          />
        </Field>
        <Field htmlFor={`${prefix}-seo-canonical`} label=" canonical سئو">
          <TextInput
            id={`${prefix}-seo-canonical`}
            dir="ltr"
            value={form.seoCanonicalUrl ?? ""}
            disabled={pending}
            onChange={(event) => onChange("seoCanonicalUrl", event.target.value)}
          />
        </Field>
      </div>
      <Field htmlFor={`${prefix}-seo-description`} label="توضیح سئو">
        <Textarea
          id={`${prefix}-seo-description`}
          rows={2}
          value={form.seoDescription ?? ""}
          disabled={pending}
          onChange={(event) => onChange("seoDescription", event.target.value)}
        />
      </Field>
      <div className="flex items-center gap-2">
        <input
          id={`${prefix}-seo-noindex`}
          type="checkbox"
          checked={form.seoNoindex === true}
          disabled={pending}
          onChange={(event) => onChange("seoNoindex", event.target.checked)}
          className="size-4"
        />
        <label htmlFor={`${prefix}-seo-noindex`} className="text-sm">
          عدم نمایه‌سازی (noindex)
        </label>
      </div>
    </>
  );
}

export default function AdminWorkNewPage() {
  const [form, setForm] = useState<WorkFormState>({ ...EMPTY_WORK_FORM });
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unauthenticated, setUnauthenticated] = useState(false);

  function handleChange<K extends keyof WorkFormState>(key: K, value: WorkFormState[K]) {
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
      form.category.trim().length === 0 ||
      form.contentHtml.trim().length === 0
    ) {
      setError("پر کردن اسلاگ، عنوان، دسته و محتوا ضروری است.");
      return;
    }
    setPending(true);
    try {
      const created = await saveWork(fetch, buildWorkPayload(form));
      setForm({ ...EMPTY_WORK_FORM });
      setOk(`نمونه‌کار ساخته شد: ${created.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setUnauthenticated(true);
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("ساخت نمونه‌کار ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (unauthenticated) {
    return (
      <section aria-labelledby="work-new-title" className="max-w-xl">
        <h1 id="work-new-title" className="text-h3">
          نمونه‌کار تازه
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ساخت نمونه‌کار ابتدا وارد شوید.
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
    <section aria-labelledby="work-new-title" className="max-w-3xl">
      <h1 id="work-new-title" className="text-h3">
        نمونه‌کار تازه
      </h1>
      <p className="mt-4">
        <Link href="/admin/works" className="text-sm underline">
          بازگشت به نمونه‌کارها
        </Link>
      </p>
      <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 flex flex-col gap-4" noValidate>
        <WorkFields form={form} pending={pending} onChange={handleChange} prefix="work" />
        <FormError id="work-new-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به نمونه‌کارها ندارید.
          </p>
        )}
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}{" "}
            <Link href="/admin/works" className="underline">
              بازگشت به نمونه‌کارها
            </Link>
          </p>
        )}
        <div>
          <SubmitButton pending={pending}>{pending ? "در حال ساخت…" : "ساخت نمونه‌کار"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
