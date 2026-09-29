"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildSettingsPayload,
  getSettings,
  saveSettings,
  type SettingsFormState,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import {
  Field,
  FormError,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

const EMPTY: SettingsFormState = {
  name: "",
  description: "",
  contactPhone: "",
  contactMobile: "",
  contactAddress: "",
  contactInstagram: "",
  seoTitle: "",
  seoDescription: "",
  seoCanonicalUrl: "",
  seoNoindex: false,
};

export default function AdminSettingsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [form, setForm] = useState<SettingsFormState>(EMPTY);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAdminTokens()) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }
      try {
        const settings = await getSettings(fetch);
        if (cancelled) return;
        setForm({
          name: settings.name,
          description: settings.description,
          contactPhone: settings.contact.phone ?? "",
          contactMobile: settings.contact.mobile ?? "",
          contactAddress: settings.contact.address ?? "",
          contactInstagram: settings.contact.instagram ?? "",
          seoTitle: settings.seo.title ?? "",
          seoDescription: settings.seo.description ?? "",
          seoCanonicalUrl: settings.seo.canonicalUrl ?? "",
          seoNoindex: settings.seo.noindex,
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
        if (err instanceof Error && err.message === "not_found") {
          setMissing(true);
          setPhase("ready");
          return;
        }
        setError("دریافت تنظیمات ناموفق بود.");
        setPhase("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setForbidden(false);
    setOk(null);
    if (form.name.trim().length === 0 || form.description.trim().length === 0) {
      setError("پر کردن نام و توضیح ضروری است.");
      return;
    }
    setSaving(true);
    try {
      await saveSettings(fetch, buildSettingsPayload(form));
      setMissing(false);
      setOk("تنظیمات ذخیره شد.");
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setPhase("unauthenticated");
        return;
      }
      if (err instanceof Error && err.message === "forbidden") {
        setForbidden(true);
        return;
      }
      setError("ذخیره تنظیمات ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="settings-title" className="max-w-3xl">
        <h1 id="settings-title" className="text-h3">
          تنظیمات
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="settings-title" className="max-w-xl">
        <h1 id="settings-title" className="text-h3">
          تنظیمات
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای مدیریت تنظیمات ابتدا وارد شوید.
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
    <section aria-labelledby="settings-title" className="max-w-3xl">
      <h1 id="settings-title" className="text-h3">
        تنظیمات
      </h1>
      {missing && (
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          هنوز تنظیماتی ثبت نشده است؛ فرم زیر را کامل و ذخیره کنید.
        </p>
      )}
      <form onSubmit={(event) => void handleSave(event)} className="mt-6 flex flex-col gap-4" noValidate>
        <Field htmlFor="settings-name" label="نام">
          <TextInput
            id="settings-name"
            required
            value={form.name}
            disabled={saving}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field htmlFor="settings-description" label="توضیح">
          <Textarea
            id="settings-description"
            required
            value={form.description}
            disabled={saving}
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="settings-phone" label="تلفن تماس">
            <TextInput
              id="settings-phone"
              dir="ltr"
              value={form.contactPhone ?? ""}
              disabled={saving}
              onChange={(event) => set("contactPhone", event.target.value)}
            />
          </Field>
          <Field htmlFor="settings-mobile" label="موبایل">
            <TextInput
              id="settings-mobile"
              dir="ltr"
              value={form.contactMobile ?? ""}
              disabled={saving}
              onChange={(event) => set("contactMobile", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="settings-address" label="نشانی">
          <Textarea
            id="settings-address"
            rows={2}
            value={form.contactAddress ?? ""}
            disabled={saving}
            onChange={(event) => set("contactAddress", event.target.value)}
          />
        </Field>
        <Field htmlFor="settings-instagram" label="اینستاگرام">
          <TextInput
            id="settings-instagram"
            dir="ltr"
            value={form.contactInstagram ?? ""}
            disabled={saving}
            onChange={(event) => set("contactInstagram", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="settings-seo-title" label="عنوان سئو">
            <TextInput
              id="settings-seo-title"
              value={form.seoTitle ?? ""}
              disabled={saving}
              onChange={(event) => set("seoTitle", event.target.value)}
            />
          </Field>
          <Field htmlFor="settings-seo-canonical" label=" canonical سئو">
            <TextInput
              id="settings-seo-canonical"
              dir="ltr"
              value={form.seoCanonicalUrl ?? ""}
              disabled={saving}
              onChange={(event) => set("seoCanonicalUrl", event.target.value)}
            />
          </Field>
        </div>
        <Field htmlFor="settings-seo-description" label="توضیح سئو">
          <Textarea
            id="settings-seo-description"
            rows={2}
            value={form.seoDescription ?? ""}
            disabled={saving}
            onChange={(event) => set("seoDescription", event.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="settings-seo-noindex"
            type="checkbox"
            checked={form.seoNoindex === true}
            disabled={saving}
            onChange={(event) => set("seoNoindex", event.target.checked)}
            className="size-4"
          />
          <label htmlFor="settings-seo-noindex" className="text-sm">
            عدم نمایه‌سازی (noindex)
          </label>
        </div>
        <FormError id="settings-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به تنظیمات ندارید.
          </p>
        )}
        {ok && (
          <p aria-live="polite" className="text-sm">
            {ok}
          </p>
        )}
        <div>
          <SubmitButton pending={saving}>{saving ? "در حال ذخیره…" : "ذخیره تنظیمات"}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
