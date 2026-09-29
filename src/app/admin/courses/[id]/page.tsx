"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getCourse,
  listDepartments,
  listMedia,
  saveCourse,
  type CourseFormState,
  type CourseInput,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import CourseForm, { type CoverOption, type DepartmentOption } from "@/components/admin/CourseForm";
import { FormError } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [phase, setPhase] = useState<Phase>("loading");
  const [options, setOptions] = useState<DepartmentOption[]>([]);
  const [covers, setCovers] = useState<CoverOption[]>([]);
  const [initial, setInitial] = useState<CourseFormState | null>(null);
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
        const [deps, media, course] = await Promise.all([
          listDepartments(fetch),
          listMedia(fetch, { limit: 100 }).catch(() => ({ items: [], nextCursor: null })),
          getCourse(fetch, id),
        ]);
        if (cancelled) return;
        setOptions(deps.items.map((dep) => ({ id: dep.id, label: dep.label })));
        setCovers(media.items.map((item) => ({ id: item.id, alt: item.alt, mimeType: item.mimeType })));
        setInitial({
          slug: course.slug,
          customPath: course.customPath ?? "",
          departmentId: course.departmentId,
          title: course.title,
          latin: course.latin,
          description: course.description,
          level: course.level,
          duration: course.duration,
          iconKey: course.iconKey,
          contentHtml: course.contentHtml,
          syllabusText: course.syllabus.join("\n"),
          faq: course.faq.length > 0 ? course.faq.map((row) => ({ ...row })) : [{ question: "", answer: "" }],
          instructorIdsText: course.instructorIds.join(", "),
          coverMediaId: course.coverMediaId ?? "",
          seoTitle: course.seo.title ?? "",
          seoDescription: course.seo.description ?? "",
          seoCanonicalUrl: course.seo.canonicalUrl ?? "",
          seoNoindex: course.seo.noindex,
          status: course.status,
        });
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "unauthorized") {
          setPhase("unauthenticated");
          return;
        }
        setError("دریافت دوره ناموفق بود.");
        setPhase("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(payload: CourseInput) {
    setError(null);
    setOk(null);
    setPending(true);
    try {
      await saveCourse(fetch, { ...payload, id });
      setOk("تغییرات ذخیره شد.");
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      setError("ذخیره دوره ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="course-detail-title" className="max-w-3xl">
        <h1 id="course-detail-title" className="text-h3">
          ویرایش دوره
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="course-detail-title" className="max-w-xl">
        <h1 id="course-detail-title" className="text-h3">
          ویرایش دوره
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ویرایش دوره ابتدا وارد شوید.
        </p>
        <p className="mt-6">
          <Link href="/admin/login" className="bg-ink px-4 py-2.5 text-sm text-ivory">
            رفتن به ورود
          </Link>
        </p>
      </section>
    );
  }

  if (!initial) {
    return (
      <section aria-labelledby="course-detail-title" className="max-w-xl">
        <h1 id="course-detail-title" className="text-h3">
          ویرایش دوره
        </h1>
        <p aria-live="polite" role="alert" className="mt-4 text-sm text-red">
          {error ?? "موردی یافت نشد."}
        </p>
        <p className="mt-6">
          <Link href="/admin/courses" className="text-sm underline">
            بازگشت به دوره‌ها
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="course-detail-title" className="max-w-3xl">
      <h1 id="course-detail-title" className="text-h3">
        ویرایش دوره
      </h1>
      <p className="mt-4">
        <Link href="/admin/courses" className="text-sm underline">
          بازگشت به دوره‌ها
        </Link>
      </p>
      <div className="mt-6" key={id}>
        <CourseForm
          initial={initial}
          departmentOptions={options}
          coverOptions={covers}
          pending={pending}
          submitLabel={pending ? "در حال ذخیره…" : "ذخیره"}
          onSubmit={(payload) => void handleSubmit(payload)}
        />
      </div>
      <div className="mt-4">
        <FormError id="course-detail-error" message={error} />
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}
          </p>
        )}
      </div>
    </section>
  );
}
