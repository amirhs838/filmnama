import { createHmac, timingSafeEqual } from "node:crypto";
import { isContentPath, isCustomUrlPath, record } from "./content-contract";

export const MAX_REVALIDATE_BYTES = 16 * 1024;

export function validRevalidateSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}

export function verifyRevalidateSignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string, now = Math.floor(Date.now() / 1000)): boolean {
  if (!validRevalidateSecret(secret) || !timestamp || !/^\d{1,12}$/.test(timestamp) || !signature || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now - seconds) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function parseRevalidatePaths(rawBody: string): string[] {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REVALIDATE_BYTES) throw new Error("Invalid revalidation body");
  const body = record(JSON.parse(rawBody));
  // The webhook is HMAC-signed; custom editor paths are accepted alongside
  // CMS paths so outbox rows for custom URLs can drain.
  if (Object.keys(body).length !== 1 || !Array.isArray(body.paths) || body.paths.length < 1 || body.paths.length > 100 || !body.paths.every((path) => isContentPath(path) || isCustomUrlPath(path))) throw new Error("Invalid revalidation paths");
  return [...new Set(body.paths as string[])];
}

export async function readRevalidateBody(request: Request): Promise<string> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REVALIDATE_BYTES)) throw new Error("Invalid body size");
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REVALIDATE_BYTES) {
        await reader.cancel();
        throw new Error("Invalid body size");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    reader.releaseLock();
  }
}
