"use client";

export default function ErrorPage({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <section className="container-site section-y mt-20">
      <p className="text-label-latin text-red" dir="ltr">TEMPORARILY UNAVAILABLE</p>
      <h1 className="mt-4 text-3xl font-extrabold">دریافت اطلاعات ممکن نشد</h1>
      <p className="mt-6 text-sm leading-8 text-smoke">لطفاً کمی بعد دوباره تلاش کنید.</p>
      <button onClick={() => unstable_retry()} className="mt-8 inline-flex h-12 items-center bg-red px-6 text-sm font-medium text-ivory transition-colors hover:bg-red-deep">تلاش دوباره</button>
    </section>
  );
}
