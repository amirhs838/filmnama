"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listCourses,
  listDepartments,
  type Course,
  type Department,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { Field, Select } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminCoursesPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      setError(null);
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const [deps, crs] = await Promise.all([
          listDepartments(fetch),
          listCourses(fetch),
        ]);
        if (cancelled) return;
        setDepartments(deps.items);
        setCourses(crs.items);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "unauthorized") {
          setPhase("unauthenticated");
          return;
        }
        setError("دریافت دوره‌ها ناموفق بود.");
        setPhase("ready");
      }
    }
    void initial();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFilterChange(value: string) {
    setFilter(value);
    setError(null);
    if (!getAdminTokens()) {
      setPhase("unauthenticated");
      return;
    }
    try {
      const crs = await listCourses(fetch, value.length > 0 ? value : undefined);
      setCourses(crs.items);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      setError("دریافت دوره‌ها ناموفق بود.");
    }
  }

  function departmentLabel(id: string): string {
    return departments.find((dep) => dep.id === id)?.label ?? id;
  }
  function departmentSlug(id: string): string {
    return departments.find((dep) => dep.id === id)?.slug ?? "";
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="courses-title" className="max-w-3xl">
        <h1 id="courses-title" className="text-h3">
          دوره‌ها
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="courses-title" className="max-w-xl">
        <h1 id="courses-title" className="text-h3">
          دوره‌ها
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت دوره‌ها ابتدا وارد شوید.
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
    <section aria-labelledby="courses-title" className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 id="courses-title" className="text-h3">
          دوره‌ها
        </h1>
        <Link href="/admin/courses/new" className="bg-ink px-4 py-2.5 text-sm text-ivory">
          دوره تازه
        </Link>
      </div>
      <div className="mt-6 max-w-sm">
        <Field htmlFor="course-department-filter" label="پالایه دپارتمان">
          <Select
            id="course-department-filter"
            value={filter}
            onChange={(event) => handleFilterChange(event.target.value)}
          >
            <option value="">همه دپارتمان‌ها</option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {error ?? ""}
      </p>
      {courses.length === 0 ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          دوره‌ای یافت نشد.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-line bg-ivory px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold">{course.title}</p>
                <p className="mt-1 text-xs text-smoke" dir="ltr">
                  {course.slug} — {course.status} — {departmentLabel(course.departmentId)}
                </p>
                {course.customPath && (
                  <p className="mt-1 text-xs font-bold text-red" dir="ltr">
                    /{course.customPath}/
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {(course.customPath || departmentSlug(course.departmentId)) && (
                  <a
                    href={course.customPath ? `/${course.customPath}/` : `/courses/${departmentSlug(course.departmentId)}/${course.slug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline"
                  >
                    مشاهده
                  </a>
                )}
                <Link href={`/admin/courses/${course.id}`} className="text-sm underline">
                  ویرایش
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
