export type ConsultationPayload = {
  submissionId: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  courseId?: string;
  consent: true;
};

export type ConsultationErrors = Partial<Record<keyof ConsultationPayload | "form", string>>;
export type ConsultationResult = { ok: true; payload: ConsultationPayload } | { ok: false; errors: ConsultationErrors };
export type ConsultationCourse = { id: string; title: string };

export function normalizeMobile(value: string): string {
  return value.trim().replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632)))
    .replace(/^(?:\+98|0098)/, "0");
}

export function validateConsultation(value: unknown): ConsultationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: { form: "اطلاعات فرم معتبر نیست." } };
  const input = value as Record<string, unknown>;
  const errors: ConsultationErrors = {};
  const keys = ["submissionId", "name", "phone", "email", "message", "courseId", "consent"];
  if (Object.keys(input).some((key) => !keys.includes(key))) errors.form = "اطلاعات فرم معتبر نیست.";
  const submissionId = typeof input.submissionId === "string" ? input.submissionId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) errors.submissionId = "شناسه درخواست معتبر نیست. صفحه را دوباره باز کنید.";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 100) errors.name = "نام باید بین ۲ تا ۱۰۰ نویسه باشد.";
  const phone = typeof input.phone === "string" ? normalizeMobile(input.phone) : "";
  if (!/^09\d{9}$/.test(phone)) errors.phone = "شماره موبایل معتبر ایران وارد کنید؛ مانند ۰۹۱۲۳۴۵۶۷۸۹.";
  if (input.consent !== true) errors.consent = "برای تماس درباره این درخواست، رضایت خود را اعلام کنید.";
  const optional: Pick<ConsultationPayload, "email" | "message" | "courseId"> = {};
  for (const [key, max] of [["email", 254], ["message", 2000], ["courseId", 100]] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string") {
      errors[key] = "مقدار واردشده معتبر نیست.";
      continue;
    }
    const text = input[key].trim();
    if (text.length > max) errors[key] = `حداکثر ${max} نویسه مجاز است.`;
    if (text) optional[key] = text;
  }
  if (optional.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(optional.email)) errors.email = "ایمیل معتبر وارد کنید یا این بخش را خالی بگذارید.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, payload: { submissionId, name, phone, ...optional, consent: true } };
}

export function isConsultationAccepted(value: unknown): value is { accepted: true } {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && (value as Record<string, unknown>).accepted === true;
}

export function consultationCourseFromSearch(search: string, courses: ConsultationCourse[]): string {
  const id = new URLSearchParams(search).get("course");
  return courses.find((course) => course.id === id)?.id ?? "";
}

export function preselectConsultationCourse(select: { value: string }, search: string, courses: ConsultationCourse[]) {
  select.value = consultationCourseFromSearch(search, courses);
}

export function createConsultationSubmission(uuid: () => string) {
  let id: string | undefined;
  let snapshot: string | undefined;
  let payload: ConsultationPayload | undefined;
  return {
    edit() { id = undefined; snapshot = undefined; payload = undefined; },
    prepare(input: Record<string, unknown>): ConsultationResult {
      const next = JSON.stringify(input);
      if (snapshot !== undefined && snapshot !== next) { id = undefined; payload = undefined; }
      id ??= uuid();
      snapshot = next;
      if (payload) return { ok: true, payload: { ...payload } };
      const result = validateConsultation({ ...input, submissionId: id });
      if (result.ok) payload = { ...result.payload };
      return result;
    },
  };
}

export function validRetryAfter(value: string | null): string | undefined {
  return value !== null && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? value : undefined;
}
