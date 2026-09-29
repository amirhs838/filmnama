"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listLeads, setLeadStatus, type Lead, type LeadStatus } from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import {
  leadNextActionLabel,
  leadStatusLabel,
  nextLeadStatus,
} from "@/lib/admin-ui";
import { Field, Select, TextInput } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

const LIMITS = ["10", "20", "50"];
const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "CLOSED"];

export default function AdminLeadsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<Lead[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [courseId, setCourseId] = useState("");
  const [limit, setLimit] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [applying, setApplying] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!getAdminTokens()) {
        setPhase("unauthenticated");
        return;
      }
      const parsedLimit = Number.parseInt(limit, 10);
      const page = await listLeads(
        fetch,
        {
          status: statusFilter.length > 0 ? (statusFilter as LeadStatus) : undefined,
          courseId: courseId.trim().length > 0 ? courseId.trim() : undefined,
          limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
          cursor: cursor ?? undefined,
        },
      );
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setPhase("ready");
    },
    [courseId, limit, statusFilter],
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
        setError("دریافت پیام‌ها ناموفق بود.");
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
      setError("دریافت پیام‌ها ناموفق بود.");
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

  async function handleStatus(lead: Lead) {
    const next = nextLeadStatus(lead.status);
    if (!next) return;
    setError(null);
    setForbidden(false);
    setPatchingId(lead.id);
    try {
      const updated = await setLeadStatus(fetch, lead.id, next);
      setItems((prev) =>
        prev.map((item) => (item.id === lead.id ? { ...item, status: updated.status } : item)),
      );
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("تغییر وضعیت ناموفق بود.");
    } finally {
      setPatchingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="leads-title" className="max-w-3xl">
        <h1 id="leads-title" className="text-h3">
          پیام‌ها
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="leads-title" className="max-w-xl">
        <h1 id="leads-title" className="text-h3">
          پیام‌ها
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مشاهده پیام‌ها ابتدا وارد شوید.
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
    <section aria-labelledby="leads-title" className="max-w-4xl">
      <h1 id="leads-title" className="text-h3">
        پیام‌ها
      </h1>
      <form onSubmit={(event) => void handleApply(event)} className="mt-6 grid gap-4 sm:grid-cols-3" noValidate>
        <Field htmlFor="leads-status" label="وضعیت">
          <Select
            id="leads-status"
            value={statusFilter}
            disabled={applying}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">همه</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="leads-course" label="شناسه دوره">
          <TextInput
            id="leads-course"
            dir="ltr"
            value={courseId}
            disabled={applying}
            onChange={(event) => setCourseId(event.target.value)}
          />
        </Field>
        <Field htmlFor="leads-limit" label="تعداد">
          <Select
            id="leads-limit"
            value={limit}
            disabled={applying}
            onChange={(event) => setLimit(event.target.value)}
          >
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-3">
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
          مشاهده و تغییر پیام‌ها فقط برای SUPER_ADMIN است.
        </p>
      )}
      <p className="mt-2 text-xs leading-6 text-smoke">
        نکته: در صورت خطای نامشخص، تکرار درخواست امن است؛ تغییر وضعیت بر اساس شناسه است و خودتوان است.
      </p>
      {items.length === 0 && !forbidden ? (
        <p aria-live="polite" className="mt-4 text-sm text-smoke">
          پیامی یافت نشد.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((lead) => {
            const next = nextLeadStatus(lead.status);
            const action = leadNextActionLabel(lead.status);
            return (
              <li key={lead.id} className="border border-line bg-ivory px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">{lead.name}</p>
                  <p className="text-xs text-smoke" dir="ltr">
                    {leadStatusLabel(lead.status)} — {lead.status}
                  </p>
                </div>
                <p className="mt-2 text-sm" dir="ltr">
                  {lead.phone}
                </p>
                {lead.email && (
                  <p className="mt-1 text-sm" dir="ltr">
                    {lead.email}
                  </p>
                )}
                {lead.message && <p className="mt-2 text-sm leading-7">{lead.message}</p>}
                {lead.courseId && (
                  <p className="mt-1 text-xs text-smoke" dir="ltr">
                    course: {lead.courseId}
                  </p>
                )}
                {next && action && (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={patchingId === lead.id}
                      onClick={() => void handleStatus(lead)}
                      className="border border-line-strong px-3 py-1.5 text-sm disabled:opacity-60"
                    >
                      {patchingId === lead.id ? "در حال ثبت…" : action}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
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
    </section>
  );
}
