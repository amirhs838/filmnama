"use client";

import { useState } from "react";
import {
  buildCoursePayload,
  type AdminStatus,
  type CourseFormState,
  type CourseIconKey,
  type CourseInput,
} from "@/lib/admin-api";
import { mediaSrc } from "@/lib/content-contract";
import { Field, FormError, Select, SubmitButton, TextInput, Textarea } from "./AdminForm";
import RichTextEditor, { isRichTextEmpty } from "./RichTextEditor";

export const COURSE_ICON_KEYS: CourseIconKey[] = [
  "Drama",
  "Camera",
  "Clapperboard",
  "Palette",
  "Scissors",
  "Aperture",
  "Sparkles",
  "Music",
  "Code2",
  "BrainCircuit",
  "Server",
  "Languages",
];

export const COURSE_STATUSES: AdminStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export type DepartmentOption = {
  id: string;
  label: string;
};

export type CoverOption = {
  id: string;
  alt: string;
  mimeType: string;
};

type CourseFormProps = {
  initial?: CourseFormState;
  departmentOptions: DepartmentOption[];
  coverOptions?: CoverOption[];
  pending?: boolean;
  submitLabel: string;
  onSubmit: (payload: CourseInput) => void | Promise<void>;
};

const EMPTY_FORM: CourseFormState = {
  slug: "",
  customPath: "",
  departmentId: "",
  title: "",
  latin: "",
  description: "",
  level: "",
  duration: "",
  iconKey: "Drama",
  contentHtml: "",
  syllabusText: "",
  faq: [{ question: "", answer: "" }],
  instructorIdsText: "",
  coverMediaId: "",
  seoTitle: "",
  seoDescription: "",
  seoCanonicalUrl: "",
  seoNoindex: false,
  status: "DRAFT",
};

const ERROR_ID = "course-form-error";
const REQUIRED_MESSAGE =
  "پر کردن فیلدهای الزامی (اسلاگ، دپارتمان، عنوان، لاتین، توضیح، سطح، مدت، محتوا) ضروری است.";

export function emptyCourseForm(): CourseFormState {
  return { ...EMPTY_FORM, faq: [{ question: "", answer: "" }] };
}

