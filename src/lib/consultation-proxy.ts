import { isConsultationAccepted, validateConsultation, validRetryAfter } from "./consultation";

class BodyLimitError extends Error {}

async function readJson(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<unknown> {
  if (!body) throw new Error();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) throw new BodyLimitError();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function json(value: unknown, status: number, retryAfter?: string) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter !== undefined) headers["Retry-After"] = retryAfter;
  return Response.json(value, { status, headers });
}

export async function proxyConsultation(request: Request, config: {
  contentSource: () => string;
  backendUrl: () => URL;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "forbidden" }, 403);
  let url: URL;
  try {
    if (config.contentSource() !== "api") return json({ error: "unavailable" }, 503);
    url = new URL("public/leads", config.backendUrl());
  } catch {
    return json({ error: "unavailable" }, 503);
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return json({ error: "json_required" }, 415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) return json({ error: "body_too_large" }, 413);
  let value: unknown;
  try {
    value = await readJson(request.body, AbortSignal.timeout(10000));
  } catch (error) {
    return json({ error: error instanceof BodyLimitError ? "body_too_large" : "invalid_json" }, error instanceof BodyLimitError ? 413 : 400);
  }
  const result = validateConsultation(value);
  if (!result.ok) return json({ error: "validation", errors: result.errors }, 400);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 10000);
  try {
    const upstream = await (config.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: origin },
      body: JSON.stringify(result.payload),
      credentials: "omit",
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (upstream.status !== 201) {
      void upstream.body?.cancel().catch(() => {});
      const retryAfter = validRetryAfter(upstream.headers.get("retry-after"));
      if (upstream.status === 429) return json({ error: "rate_limited" }, 429, retryAfter);
      if (upstream.status === 409) return json({ error: "conflict" }, 409);
      if (upstream.status === 400 || upstream.status === 422) return json({ error: "rejected" }, 400);
      if (upstream.status === 403) return json({ error: "forbidden" }, 403);
      return json({ error: "uncertain" }, 502, upstream.status === 503 ? retryAfter : undefined);
    }
    if (upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      void upstream.body?.cancel().catch(() => {});
      return json({ error: "uncertain" }, 502);
    }
    if (!isConsultationAccepted(await readJson(upstream.body, controller.signal))) return json({ error: "uncertain" }, 502);
    return json({ accepted: true }, 201);
  } catch {
    return json({ error: "uncertain" }, controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
