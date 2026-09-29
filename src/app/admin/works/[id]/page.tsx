"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildWorkPayload,
  getWork,
  saveWork,
  type WorkFormState,
  type WorkInput,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { FormError } from "@/components/admin/AdminForm";
import { EMPTY_WORK_FORM, WorkFields } from "@/app/admin/works/new/page";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminWorkDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [phase, setPhase] = useState<Phase>("loading");
  const [form, setForm] = useState<WorkFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const work = await getWork(fetch, id);
        if (cancelled) return;
        setForm({
          ...EMPTY_WORK_FORM,
          slug: work.slug,
          customPath: work.customPath ?? "",
          title: work.title,
          student: work.student,
          category: work.category,
          mediaId: work.mediaId ?? "",
          contentHtml: work.contentHtml,
          seoTitle: work.seo.title ?? "",
          seoDescription: work.seo.description ?? "",
          seoCanonicalUrl: work.seo.canonicalUrl ?? "",
          seoNoindex: work.seo.noindex,
          status: work.status,
        });
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
        setError("دریافت نمونه‌کار ناموفق بود.");
        setPhase("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleChange<K extends keyof WorkFormState>(key: K, value: WorkFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(payload: WorkInput) {
    setError(null);
    setForbidden(false);
    setOk(null);
    setPending(true);
    try {
      await saveWork(fetch, { ...payload, id });
      setOk("تغییرات ذخیره شد.");
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("ذخیره نمونه‌کار ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="work-detail-title" className="max-w-3xl">
        <h1 id="work-detail-title" className="text-h3">
          ویرایش نمونه‌کار
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="work-detail-title" className="max-w-xl">
        <h1 id="work-detail-title" className="text-h3">
          ویرایش نمونه‌کار
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ویرایش نمونه‌کار ابتدا وارد شوید.
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
      <section aria-labelledby="work-detail-title" className="max-w-xl">
        <h1 id="work-detail-title" className="text-h3">
          ویرایش نمونه‌کار
        </h1>
        <p aria-live="polite" role="alert" className="mt-4 text-sm text-red">
          {error ?? "موردی یافت نشد."}
        </p>
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به نمونه‌کارها ندارید.
          </p>
        )}
        <p className="mt-6">
          <Link href="/admin/works" className="text-sm underline">
            بازگشت به نمونه‌کارها
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="work-detail-title" className="max-w-3xl">
      <h1 id="work-detail-title" className="text-h3">
        ویرایش نمونه‌کار
      </h1>
      <p className="mt-4">
        <Link href="/admin/works" className="text-sm underline">
          بازگشت به نمونه‌کارها
        </Link>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            form.slug.trim().length === 0 ||
            form.title.trim().length === 0 ||
            form.category.trim().length === 0 ||
            form.contentHtml.trim().length === 0
          ) {
            setError("پر کردن اسلاگ، عنوان، دسته و محتوا ضروری است.");
            return;
          }
          void handleSubmit(buildWorkPayload(form));
        }}
        className="mt-6 flex flex-col gap-4"
        noValidate
      >
        <div key={id}>
          <WorkFields form={form} pending={pending} onChange={handleChange} prefix="work" />
        </div>
        <FormError id="work-detail-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به نمونه‌کارها ندارید.
          </p>
        )}
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending === true}
            className="h-11 bg-ink px-4 text-sm font-medium text-ivory transition-colors hover:bg-ink-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </form>
    </section>
  );
}
