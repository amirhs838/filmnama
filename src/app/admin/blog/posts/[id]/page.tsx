"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getPost,
  listCategories,
  listMedia,
  listTags,
  savePost,
  type PostFormState,
  type PostInput,
} from "@/lib/admin-api";
import { getAdminTokens } from "@/lib/admin-auth";
import PostForm, { type CategoryOption, type CoverOption, type TagOption } from "@/components/admin/PostForm";
import { FormError } from "@/components/admin/AdminForm";

type Phase = "loading" | "unauthenticated" | "ready";

export default function AdminPostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [phase, setPhase] = useState<Phase>("loading");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [covers, setCovers] = useState<CoverOption[]>([]);
  const [initial, setInitial] = useState<PostFormState | null>(null);
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
        const [cats, tgs, media, post] = await Promise.all([
          listCategories(fetch),
          listTags(fetch),
          listMedia(fetch, { limit: 100 }).catch(() => ({ items: [], nextCursor: null })),
          getPost(fetch, id),
        ]);
        if (cancelled) return;
        setCategories(cats.items.map((cat) => ({ id: cat.id, title: cat.title })));
        setTags(tgs.items.map((t) => ({ id: t.id, title: t.title })));
        setCovers(media.items.map((item) => ({ id: item.id, alt: item.alt, mimeType: item.mimeType })));
        setInitial({
          slug: post.slug,
          customPath: post.customPath ?? "",
          title: post.title,
          excerpt: post.excerpt,
          contentHtml: post.contentHtml,
          categoryId: post.categoryId ?? "",
          tagIdsText: post.tagIds.join(", "),
          coverMediaId: post.coverMediaId ?? "",
          seoTitle: post.seo.title ?? "",
          seoDescription: post.seo.description ?? "",
          seoCanonicalUrl: post.seo.canonicalUrl ?? "",
          seoNoindex: post.seo.noindex,
          status: post.status,
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
        setError("دریافت نوشته ناموفق بود.");
        setPhase("ready");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(payload: PostInput) {
    setError(null);
    setForbidden(false);
    setOk(null);
    setPending(true);
    try {
      await savePost(fetch, { ...payload, id });
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
      setError("ذخیره نوشته ناموفق بود.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "loading") {
    return (
      <section aria-labelledby="post-detail-title" className="max-w-3xl">
        <h1 id="post-detail-title" className="text-h3">
          ویرایش نوشته
        </h1>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-smoke">
          در حال بارگذاری…
        </p>
      </section>
    );
  }

  if (phase === "unauthenticated") {
    return (
      <section aria-labelledby="post-detail-title" className="max-w-xl">
        <h1 id="post-detail-title" className="text-h3">
          ویرایش نوشته
        </h1>
        <p aria-live="polite" className="mt-4 text-sm leading-7 text-smoke">
          برای ویرایش نوشته ابتدا وارد شوید.
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
      <section aria-labelledby="post-detail-title" className="max-w-xl">
        <h1 id="post-detail-title" className="text-h3">
          ویرایش نوشته
        </h1>
        <p aria-live="polite" role="alert" className="mt-4 text-sm text-red">
          {error ?? "موردی یافت نشد."}
        </p>
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به نوشته‌های وبلاگ ندارید.
          </p>
        )}
        <p className="mt-6">
          <Link href="/admin/blog/posts" className="text-sm underline">
            بازگشت به نوشته‌ها
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="post-detail-title" className="max-w-3xl">
      <h1 id="post-detail-title" className="text-h3">
        ویرایش نوشته
      </h1>
      <p className="mt-4">
        <Link href="/admin/blog/posts" className="text-sm underline">
          بازگشت به نوشته‌ها
        </Link>
      </p>
      <div className="mt-6" key={id}>
        <PostForm
          initial={initial}
          categoryOptions={categories}
          tagOptions={tags}
          coverOptions={covers}
          pending={pending}
          submitLabel={pending ? "در حال ذخیره…" : "ذخیره"}
          onSubmit={(payload) => void handleSubmit(payload)}
        />
      </div>
      <div className="mt-4">
        <FormError id="post-detail-error" message={error} />
        {forbidden && (
          <p aria-live="polite" className="mt-2 text-sm leading-7 text-smoke">
            دسترسی به نوشته‌های وبلاگ ندارید.
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
