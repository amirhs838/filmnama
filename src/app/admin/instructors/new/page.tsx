"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveInstructor, type InstructorInput } from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import InstructorForm from "@/components/admin/InstructorForm";
import { FormError } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminInstructorNewPage() {
  const [phase, setPhase] = useState<Phase>("loading");
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
      if (!cancelled) setPhase("ready");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(payload: InstructorInput) {
    setError(null);
    setForbidden(false);
    setOk(null);
    setPending(true);
    try {
      const created = await saveInstructor(fetch, payload);
      setOk(`استاد ساخته شد: ${created.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("ساخت استاد ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="instructor-new-title" className="max-w-3xl">
        <h1 id="instructor-new-title" className="text-h3">
          استاد تازه
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="instructor-new-title" className="max-w-xl">
        <h1 id="instructor-new-title" className="text-h3">
          استاد تازه
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ساخت استاد ابتدا وارد شوید.
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
    <section aria-labelledby="instructor-new-title" className="max-w-3xl">
      <h1 id="instructor-new-title" className="text-h3">
        استاد تازه
      </h1>
      <p className="mt-4">
        <Link href="/admin/instructors" className="text-sm underline">
          بازگشت به اساتید
        </Link>
      </p>
      <div className="mt-6">
        <InstructorForm
          pending={pending}
          submitLabel={pending ? "در حال ساخت…" : "ساخت استاد"}
          onSubmit={(payload) => void handleSubmit(payload)}
        />
      </div>
      <div className="mt-4">
        <FormError id="instructor-new-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            ساخت استاد فقط برای SUPER_ADMIN و CONTENT_MANAGER است.
          </p>
        )}
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}{" "}
            <Link href="/admin/instructors" className="underline">
              بازگشت به اساتید
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
