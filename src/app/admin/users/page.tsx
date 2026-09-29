"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listUsers,
  setUserAccess,
  type AdminUser,
  type AdminUserRole,
  type UserAccessInput,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import { Field, Select } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

const ROLES: AdminUserRole[] = ["SUPER_ADMIN", "CONTENT_MANAGER", "BLOG_EDITOR"];

export default function AdminUsersPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<AdminUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, UserAccessInput>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!getAdminTokens()) {
        setPhase("unauthenticated");
        return;
      }
      const page = await listUsers(fetch, {
        role: roleFilter.length > 0 ? (roleFilter as AdminUserRole) : undefined,
        active:
          activeFilter === "true" ? true : activeFilter === "false" ? false : undefined,
        limit: 20,
        cursor: cursor ?? undefined,
      });
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const user of page.items) {
          if (!next[user.id]) next[user.id] = { role: user.role as AdminUserRole, active: user.active };
        }
        return next;
      });
      setPhase("ready");
    },
    [activeFilter, roleFilter],
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
        setError("دریافت کاربران ناموفق بود.");
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
      setError("دریافت کاربران ناموفق بود.");
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

  async function handleSave(user: AdminUser) {
    const draft = drafts[user.id];
    if (!draft) return;
    setError(null);
    setSavingId(user.id);
    try {
      const updated = await setUserAccess(fetch, user.id, draft);
      setItems((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, role: updated.role, active: updated.active }
            : item,
        ),
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
      setError("ذخیره دسترسی کاربر ناموفق بود.");
    } finally {
      setSavingId(null);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="users-title" className="max-w-4xl">
        <h1 id="users-title" className="text-h3">
          کاربران
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="users-title" className="max-w-xl">
        <h1 id="users-title" className="text-h3">
          کاربران
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت کاربران ابتدا وارد شوید.
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
    <section aria-labelledby="users-title" className="max-w-4xl">
      <h1 id="users-title" className="text-h3">
        کاربران
      </h1>
      <form onSubmit={(event) => void handleApply(event)} className="mt-6 grid gap-4 sm:grid-cols-3" noValidate>
        <Field htmlFor="users-role" label="نقش">
          <Select
            id="users-role"
            value={roleFilter}
            disabled={applying}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="">همه</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="users-active" label="وضعیت">
          <Select
            id="users-active"
            value={activeFilter}
            disabled={applying}
            onChange={(event) => setActiveFilter(event.target.value)}
          >
            <option value="">همه</option>
            <option value="true">فعال</option>
            <option value="false">غیرفعال</option>
          </Select>
        </Field>
        <div className="flex items-end">
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
          مشاهده و تغییر کاربران فقط برای SUPER_ADMIN است.
        </p>
      )}
      {items.length === 0 && !forbidden ? (
        <p aria-live="polite" className="mt-2 text-sm text-smoke">
          کاربری یافت نشد.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((user) => {
            const draft = drafts[user.id] ?? { role: user.role as AdminUserRole, active: user.active };
            return (
              <li key={user.id} className="border border-line bg-ivory px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold" dir="ltr">
                    {user.email}
                  </p>
                  <p className="text-xs text-smoke" dir="ltr">
                    {user.id}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field htmlFor={`user-role-${user.id}`} label="نقش">
                    <Select
                      id={`user-role-${user.id}`}
                      dir="ltr"
                      value={draft.role}
                      disabled={savingId === user.id}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [user.id]: { ...draft, role: event.target.value as AdminUserRole },
                        }))
                      }
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex items-end gap-2 pb-3">
                    <input
                      id={`user-active-${user.id}`}
                      type="checkbox"
                      checked={draft.active}
                      disabled={savingId === user.id}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [user.id]: { ...draft, active: event.target.checked },
                        }))
                      }
                      className="size-4"
                    />
                    <label htmlFor={`user-active-${user.id}`} className="text-sm">
                      فعال
                    </label>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={savingId === user.id}
                      onClick={() => void handleSave(user)}
                      className="border border-line-strong px-3 py-2 text-sm disabled:opacity-60"
                    >
                      {savingId === user.id ? "در حال ذخیره…" : "ذخیره دسترسی"}
                    </button>
                  </div>
                </div>
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
