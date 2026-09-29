"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listAudits,
  listRedirects,
  listRevalidation,
  type Audit,
  type Redirect,
  type RevalidationItem,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { Field, Select, TextInput } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminReportsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [actorId, setActorId] = useState("");
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditForbidden, setAuditForbidden] = useState(false);
  const [auditApplying, setAuditApplying] = useState(false);
  const [auditMore, setAuditMore] = useState(false);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [redirectCursor, setRedirectCursor] = useState<string | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [redirectForbidden, setRedirectForbidden] = useState(false);
  const [redirectMore, setRedirectMore] = useState(false);
  const [outbox, setOutbox] = useState<RevalidationItem[]>([]);
  const [outboxCursor, setOutboxCursor] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState("true");
  const [outboxError, setOutboxError] = useState<string | null>(null);
  const [outboxForbidden, setOutboxForbidden] = useState(false);
  const [outboxApplying, setOutboxApplying] = useState(false);
  const [outboxMore, setOutboxMore] = useState(false);

  const fetchAudits = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!getAdminTokens()) {
        setPhase("unauthenticated");
        return;
      }
      const page = await listAudits(fetch, {
        entityType: entityType.trim().length > 0 ? entityType.trim() : undefined,
        entityId: entityId.trim().length > 0 ? entityId.trim() : undefined,
        actorId: actorId.trim().length > 0 ? actorId.trim() : undefined,
        limit: 20,
        cursor: cursor ?? undefined,
      });
      setAudits((prev) => (append ? [...prev, ...page.items] : page.items));
      setAuditCursor(page.nextCursor);
      setPhase("ready");
    },
    [actorId, entityId, entityType],
  );

  const fetchRedirects = useCallback(async (cursor: string | null, append: boolean) => {
    if (!getAdminTokens()) {
      setPhase("unauthenticated");
      return;
    }
    const page = await listRedirects(fetch, { limit: 20, cursor: cursor ?? undefined });
    setRedirects((prev) => (append ? [...prev, ...page.items] : page.items));
    setRedirectCursor(page.nextCursor);
    setPhase("ready");
  }, []);

  const fetchOutbox = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!getAdminTokens()) {
        setPhase("unauthenticated");
        return;
      }
      const page = await listRevalidation(fetch, {
        pending:
          pendingFilter === "true" ? true : pendingFilter === "false" ? false : undefined,
        limit: 20,
        cursor: cursor ?? undefined,
      });
      setOutbox((prev) => (append ? [...prev, ...page.items] : page.items));
      setOutboxCursor(page.nextCursor);
      setPhase("ready");
    },
    [pendingFilter],
  );

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      try {
        await Promise.all([
          fetchAudits(null, false),
          fetchRedirects(null, false),
          fetchOutbox(null, false),
        ]);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === "unauthorized") {
          setPhase("unauthenticated");
          return;
        }
        if (err instanceof Error && err.message === "forbidden") {
          setAuditForbidden(true);
          setRedirectForbidden(true);
          setOutboxForbidden(true);
          setPhase("ready");
          return;
        }
        setAuditError("دریافت گزارش‌ها ناموفق بود.");
        setPhase("ready");
      }
    }
    void initial();
    return () => {
      cancelled = true;
    };
  }, [fetchAudits, fetchOutbox, fetchRedirects]);

  async function handleAuditApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuditError(null);
    setAuditForbidden(false);
    setAuditApplying(true);
    try {
      await fetchAudits(null, false);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setAuditForbidden(true);
        return;
      }
      setAuditError("دریافت حسابرسی‌ها ناموفق بود.");
    } finally {
      setAuditApplying(false);
    }
  }

  async function handleAuditMore() {
    if (!auditCursor) return;
    setAuditError(null);
    setAuditMore(true);
    try {
      await fetchAudits(auditCursor, true);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setAuditForbidden(true);
        return;
      }
      setAuditError("دریافت صفحه بعد ناموفق بود.");
    } finally {
      setAuditMore(false);
    }
  }

  async function handleRedirectMore() {
    if (!redirectCursor) return;
    setRedirectError(null);
    setRedirectMore(true);
    try {
      await fetchRedirects(redirectCursor, true);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setRedirectForbidden(true);
        return;
      }
      setRedirectError("دریافت صفحه بعد ناموفق بود.");
    } finally {
      setRedirectMore(false);
    }
  }

  async function handleOutboxApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOutboxError(null);
    setOutboxForbidden(false);
    setOutboxApplying(true);
    try {
      await fetchOutbox(null, false);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setOutboxForbidden(true);
        return;
      }
      setOutboxError("دریافت صف بازاعتبارسنجی ناموفق بود.");
    } finally {
      setOutboxApplying(false);
    }
  }

  async function handleOutboxMore() {
    if (!outboxCursor) return;
    setOutboxError(null);
    setOutboxMore(true);
    try {
      await fetchOutbox(outboxCursor, true);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setOutboxForbidden(true);
        return;
      }
      setOutboxError("دریافت صفحه بعد ناموفق بود.");
    } finally {
      setOutboxMore(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="reports-title" className="max-w-4xl">
        <h1 id="reports-title" className="text-h3">
          گزارش‌ها
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="reports-title" className="max-w-xl">
        <h1 id="reports-title" className="text-h3">
          گزارش‌ها
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مشاهده گزارش‌ها ابتدا وارد شوید.
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
    <section aria-labelledby="reports-title" className="max-w-5xl">
      <h1 id="reports-title" className="text-h3">
        گزارش‌ها
      </h1>

      <h2 className="mt-8 text-h3">حسابرسی‌ها</h2>
      <form onSubmit={(event) => void handleAuditApply(event)} className="mt-4 grid gap-4 sm:grid-cols-3" noValidate>
        <Field htmlFor="audit-entity-type" label="نوع موجودیت">
          <TextInput
            id="audit-entity-type"
            dir="ltr"
            value={entityType}
            disabled={auditApplying}
            onChange={(event) => setEntityType(event.target.value)}
          />
        </Field>
        <Field htmlFor="audit-entity-id" label="شناسه موجودیت">
          <TextInput
            id="audit-entity-id"
            dir="ltr"
            value={entityId}
            disabled={auditApplying}
            onChange={(event) => setEntityId(event.target.value)}
          />
        </Field>
        <Field htmlFor="audit-actor" label="شناسه کنشگر">
          <TextInput
            id="audit-actor"
            dir="ltr"
            value={actorId}
            disabled={auditApplying}
            onChange={(event) => setActorId(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={auditApplying}
            className="h-11 bg-ink px-4 text-sm font-medium text-ivory transition-colors hover:bg-ink-3 disabled:opacity-60"
          >
            {auditApplying ? "در حال اعمال…" : "اعمال پالایه"}
          </button>
        </div>
      </form>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {auditError ?? ""}
      </p>
      {auditForbidden && (
        <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
          مشاهده حسابرسی‌ها فقط برای SUPER_ADMIN است.
        </p>
      )}
      {audits.length === 0 && !auditForbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          حسابرسی‌ای یافت نشد.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border border-line text-sm">
            <thead>
              <tr className="bg-ink text-ivory">
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  کنش
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  موجودیت
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  شناسه
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  کنشگر
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  زمان
                </th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} className="border-t border-line">
                  <td className="px-3 py-2.5" dir="ltr">
                    {audit.action}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {audit.entityType}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {audit.entityId}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {audit.actorId ?? "—"}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {audit.createdAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {auditCursor && (
        <div className="mt-4">
          <button
            type="button"
            disabled={auditMore}
            onClick={() => void handleAuditMore()}
            className="h-11 border border-line-strong px-4 text-sm disabled:opacity-60"
          >
            {auditMore ? "در حال بارگذاری…" : "صفحه بعد حسابرسی‌ها"}
          </button>
        </div>
      )}

      <h2 className="mt-10 text-h3">تغییرمسیرها</h2>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {redirectError ?? ""}
      </p>
      {redirectForbidden && (
        <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
          دسترسی به تغییرمسیرها ندارید.
        </p>
      )}
      {redirects.length === 0 && !redirectForbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          تغییرمسیری یافت نشد.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border border-line text-sm">
            <thead>
              <tr className="bg-ink text-ivory">
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  مبدأ
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  مقصد
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  زبان
                </th>
              </tr>
            </thead>
            <tbody>
              {redirects.map((redirect) => (
                <tr key={redirect.id} className="border-t border-line">
                  <td className="px-3 py-2.5" dir="ltr">
                    {redirect.source}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {redirect.destination ?? "—"}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {redirect.locale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {redirectCursor && (
        <div className="mt-4">
          <button
            type="button"
            disabled={redirectMore}
            onClick={() => void handleRedirectMore()}
            className="h-11 border border-line-strong px-4 text-sm disabled:opacity-60"
          >
            {redirectMore ? "در حال بارگذاری…" : "صفحه بعد تغییرمسیرها"}
          </button>
        </div>
      )}

      <h2 className="mt-10 text-h3">صف بازاعتبارسنجی</h2>
      <form onSubmit={(event) => void handleOutboxApply(event)} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
        <Field htmlFor="outbox-pending" label="وضعیت">
          <Select
            id="outbox-pending"
            value={pendingFilter}
            disabled={outboxApplying}
            onChange={(event) => setPendingFilter(event.target.value)}
          >
            <option value="">همه</option>
            <option value="true">در انتظار</option>
            <option value="false">تحویل‌شده</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={outboxApplying}
            className="h-11 bg-ink px-4 text-sm font-medium text-ivory transition-colors hover:bg-ink-3 disabled:opacity-60"
          >
            {outboxApplying ? "در حال اعمال…" : "اعمال پالایه"}
          </button>
        </div>
      </form>
      <p aria-live="polite" role="alert" className="mt-4 min-h-6 text-sm text-red">
        {outboxError ?? ""}
      </p>
      {outboxForbidden && (
        <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
          دسترسی به صف بازاعتبارسنجی ندارید.
        </p>
      )}
      {outbox.length === 0 && !outboxForbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          موردی در صف یافت نشد.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border border-line text-sm">
            <thead>
              <tr className="bg-ink text-ivory">
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  نسخه
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  مسیرها
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  تحویل
                </th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-3 py-2.5" dir="ltr">
                    {item.version}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {item.paths.join(", ")}
                  </td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {item.deliveredAt ?? "pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {outboxCursor && (
        <div className="mt-4">
          <button
            type="button"
            disabled={outboxMore}
            onClick={() => void handleOutboxMore()}
            className="h-11 border border-line-strong px-4 text-sm disabled:opacity-60"
          >
            {outboxMore ? "در حال بارگذاری…" : "صفحه بعد صف"}
          </button>
        </div>
      )}
    </section>
  );
}
