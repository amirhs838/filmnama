"use client";

import { useState } from "react";
import Link from "next/link";
import { getAdminTokens, loginFlow } from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setPending(true);
    try {
      await loginFlow(fetch, email.trim(), password);
      setDone(getAdminTokens() !== null);
    } catch {
      setError("ورود ناموفق بود. مشخصات را بررسی و دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="admin-login-title" className="max-w-md">
      <h1 id="admin-login-title" className="text-h3">
        ورود مدیریت
      </h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-email" className="text-sm font-medium">
            ایمیل
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "admin-login-error" : undefined}
            className="h-11 border border-line-strong bg-ivory px-3 text-sm text-ink"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-password" className="text-sm font-medium">
            گذرواژه
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "admin-login-error" : undefined}
            className="h-11 border border-line-strong bg-ivory px-3 text-sm text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="h-11 bg-red text-sm font-medium text-ivory transition-colors hover:bg-red-deep disabled:opacity-60"
        >
          {pending ? "در حال ورود…" : "ورود"}
        </button>
      </form>
      <p id="admin-login-error" role="alert" aria-live="polite" className="mt-4 min-h-6 text-sm text-red">
        {error ?? ""}
      </p>
      {done && !error && (
        <p aria-live="polite" className="mt-2 text-sm">
          ورود موفق بود.{" "}
          <Link href="/admin" className="underline">
            رفتن به داشبورد
          </Link>
        </p>
      )}
    </section>
  );
}
