import "server-only";
import { backendUrl, contentSource } from "@/lib/content-config";
import {
  adminBodyLimit,
  checkProxyOrigin,
  isAllowedAdminMethod,
  isAllowedAdminPath,
  isMediaUpload,
  isUploadContentLengthAllowed,
  isUploadContentType,
  MEDIA_UPLOAD_LIMIT,
  MEDIA_UPLOAD_TIMEOUT_MS,
  resolveAdminProxyPath,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_LIMIT = 1048576;
const TIMEOUT_MS = 15000;

class BodyLimitError extends Error {}

async function readRaw(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
  limit: number,
): Promise<Uint8Array> {
  if (!body) throw new Error("empty");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new BodyLimitError();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function readJson(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
  limit: number,
): Promise<unknown> {
  const bytes = await readRaw(body, signal, limit);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function json(value: unknown, status: number, retryAfter?: string) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter !== undefined) headers["Retry-After"] = retryAfter;
  return Response.json(value, { status, headers });
}

function validRetryAfter(value: string | null): string | undefined {
  return value !== null &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value))
    ? value
    : undefined;
}

function hasJsonBody(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function mapUpstream(status: number): { status: number; error: string } {
  // 415 means the client sent a wrong/missing content type (e.g. a JSON
  // route hit without application/json) — a client error, not an outage.
  if (status === 400 || status === 415 || status === 422)
    return { status: 400, error: "rejected" };
  if (status === 401) return { status: 401, error: "unauthorized" };
  if (status === 403) return { status: 403, error: "forbidden" };
  if (status === 404) return { status: 404, error: "not_found" };
  if (status === 409) return { status: 409, error: "conflict" };
  if (status === 429) return { status: 429, error: "rate_limited" };
  return { status: 502, error: "upstream" };
}

function passCookies(upstream: Headers, response: Response): void {
  const getSetCookie =
    typeof (upstream as Headers & { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (upstream as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : (() => {
          const single = upstream.get("set-cookie");
          return single ? [single] : [];
        })();
  for (const cookieValue of getSetCookie)
    response.headers.append("Set-Cookie", cookieValue);
}

async function proxyMediaUpload(request: Request, url: URL): Promise<Response> {
  if (!isUploadContentType(request.headers.get("content-type")))
    return json({ error: "unsupported_media_type" }, 415);
  if (!isUploadContentLengthAllowed(request.headers.get("content-length")))
    return json({ error: "body_too_large" }, 413);

  const readController = new AbortController();
  const readTimer = setTimeout(() => readController.abort(), MEDIA_UPLOAD_TIMEOUT_MS);
  let raw: Uint8Array;
  try {
    raw = await readRaw(request.body, readController.signal, MEDIA_UPLOAD_LIMIT);
  } catch (error) {
    return json(
      { error: error instanceof BodyLimitError ? "body_too_large" : "invalid_body" },
      error instanceof BodyLimitError ? 413 : 400,
    );
  } finally {
    clearTimeout(readTimer);
  }

  const forward = new Headers();
  forward.set("Accept", "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) forward.set("Content-Type", contentType);
  const origin = request.headers.get("origin");
  try {
    forward.set("Origin", origin ?? new URL(request.url).origin);
  } catch {
    return json({ error: "unavailable" }, 503);
  }
  const cookie = request.headers.get("cookie");
  if (cookie) forward.set("Cookie", cookie);
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) forward.set("X-CSRF-Token", csrf);
  const auth = request.headers.get("authorization");
  if (auth) forward.set("Authorization", auth);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_UPLOAD_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: forward,
      body: raw as BodyInit,
      credentials: "omit",
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!upstream.ok) {
      void upstream.body?.cancel().catch(() => {});
      if (upstream.status === 413)
        return json({ error: "body_too_large" }, 413);
      if (upstream.status === 415)
        return json({ error: "unsupported_media_type" }, 415);
      const mapped = mapUpstream(upstream.status);
      const retryAfter =
        mapped.status === 429 || upstream.status === 503
          ? validRetryAfter(upstream.headers.get("retry-after"))
          : undefined;
      return json({ error: mapped.error }, mapped.status, retryAfter);
    }
    if (
      upstream.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() !== "application/json"
    ) {
      void upstream.body?.cancel().catch(() => {});
      return json({ error: "upstream" }, 502);
    }
    let data: unknown;
    try {
      data = await readJson(upstream.body, controller.signal, UPSTREAM_LIMIT);
    } catch {
      return json({ error: "upstream" }, 502);
    }
    const response = new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
    passCookies(upstream.headers, response);
    return response;
  } catch {
    return json(
      { error: controller.signal.aborted ? "timeout" : "upstream" },
      controller.signal.aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function proxyAdmin(request: Request, segments: string[]): Promise<Response> {
  const path = resolveAdminProxyPath(segments);
  const origin = request.headers.get("origin");
  if (!checkProxyOrigin(origin, request.url, request.method))
    return json({ error: "forbidden" }, 403);
  if (!isAllowedAdminPath(path)) return json({ error: "not_found" }, 404);
  if (!isAllowedAdminMethod(path, request.method))
    return json({ error: "method_not_allowed" }, 405);
  let url: URL;
  try {
    if (contentSource() !== "api") return json({ error: "unavailable" }, 503);
    url = new URL(path, backendUrl());
    const incoming = new URL(request.url);
    if (incoming.search) url.search = incoming.search;
  } catch {
    return json({ error: "unavailable" }, 503);
  }

  if (isMediaUpload(path, request.method))
    return proxyMediaUpload(request, url);

  const forward = new Headers();
  forward.set("Accept", request.headers.get("accept") ?? "application/json");
  try {
    forward.set("Origin", origin ?? new URL(request.url).origin);
  } catch {
    return json({ error: "unavailable" }, 503);
  }
  const cookie = request.headers.get("cookie");
  if (cookie) forward.set("Cookie", cookie);
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) forward.set("X-CSRF-Token", csrf);
  const auth = request.headers.get("authorization");
  if (auth) forward.set("Authorization", auth);

  let body: string | undefined;
  if (hasJsonBody(request.method)) {
    const limit = adminBodyLimit(path, request.method);
    if (limit === null) return json({ error: "method_not_allowed" }, 405);
    if (
      request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      return json({ error: "json_required" }, 415);
    const length = request.headers.get("content-length");
    if (
      length !== null &&
      (!/^\d+$/.test(length) || Number(length) > limit)
    )
      return json({ error: "body_too_large" }, 413);
    let value: unknown;
    try {
      value = await readJson(
        request.body,
        AbortSignal.timeout(10000),
        limit,
      );
    } catch (error) {
      return json(
        { error: error instanceof BodyLimitError ? "body_too_large" : "invalid_json" },
        error instanceof BodyLimitError ? 413 : 400,
      );
    }
    body = JSON.stringify(value);
    forward.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: forward,
      body,
      credentials: "omit",
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!upstream.ok) {
      void upstream.body?.cancel().catch(() => {});
      const mapped = mapUpstream(upstream.status);
      const retryAfter =
        mapped.status === 429 || upstream.status === 503
          ? validRetryAfter(upstream.headers.get("retry-after"))
          : undefined;
      return json({ error: mapped.error }, mapped.status, retryAfter);
    }
    if (
      upstream.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() !== "application/json"
    ) {
      void upstream.body?.cancel().catch(() => {});
      return json({ error: "upstream" }, 502);
    }
    let data: unknown;
    try {
      data = await readJson(upstream.body, controller.signal, UPSTREAM_LIMIT);
    } catch {
      return json({ error: "upstream" }, 502);
    }
    const out = new Headers();
    out.set("Cache-Control", "no-store");
    out.set("Content-Type", "application/json");
    const getSetCookie =
      typeof (
        upstream.headers as Headers & { getSetCookie?: () => string[] }
      ).getSetCookie === "function"
        ? (
            upstream.headers as Headers & { getSetCookie: () => string[] }
          ).getSetCookie()
        : (() => {
            const single = upstream.headers.get("set-cookie");
            return single ? [single] : [];
          })();
    const response = new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: out,
    });
    for (const cookieValue of getSetCookie)
      response.headers.append("Set-Cookie", cookieValue);
    return response;
  } catch {
    return json(
      { error: controller.signal.aborted ? "timeout" : "upstream" },
      controller.signal.aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyAdmin(request, (path ?? []));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyAdmin(request, (path ?? []));
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyAdmin(request, (path ?? []));
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyAdmin(request, (path ?? []));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyAdmin(request, (path ?? []));
}
