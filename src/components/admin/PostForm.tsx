"use client";

import { useState } from "react";
import {
  buildPostPayload,
  parseIds,
  type AdminStatus,
  type PostFormState,
  type PostInput,
} from "@/lib/admin-api";
import { mediaSrc } from "@/lib/content-contract";
import { Field, FormError, Select, SubmitButton, TextInput, Textarea } from "./AdminForm";

export const POST_STATUSES: AdminStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export type CategoryOption = {
  id: string;
  title: string;
};

export type TagOption = {
  id: string;
  title: string;
};

export type CoverOption = {
  id: string;
  alt: string;
  mimeType: string;
};

type PostFormProps = {
  initial?: PostFormState;
  categoryOptions: CategoryOption[];
  tagOptions: TagOption[];
  coverOptions?: CoverOption[];
  pending?: boolean;
  submitLabel: string;
  onSubmit: (payload: PostInput) => void | Promise<void>;
};

const EMPTY_FORM: PostFormState = {
  slug: "",
  customPath: "",
  title: "",
  excerpt: "",
  contentHtml: "",
  categoryId: "",
  tagIdsText: "",
  coverMediaId: "",
  seoTitle: "",
  seoDescription: "",
  seoCanonicalUrl: "",
  seoNoindex: false,
  status: "DRAFT",
};

const ERROR_ID = "post-form-error";
const REQUIRED_MESSAGE = "پر کردن اسلاگ و عنوان نوشته ضروری است.";

export function emptyPostForm(): PostFormState {
  return { ...EMPTY_FORM };
}

export default function PostForm({
  initial,
  categoryOptions,
  tagOptions,
  coverOptions,
  pending,
  submitLabel,
  onSubmit,
}: PostFormProps) {
  const [form, setForm] = useState<PostFormState>(initial ?? emptyPostForm());
  const [localError, setLocalError] = useState<string | null>(null);
  const isPending = pending === true;
  const describedBy = localError ? ERROR_ID : undefined;
  const selectedTagIds = parseIds(form.tagIdsText);

  function set<K extends keyof PostFormState>(key: K, value: PostFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(id: string) {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((tagId) => tagId !== id)
      : [...selectedTagIds, id];
    set("tagIdsText", next.join(", "));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.slug.trim().length === 0 || form.title.trim().length === 0) {
      setLocalError(REQUIRED_MESSAGE);
      return;
    }
    setLocalError(null);
    await onSubmit(buildPostPayload(form));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="post-slug" label="اسلاگ">
          <TextInput
            id="post-slug"
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
        <Field htmlFor="post-custom-path" label="مسیر دلخواه" hint="مثل 2022/09/26/عنوان-نوشته — خالی یعنی همان آدرس پیش‌فرض">
          <TextInput
            id="post-custom-path"
            name="customPath"
            dir="ltr"
            value={form.customPath ?? ""}
            disabled={isPending}
            onChange={(event) => set("customPath", event.target.value)}
            placeholder="2022/09/26/..."
          />
        </Field>
        <Field htmlFor="post-title" label="عنوان">
          <TextInput
            id="post-title"
            name="title"
            required
            value={form.title}
            disabled={isPending}
            onChange={(event) => set("title", event.target.value)}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
        </Field>
      </div>
      <Field htmlFor="post-excerpt" label="خلاصه">
        <Textarea
          id="post-excerpt"
          name="excerpt"
          rows={2}
          value={form.excerpt}
          disabled={isPending}
          onChange={(event) => set("excerpt", event.target.value)}
        />
      </Field>
      <Field htmlFor="post-content" label="محتوای HTML">
        <Textarea
          id="post-content"
          name="contentHtml"
          rows={8}
          dir="ltr"
          value={form.contentHtml}
          disabled={isPending}
          onChange={(event) => set("contentHtml", event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="post-category" label="دسته">
          <Select
            id="post-category"
            name="categoryId"
            value={form.categoryId ?? ""}
            disabled={isPending}
            onChange={(event) => set("categoryId", event.target.value)}
          >
            <option value="">بدون دسته</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field htmlFor="post-status" label="وضعیت">
          <Select
            id="post-status"
            name="status"
            value={form.status}
            disabled={isPending}
            onChange={(event) => set("status", event.target.value as AdminStatus)}
          >
            {POST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2 border border-line p-4">
        <legend className="px-2 text-sm font-medium">برچسب‌ها</legend>
        {tagOptions.length === 0 ? (
          <p className="text-xs leading-6 text-smoke">هنوز برچسبی ثبت نشده است.</p>
        ) : (
          tagOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                id={`post-tag-${option.id}`}
                type="checkbox"
                checked={selectedTagIds.includes(option.id)}
                disabled={isPending}
                onChange={() => toggleTag(option.id)}
                className="size-4"
              />
              <label htmlFor={`post-tag-${option.id}`} className="text-sm">
                {option.title}{" "}
                <span dir="ltr" className="text-xs text-smoke">
                  {option.id}
                </span>
              </label>
            </div>
          ))
        )}
      </fieldset>
      <Field htmlFor="post-cover" label="کاور">
        <Select
          id="post-cover"
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
        <Field htmlFor="post-seo-title" label="عنوان سئو">
          <TextInput
            id="post-seo-title"
            value={form.seoTitle ?? ""}
            disabled={isPending}
            onChange={(event) => set("seoTitle", event.target.value)}
          />
        </Field>
        <Field htmlFor="post-seo-canonical" label=" canonical سئو">
          <TextInput
            id="post-seo-canonical"
            dir="ltr"
            value={form.seoCanonicalUrl ?? ""}
            disabled={isPending}
            onChange={(event) => set("seoCanonicalUrl", event.target.value)}
          />
        </Field>
      </div>
      <Field htmlFor="post-seo-description" label="توضیح سئو">
        <Textarea
          id="post-seo-description"
          rows={2}
          value={form.seoDescription ?? ""}
          disabled={isPending}
          onChange={(event) => set("seoDescription", event.target.value)}
        />
      </Field>
      <div className="flex items-center gap-2">
        <input
          id="post-seo-noindex"
          type="checkbox"
          checked={form.seoNoindex === true}
          disabled={isPending}
          onChange={(event) => set("seoNoindex", event.target.checked)}
          className="size-4"
        />
        <label htmlFor="post-seo-noindex" className="text-sm">
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
