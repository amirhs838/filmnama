"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getInstructor,
  saveInstructor,
  type InstructorFormState,
  type InstructorInput,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import InstructorForm from "@/components/admin/InstructorForm";
import { FormError } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminInstructorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [phase, setPhase] = useState<Phase>("loading");
  const [initial, setInitial] = useState<InstructorFormState | null>(null);
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
        const item = await getInstructor(fetch, id);
        if (cancelled) return;
        setInitial({
          slug: item.slug,
          customPath: item.customPath ?? "",
          name: item.name,
          bio: item.bio,
          image: item.image ?? "",
          status: item.status,
          seoTitle: "",
          seoDescription: "",
          seoCanonicalUrl: "",
          seoNoindex: false,
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
        setError("دریافت استاد ناموفق بود.");
        setPhase("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(payload: InstructorInput) {
    setError(null);
    setForbidden(false);
    setOk(null);
    setPending(true);
    try {
      await saveInstructor(fetch, { ...payload, id });
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
      setError("ذخیره استاد ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="instructor-detail-title" className="max-w-3xl">
        <h1 id="instructor-detail-title" className="text-h3">
          ویرایش استاد
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="instructor-detail-title" className="max-w-xl">
        <h1 id="instructor-detail-title" className="text-h3">
          ویرایش استاد
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ویرایش استاد ابتدا وارد شوید.
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
      <section aria-labelledby="instructor-detail-title" className="max-w-xl">
        <h1 id="instructor-detail-title" className="text-h3">
          ویرایش استاد
        </h1>
        <p aria-live="polite" role="alert" className="mt-4 text-sm text-red">
          {error ?? "موردی یافت نشد."}
        </p>
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            ویرایش استاد فقط برای SUPER_ADMIN و CONTENT_MANAGER است.
          </p>
        )}
        <p className="mt-6">
          <Link href="/admin/instructors" className="text-sm underline">
            بازگشت به اساتید
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="instructor-detail-title" className="max-w-3xl">
      <h1 id="instructor-detail-title" className="text-h3">
        ویرایش استاد
      </h1>
      <p className="mt-4">
        <Link href="/admin/instructors" className="text-sm underline">
          بازگشت به اساتید
        </Link>
      </p>
      <div className="mt-6" key={id}>
        <InstructorForm
          initial={initial}
          pending={pending}
          submitLabel={pending ? "در حال ذخیره…" : "ذخیره"}
          onSubmit={(payload) => void handleSubmit(payload)}
        />
      </div>
      <div className="mt-4">
        <FormError id="instructor-detail-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            ویرایش استاد فقط برای SUPER_ADMIN و CONTENT_MANAGER است.
          </p>
        )}
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}
          </p>
        )}
      </div>
    </section>
  );
}