export default function CourseForm({
  initial,
  departmentOptions,
  coverOptions,
  pending,
  submitLabel,
  onSubmit,
}: CourseFormProps) {
  const [form, setForm] = useState<CourseFormState>(initial ?? emptyCourseForm());
  const [localError, setLocalError] = useState<string | null>(null);
  const isPending = pending === true;
  const describedBy = localError ? ERROR_ID : undefined;

  function set<K extends keyof CourseFormState>(key: K, value: CourseFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setFaq(index: number, patch: { question?: string; answer?: string }) {
    setForm((prev) => ({
      ...prev,
      faq: prev.faq.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function addFaqRow() {
    setForm((prev) => ({ ...prev, faq: [...prev.faq, { question: "", answer: "" }] }));
  }

  function removeFaqRow(index: number) {
    setForm((prev) => ({
      ...prev,
      faq: prev.faq.length <= 1 ? [{ question: "", answer: "" }] : prev.faq.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const required = [
      form.slug,
      form.departmentId,
      form.title,
      form.latin,
      form.description,
      form.level,
      form.duration,
    ];
    if (
      required.some((value) => value.trim().length === 0) ||
      isRichTextEmpty(form.contentHtml)
    ) {
      setLocalError(REQUIRED_MESSAGE);
      return;
    }
    setLocalError(null);
    await onSubmit(buildCoursePayload(form));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="course-slug" label="اسلاگ">
          <TextInput
            id="course-slug"
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
        <Field htmlFor="course-custom-path" label="مسیر دلخواه" hint="مثل training-courses/فن-بیان — خالی یعنی همان آدرس پیش‌فرض">
          <TextInput
            id="course-custom-path"
            name="customPath"
            dir="ltr"
            value={form.customPath ?? ""}
            disabled={isPending}
            onChange={(event) => set("customPath", event.target.value)}
            placeholder="training-courses/..."
          />
        </Field>
        <Field htmlFor="course-department" label="دپارتمان">
          <Select
            id="course-department"
            name="departmentId"
            required
            value={form.departmentId}
            disabled={isPending}
            onChange={(event) => set("departmentId", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          >
            <option value="">انتخاب کنید</option>
            {departmentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="course-title" label="عنوان">
          <TextInput
            id="course-title"
            name="title"
            required
            value={form.title}
            disabled={isPending}
            onChange={(event) => set("title", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
        </Field>
        <Field htmlFor="course-latin" label="عنوان لاتین">
          <TextInput
            id="course-latin"
            name="latin"
            dir="ltr"
            required
            value={form.latin}
            disabled={isPending}
            onChange={(event) => set("latin", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
        </Field>
      </div>
      <Field htmlFor="course-description" label="توضیح">
        <Textarea
          id="course-description"
          name="description"
          required
          value={form.description}
          disabled={isPending}
          onChange={(event) => set("description", event.target.value)}
          aria-invalid={localError ? true : undefined}
          aria-describedby={describedBy}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field htmlFor="course-level" label="سطح">
          <TextInput
            id="course-level"
            name="level"
            required
            value={form.level}
            disabled={isPending}
            onChange={(event) => set("level", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
        </Field>
        <Field htmlFor="course-duration" label="مدت">
          <TextInput
            id="course-duration"
            name="duration"
            required
            value={form.duration}
            disabled={isPending}
            onChange={(event) => set("duration", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
        </Field>
        <Field htmlFor="course-icon" label="آیکون">
          <Select
            id="course-icon"
            name="iconKey"
            value={form.iconKey}
            disabled={isPending}
            onChange={(event) => set("iconKey", event.target.value as CourseIconKey)}
          >
            {COURSE_ICON_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field htmlFor="course-status" label="وضعیت">
        <Select
          id="course-status"
          name="status"
          value={form.status}
          disabled={isPending}
          onChange={(event) => set("status", event.target.value as AdminStatus)}
        >
          {COURSE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </Field>
      <Field htmlFor="course-content" label="محتوای دوره">
        <RichTextEditor
          id="course-content"
          name="contentHtml"
          value={form.contentHtml}
          disabled={isPending}
          onChange={(next) => set("contentHtml", next)}
        />
      </Field>
      <Field htmlFor="course-syllabus" label="سرفصل‌ها" hint="هر خط یک سرفصل">
        <Textarea
          id="course-syllabus"
          name="syllabusText"
          value={form.syllabusText}
          disabled={isPending}
          onChange={(event) => set("syllabusText", event.target.value)}
        />
      </Field>
      <fieldset className="flex flex-col gap-3 border border-line p-4">
        <legend className="px-2 text-sm font-medium">پرسش‌های متداول</legend>
        {form.faq.map((row, index) => (
          <div key={index} className="flex flex-col gap-3 border border-line p-3">
            <Field htmlFor={`course-faq-q-${index}`} label={`پرسش ${index + 1}`}>
              <TextInput
                id={`course-faq-q-${index}`}
                value={row.question}
                disabled={isPending}
                onChange={(event) => setFaq(index, { question: event.target.value })}
              />
            </Field>
            <Field htmlFor={`course-faq-a-${index}`} label="پاسخ">
              <Textarea
                id={`course-faq-a-${index}`}
                rows={2}
                value={row.answer}
                disabled={isPending}
                onChange={(event) => setFaq(index, { answer: event.target.value })}
              />
            </Field>
            <div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => removeFaqRow(index)}
                className="border border-line-strong px-3 py-2 text-sm disabled:opacity-60"
              >
                حذف این ردیف
              </button>
            </div>
          </div>
        ))}
        <div>
          <button
            type="button"
            disabled={isPending}
            onClick={addFaqRow}
            className="border border-line-strong px-3 py-2 text-sm disabled:opacity-60"
          >
            افزودن پرسش
          </button>
        </div>
      </fieldset>
      <Field htmlFor="course-instructors" label="شناسه مدرسان" hint="شناسه‌ها با کاما جدا شوند">
        <TextInput
          id="course-instructors"
          name="instructorIdsText"
          dir="ltr"
          value={form.instructorIdsText}
          disabled={isPending}
          onChange={(event) => set("instructorIdsText", event.target.value)}
        />
      </Field>
      <Field htmlFor="course-cover" label="کاور">
        <Select
          id="course-cover"
          name="coverMediaId"
          value={form.coverMediaId ?? ""}
          disabled={isPending}
          onChange={(event) => set("coverMediaId", event.target.value)}
        >
          <option value="">بدون کاور</option>
          {(coverOptions ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {(option.alt || option.id).slice(0, 80)} · {option.mimeType}
            </option>
          ))}
        </Select>
      </Field>
      {(form.coverMediaId ?? "").trim().length > 0 && (
        <img
          src={mediaSrc((form.coverMediaId ?? "").trim())}
          alt="پیش‌نمایش کاور"
          className="max-h-48 w-auto border border-line"
          loading="lazy"
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="course-seo-title" label="عنوان سئو">
          <TextInput
            id="course-seo-title"
            value={form.seoTitle ?? ""}
            disabled={isPending}
            onChange={(event) => set("seoTitle", event.target.value)}
          />
        </Field>
        <Field htmlFor="course-seo-canonical" label=" canonical سئو">
          <TextInput
            id="course-seo-canonical"
            dir="ltr"
            value={form.seoCanonicalUrl ?? ""}
            disabled={isPending}
            onChange={(event) => set("seoCanonicalUrl", event.target.value)}
          />
        </Field>
      </div>
      <Field htmlFor="course-seo-description" label="توضیح سئو">
        <Textarea
          id="course-seo-description"
          rows={2}
          value={form.seoDescription ?? ""}
          disabled={isPending}
          onChange={(event) => set("seoDescription", event.target.value)}
        />
      </Field>
      <div className="flex items-center gap-2">
        <input
          id="course-seo-noindex"
          type="checkbox"
          checked={form.seoNoindex === true}
          disabled={isPending}
          onChange={(event) => set("seoNoindex", event.target.checked)}
          className="size-4"
        />
        <label htmlFor="course-seo-noindex" className="text-sm">
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
