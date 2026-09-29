"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createConsultationSubmission, isConsultationAccepted, preselectConsultationCourse, validRetryAfter, type ConsultationCourse, type ConsultationErrors } from "@/lib/consultation";

const subscribe = () => () => {};
const uncertain = "نتیجه ارسال مشخص نیست و ممکن است درخواست ثبت شده باشد. بدون تغییر فرم، دوباره تلاش کنید تا همان شناسه و اطلاعات ارسال شود. تغییر فرم یک درخواست تازه می‌سازد.";
const inputClass = "mt-2 min-h-12 w-full border border-line-light bg-ink px-3 py-2 text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory disabled:opacity-60";

export function ConsultationForm({ available, courses, optionsUnavailable }: { available: boolean; courses: ConsultationCourse[]; optionsUnavailable: boolean }) {
  const prefix = useId();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const select = useRef<HTMLSelectElement>(null);
  const edited = useRef(false);
  const busy = useRef(false);
  const submission = useRef(createConsultationSubmission(() => crypto.randomUUID()));
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<ConsultationErrors>({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (select.current && !edited.current) preselectConsultationCourse(select.current, window.location.search, courses);
  }, [courses]);

  function edit() {
    edited.current = true;
    submission.current.edit();
    setSuccess(false);
    setErrors({});
    setStatus("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || success || !ready || !available) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    let result;
    try {
      result = submission.current.prepare({ name: data.get("name"), phone: data.get("phone"), email: data.get("email"), courseId: data.get("courseId"), message: data.get("message"), consent: data.get("consent") === "on" });
    } catch {
      setStatus("مرورگر امکان ساخت شناسه امن ندارد. از مرورگر به‌روز و اتصال امن استفاده کنید یا تلفنی تماس بگیرید.");
      return;
    }
    if (!result.ok) {
      setErrors(result.errors);
      setStatus("لطفاً خطاهای فرم را اصلاح کنید.");
      const field = Object.keys(result.errors)[0];
      const control = form.elements.namedItem(field);
      if (control instanceof HTMLElement) control.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setErrors({});
    setStatus("در حال ارسال درخواست؛ لطفاً منتظر بمانید.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/consultation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.payload), credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal });
      if (response.status === 201 && isConsultationAccepted(await response.json())) {
        setSuccess(true);
        setStatus("درخواست مشاوره شما دریافت شد. آموزش فیلم‌نما برای پیگیری همین درخواست با شما تماس می‌گیرد؛ این پیام به معنی ثبت‌نام در دوره نیست.");
      } else if (response.status === 429) {
        const retryAfter = validRetryAfter(response.headers.get("retry-after"));
        setStatus(`تعداد درخواست‌ها موقتاً محدود شده است. ${retryAfter ? `پس از ${retryAfter} ثانیه` : "کمی بعد"} بدون تغییر فرم دوباره تلاش کنید.`);
      } else if (response.status === 409) {
        setStatus("شناسه این درخواست قبلاً با اطلاعات دیگری استفاده شده است. برای پیگیری تلفنی تماس بگیرید؛ تنها برای درخواست تازه، فرم را ویرایش کنید.");
      } else if (response.status === 503) {
        setStatus("ارسال آنلاین در دسترس نیست؛ در این تلاش درخواستی ثبت نشد. کمی بعد بدون تغییر فرم تلاش کنید یا تلفنی تماس بگیرید.");
      } else if ([400, 403, 413, 415, 422].includes(response.status)) {
        setStatus("درخواست پذیرفته نشد. اطلاعات و رضایت تماس را بررسی کنید؛ اگر مشکل ادامه داشت تلفنی تماس بگیرید.");
      } else {
        setStatus(uncertain);
      }
    } catch {
      setStatus(uncertain);
    } finally {
      clearTimeout(timer);
      busy.current = false;
      setPending(false);
    }
  }

  function accessibility(field: keyof ConsultationErrors) {
    return { id: `${prefix}-${field}`, "aria-invalid": Boolean(errors[field]), "aria-describedby": `${prefix}-${field}-error` };
  }

  function error(field: keyof ConsultationErrors) {
    return <p id={`${prefix}-${field}-error`} className="mt-2 text-sm text-ivory">{errors[field]}</p>;
  }

  return (
    <section aria-labelledby={`${prefix}-title`} className="container-site border-b border-line-light py-14 text-ivory">
      <h2 id={`${prefix}-title`} className="text-2xl font-bold">درخواست مشاوره</h2>
      <p id={`${prefix}-privacy`} className="mt-4 max-w-3xl text-sm leading-8 text-fog">نام و راه‌های ارتباطی شما فقط برای تماس و پیگیری همین درخواست مشاوره به آموزش فیلم‌نما ارسال می‌شود، نه عضویت در خبرنامه یا تبلیغات. اطلاعات حساس را در پیام ننویسید. این فرم ثبت‌نام یا پرداخت نیست.</p>
      {!available && <p className="mt-4 text-sm leading-8">ارسال آنلاین در این حالت در دسترس نیست و اطلاعات فرم ذخیره نمی‌شود. برای مشاوره از شماره‌های تماس پایین صفحه استفاده کنید.</p>}
      {optionsUnavailable && available && <p id={`${prefix}-courses-notice`} className="mt-4 text-sm leading-8">فهرست دوره‌ها فعلاً در دسترس نیست؛ می‌توانید درخواست مشاوره عمومی بفرستید و نام دوره را در پیام بنویسید.</p>}
      <form onSubmit={submit} onChange={edit} noValidate aria-describedby={`${prefix}-privacy`} aria-busy={pending} className="mt-8 max-w-3xl">
        <fieldset disabled={!available || !ready || pending} className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">اطلاعات درخواست مشاوره</legend>
          <div>
            <label htmlFor={`${prefix}-name`}>نام و نام خانوادگی (ضروری)</label>
            <input {...accessibility("name")} name="name" autoComplete="name" required minLength={2} maxLength={100} className={inputClass} />
            {error("name")}
          </div>
          <div>
            <label htmlFor={`${prefix}-phone`}>موبایل (ضروری)</label>
            <input {...accessibility("phone")} name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} dir="ltr" className={inputClass} />
            {error("phone")}
          </div>
          <div>
            <label htmlFor={`${prefix}-email`}>ایمیل (اختیاری)</label>
            <input {...accessibility("email")} name="email" type="email" autoComplete="email" maxLength={254} dir="ltr" className={inputClass} />
            {error("email")}
          </div>
          <div>
            <label htmlFor={`${prefix}-courseId`}>دوره مورد نظر (اختیاری)</label>
            <select {...accessibility("courseId")} ref={select} name="courseId" defaultValue="" className={inputClass}>
              <option value="">مشاوره عمومی / هنوز انتخاب نکرده‌ام</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
            {error("courseId")}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${prefix}-message`}>پیام (اختیاری، حداکثر ۲۰۰۰ نویسه)</label>
            <textarea {...accessibility("message")} name="message" maxLength={2000} rows={4} className={inputClass} />
            {error("message")}
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-start gap-3">
              <input {...accessibility("consent")} name="consent" type="checkbox" required className="mt-1 size-5 shrink-0 accent-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory" />
              <label htmlFor={`${prefix}-consent`} className="text-sm leading-7">رضایت دارم آموزش فیلم‌نما فقط برای پیگیری این درخواست با من تماس بگیرد. (ضروری)</label>
            </div>
            {error("consent")}
          </div>
          <button type="submit" disabled={success} className="min-h-12 bg-red px-6 py-3 text-sm font-bold text-ivory hover:bg-red-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">{pending ? "در حال ارسال…" : success ? "درخواست دریافت شد" : "ارسال درخواست مشاوره"}</button>
        </fieldset>
        <div role="status" aria-live="polite" aria-atomic="true" className="mt-5 text-sm leading-8">
          <p>{status}</p>
          {errors.form && <p>{errors.form}</p>}
          {errors.submissionId && <p>{errors.submissionId}</p>}
        </div>
        <noscript><p className="mt-4 text-sm">برای ارسال آنلاین جاوااسکریپت را فعال کنید یا با شماره‌های پایین صفحه تماس بگیرید.</p></noscript>
      </form>
    </section>
  );
}
