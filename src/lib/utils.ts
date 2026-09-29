export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Western digits string wrapped for LTR display inside RTL text */
export const toLatinDigits = (n: number | string) => String(n);

/** Convert a number to Persian digits (۰۱۲۳۴۵۶۷۸۹) */
export function toFaDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
