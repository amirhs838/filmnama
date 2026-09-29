"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminTokens, mapAdminError, parseMe } from "@/lib/admin-auth";
import { listCourses, listDepartments, listLeads, listMedia, listRevalidation, listWorks } from "@/lib/admin-api";

type Me = { id: string; role: string };
type Phase = "loading" | "unauthenticated" | "ready" | "error";

export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [departments, setDepartments] = useState<number | null>(null);
  const [courses, setCourses] = useState<number | null>(null);
  const [leads, setLeads] = useState<number | null>(null);
  const [leadsDenied, setLeadsDenied] = useState(false);
  const [works, setWorks] = useState<number | null>(null);
  const [worksDenied, setWorksDenied] = useState(false);
  const [media, setMedia] = useState<number | null>(null);
  const [mediaDenied, setMediaDenied] = useState(false);
  const [pendingOutbox, setPendingOutbox] = useState<number | null>(null);
  const [outboxDenied, setOutboxDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const tokens = getAdminTokens();
      if (!tokens) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const res = await fetch("/api/admin/auth/me", {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          credentials: "same-origin",
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setPhase("unauthenticated");
          return;
        }
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          throw new Error("invalid_response");
        }
        if (!res.ok) throw new Error(mapAdminError(res.status));
        const parsed = parseMe(body);
        if (!parsed) throw new Error("invalid_response");
        const deps = await listDepartments(fetch);
        const crs = await listCourses(fetch);
        let leadCount: number | null = null;
        let denied = false;
        try {
          const page = await listLeads(fetch, { status: "NEW", limit: 20 });
          leadCount = page.items.length;
        } catch (leadError) {
          if (leadError instanceof Error && leadError.message === "forbidden") {
            denied = true;
          } else {
            throw leadError;
          }
        }
        let workCount: number | null = null;
        let workDenied = false;
        try {
          const result = await listWorks(fetch);
          workCount = result.items.length;
        } catch (workError) {
          if (workError instanceof Error && workError.message === "forbidden") {
            workDenied = true;
          } else {
            throw workError;
          }
        }
        let mediaCount: number | null = null;
        let mediaDenied = false;
        try {
          const result = await listMedia(fetch, { limit: 20 });
          mediaCount = result.items.length;
        } catch (mediaError) {
          if (mediaError instanceof Error && mediaError.message === "forbidden") {
            mediaDenied = true;
          } else {
            throw mediaError;
          }
        }
        let pendingCount: number | null = null;
        let pendingDenied = false;
        try {
          const result = await listRevalidation(fetch, { pending: true, limit: 20 });
          pendingCount = result.items.length;
        } catch (outboxError) {
          if (outboxError instanceof Error && outboxError.message === "forbidden") {
            pendingDenied = true;
          } else {
            throw outboxError;
          }
        }
        if (cancelled) return;
        setMe(parsed);
        setDepartments(deps.items.length);
        setCourses(crs.items.length);
        setLeads(leadCount);
        setLeadsDenied(denied);
        setWorks(workCount);
        setWorksDenied(workDenied);
        setMedia(mediaCount);
        setMediaDenied(mediaDenied);
        setPendingOutbox(pendingCount);
        setOutboxDenied(pendingDenied);
        setPhase("ready");
      } catch {
        if (!cancelled) {
          setError("دریافت اطلاعات داشبورد ناموفق بود.");
          setPhase("error");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "loading") {
    return (
      <section aria-labelledby="admin-title" className="max-w-xl">
        <h1 id="admin-title" className="text-h3">
          داشبورد مدیریت
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="admin-title" className="max-w-xl">
        <h1 id="admin-title" className="text-h3">
          داشبورد مدیریت
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مشاهده داشبورد ابتدا وارد شوید.
        </p>
        <p className="mt-6">
          <Link href="/admin/login" className="bg-ink px-4 py-2.5 text-sm text-ivory">
            رفتن به ورود
          </Link>
        </p>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section aria-labelledby="admin-title" className="max-w-xl">
        <h1 id="admin-title" className="text-h3">
          داشبورد مدیریت
        </h1>
        <p aria-live="polite" role="alert" className="mt-4 text-sm text-red">
          {error ?? ""}
        </p>
        <p className="mt-6">
          <Link href="/admin/login" className="border border-line-strong px-4 py-2.5 text-sm">
            رفتن به ورود
          </Link>
        </p>
      </section>
    );
  }

  const empty =
    departments === 0 &&
    courses === 0 &&
    (leads === 0 || leads === null) &&
    (works === 0 || works === null) &&
    (media === 0 || media === null);

  return (
    <section aria-labelledby="admin-title" className="max-w-2xl">
      <h1 id="admin-title" className="text-h3">
        داشبورد مدیریت
      </h1>
      <div aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
        {me && (
          <p>
            شناسه: <span dir="ltr">{me.id}</span> — نقش: <span dir="ltr">{me.role}</span>
          </p>
        )}
        {empty && <p className="mt-2">هنوز موردی ثبت نشده است.</p>}
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="border border-line bg-ivory px-4 py-5">
          <dt className="text-sm text-smoke">دپارتمان‌ها</dt>
          <dd className="mt-2 text-2xl font-extrabold" aria-live="polite">
            {departments ?? "—"}
          </dd>
          <dd className="mt-3">
            <Link href="/admin/departments" className="text-sm underline">
              مدیریت دپارتمان‌ها
            </Link>
          </dd>
        </div>
        <div className="border border-line bg-ivory px-4 py-5">
          <dt className="text-sm text-smoke">دوره‌ها</dt>
          <dd className="mt-2 text-2xl font-extrabold" aria-live="polite">
            {courses ?? "—"}
          </dd>
          <dd className="mt-3">
            <Link href="/admin/courses" className="text-sm underline">
              مدیریت دوره‌ها
            </Link>
          </dd>
        </div>
        <div className="border border-line bg-ivory px-4 py-5">
          <dt className="text-sm text-smoke">پیام‌های تازه</dt>
          <dd className="mt-2 text-2xl font-extrabold" aria-live="polite">
            {leadsDenied ? "—" : (leads ?? "—")}
          </dd>
          <dd className="mt-3 text-sm">
            {leadsDenied ? (
              <span aria-live="polite">مشاهده پیام‌ها فقط برای SUPER_ADMIN است.</span>
            ) : (
              <Link href="/admin/leads" className="underline">
                مدیریت پیام‌ها
              </Link>
            )}
          </dd>
        </div>
        <div className="border border-line bg-ivory px-4 py-5">
          <dt className="text-sm text-smoke">نمونه‌کارها</dt>
          <dd className="mt-2 text-2xl font-extrabold" aria-live="polite">
            {worksDenied ? "—" : (works ?? "—")}
          </dd>
          <dd className="mt-3">
            <Link href="/admin/works" className="text-sm underline">
              مدیریت نمونه‌کارها
            </Link>
          </dd>
        </div>
        <div className="border border-line bg-ivory px-4 py-5">
          <dt className="text-sm text-smoke">رسانه‌ها</dt>
          <dd className="mt-2 text-2xl font-extrabold" aria-live="polite">
            {mediaDenied ? "—" : (media ?? "—")}
          </dd>
          <dd className="mt-3">
            <Link href="/admin/media" className="text-sm underline">
              مدیریت رسانه‌ها
            </Link>
          </dd>
        </div>
        <div className="border border-line bg-ivory px-4 py-5">
          <dt className="text-sm text-smoke">بازاعتبارسنجی در انتظار</dt>
          <dd className="mt-2 text-2xl font-extrabold" aria-live="polite">
            {outboxDenied ? "—" : (pendingOutbox ?? "—")}
          </dd>
          <dd className="mt-3">
            <Link href="/admin/reports" className="text-sm underline">
              مشاهده گزارش‌ها
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
