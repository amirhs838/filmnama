"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDepartments, listMedia, saveCourse, type CourseInput } from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import CourseForm, { type CoverOption, type DepartmentOption } from "@/components/admin/CourseForm";
import { FormError } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminCourseNewPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [options, setOptions] = useState<DepartmentOption[]>([]);
  const [covers, setCovers] = useState<CoverOption[]>([]);
  const [error, setError] = useState<string | null>(null);
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
        const [deps, media] = await Promise.all([
          listDepartments(fetch),
          listMedia(fetch, { limit: 100 }).catch(() => ({ items: [], nextCursor: null })),
        ]);
        if (cancelled) return;
        setOptions(deps.items.map((dep) => ({ id: dep.id, label: dep.label })));
        setCovers(media.items.map((item) => ({ id: item.id, alt: item.alt, mimeType: item.mimeType })));
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
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(payload: CourseInput) {
    setError(null);
    setOk(null);
    setPending(true);
    try {
      const created = await saveCourse(fetch, payload);
      setOk(`دوره ساخته شد: ${created.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      setError("ساخت دوره ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="course-new-title" className="max-w-3xl">
        <h1 id="course-new-title" className="text-h3">
          دوره تازه
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="course-new-title" className="max-w-xl">
        <h1 id="course-new-title" className="text-h3">
          دوره تازه
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ساخت دوره ابتدا وارد شوید.
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
    <section aria-labelledby="course-new-title" className="max-w-3xl">
      <h1 id="course-new-title" className="text-h3">
        دوره تازه
      </h1>
      <p className="mt-4">
        <Link href="/admin/courses" className="text-sm underline">
          بازگشت به دوره‌ها
        </Link>
      </p>
      <div className="mt-6">
        <CourseForm
          departmentOptions={options}
          coverOptions={covers}
          pending={pending}
          submitLabel={pending ? "در حال ساخت…" : "ساخت دوره"}
          onSubmit={(payload) => void handleSubmit(payload)}
        />
      </div>
      <div className="mt-4">
        <FormError id="course-new-error" message={error} />
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}{" "}
            <Link href="/admin/courses" className="underline">
              بازگشت به دوره‌ها
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
