"use client";

import { useState } from "react";
import {
  buildInstructorPayload,
  type AdminStatus,
  type InstructorFormState,
  type InstructorInput,
} from "@/lib/admin-api";
import { Field, FormError, Select, SubmitButton, TextInput, Textarea } from "./AdminForm";

export const INSTRUCTOR_STATUSES: AdminStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

type InstructorFormProps = {
  initial?: InstructorFormState;
  pending?: boolean;
  submitLabel: string;
  onSubmit: (payload: InstructorInput) => void | Promise<void>;
};

const EMPTY_FORM: InstructorFormState = {
  slug: "",
  customPath: "",
  name: "",
  bio: "",
  image: "",
  status: "DRAFT",
  seoTitle: "",
  seoDescription: "",
  seoCanonicalUrl: "",
  seoNoindex: false,
};

const ERROR_ID = "instructor-form-error";
const REQUIRED_MESSAGE = "پر کردن اسلاگ و نام استاد ضروری است.";

export function emptyInstructorForm(): InstructorFormState {
  return { ...EMPTY_FORM };
}

export default function InstructorForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
}: InstructorFormProps) {
  const [form, setForm] = useState<InstructorFormState>(initial ?? emptyInstructorForm());
  const [localError, setLocalError] = useState<string | null>(null);
  const isPending = pending === true;
  const describedBy = localError ? ERROR_ID : undefined;

  function set<K extends keyof InstructorFormState>(key: K, value: InstructorFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.slug.trim().length === 0 || form.name.trim().length === 0) {
      setLocalError(REQUIRED_MESSAGE);
      return;
    }
    setLocalError(null);
    await onSubmit(buildInstructorPayload(form));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="instructor-slug" label="اسلاگ">
          <TextInput
            id="instructor-slug"
            name="slug"
            dir="ltr"
            required
            value={form.slug}
            disabled={isPending}
            onChange={(event) => set("slug", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
        </Field>
        <Field htmlFor="instructor-custom-path" label="مسیر دلخواه" hint="مثل teacher-of-filmnama/استاد-جدید — خالی یعنی همان آدرس پیش‌فرض">
          <TextInput
            id="instructor-custom-path"
            name="customPath"
            dir="ltr"
            value={form.customPath ?? ""}
            disabled={isPending}
            onChange={(event) => set("customPath", event.target.value)}
            placeholder="teacher-of-filmnama/..."
          />
        </Field>
        <Field htmlFor="instructor-name" label="نام">
          <TextInput
            id="instructor-name"
            name="name"
            required
            value={form.name}
            disabled={isPending}
            onChange={(event) => set("name", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="instructor-image" label="تصویر" hint="نشانی تصویر، خالی یعنی بدون تصویر">
          <TextInput
            id="instructor-image"
            name="image"
            dir="ltr"
            value={form.image ?? ""}
            disabled={isPending}
            onChange={(event) => set("image", event.target.value)}
          />
        </Field>
        <Field htmlFor="instructor-status" label="وضعیت">
          <Select
            id="instructor-status"
            name="status"
            value={form.status}
            disabled={isPending}
            onChange={(event) => set("status", event.target.value as AdminStatus)}
          >
            {INSTRUCTOR_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field htmlFor="instructor-bio" label="زندگی‌نامه">
        <Textarea
          id="instructor-bio"
          name="bio"
          value={form.bio}
          disabled={isPending}
          onChange={(event) => set("bio", event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="instructor-seo-title" label="عنوان سئو">
          <TextInput
            id="instructor-seo-title"
            value={form.seoTitle ?? ""}
            disabled={isPending}
            onChange={(event) => set("seoTitle", event.target.value)}
          />
        </Field>
        <Field htmlFor="instructor-seo-canonical" label=" canonical سئو">
          <TextInput
            id="instructor-seo-canonical"
            dir="ltr"
            value={form.seoCanonicalUrl ?? ""}
            disabled={isPending}
            onChange={(event) => set("seoCanonicalUrl", event.target.value)}
          />
        </Field>
      </div>
      <Field htmlFor="instructor-seo-description" label="توضیح سئو">
        <Textarea
          id="instructor-seo-description"
          rows={2}
          value={form.seoDescription ?? ""}
          disabled={isPending}
          onChange={(event) => set("seoDescription", event.target.value)}
        />
      </Field>
      <div className="flex items-center gap-2">
        <input
          id="instructor-seo-noindex"
          type="checkbox"
          checked={form.seoNoindex === true}
          disabled={isPending}
          onChange={(event) => set("seoNoindex", event.target.checked)}
          className="size-4"
        />
        <label htmlFor="instructor-seo-noindex" className="text-sm">
          عدم نمایه‌سازی (noindex)
        </label>
      </div>
      <FormError id={ERROR_ID} message={localError} />
      <div>
        <SubmitButton pending={isPending}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
