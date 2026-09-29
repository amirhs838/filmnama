import type { LeadStatus } from "./admin-api";

export type FaqRow = {
  question: string;
  answer: string;
};

export function normalizeFaqRows(rows: FaqRow[]): FaqRow[] {
  const out: FaqRow[] = [];
  for (const row of rows) {
    const question = row.question.trim();
    if (question.length === 0) continue;
    out.push({ question, answer: row.answer.trim() });
  }
  return out;
}

export function nextLeadStatus(status: LeadStatus): LeadStatus | null {
  if (status === "NEW") return "CONTACTED";
  if (status === "CONTACTED") return "CLOSED";
  return null;
}

export function leadStatusLabel(status: LeadStatus): string {
  if (status === "NEW") return "جدید";
  if (status === "CONTACTED") return "در تماس";
  return "بسته";
}

export function leadNextActionLabel(status: LeadStatus): string | null {
  if (status === "NEW") return "علامت به‌عنوان در تماس";
  if (status === "CONTACTED") return "بستن";
  return null;
}
