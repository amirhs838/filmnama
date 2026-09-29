import "server-only";
import { backendUrl, contentSource } from "@/lib/content-config";
import { isMediaId, MEDIA_PROXY_LIMIT } from "@/lib/content-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 30000;
const MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
]);

function json(value: unknown, status: number) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
): Promise<Uint8Array | null> {
  if (!body) return null;
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
      if (size > MEDIA_PROXY_LIMIT) return null;
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isMediaId(id)) return json({ error: "not_found" }, 404);
  let url: URL;
  try {
    if (contentSource() !== "api") return json({ error: "unavailable" }, 503);
    url = new URL(`public/media/${id}/file`, backendUrl());
  } catch {
    return json({ error: "unavailable" }, 503);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "image/*,video/mp4" },
      credentials: "omit",
      signal: controller.signal,
      // Follow backend redirects to Blob-hosted bytes (serverless deploys);
      // disk-hosted bytes never redirect, so behavior there is unchanged.
      redirect: "follow",
      cache: "no-store",
    });
    if (!upstream.ok) {
      void upstream.body?.cancel().catch(() => {});
      return upstream.status === 404
        ? json({ error: "not_found" }, 404)
        : json({ error: "upstream" }, 502);
    }
    const mime =
      upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ??
      "";
    if (!MEDIA_MIME_TYPES.has(mime)) {
      void upstream.body?.cancel().catch(() => {});
      return json({ error: "upstream" }, 502);
    }
    const bytes = await readCapped(upstream.body, controller.signal).catch(
      () => null,
    );
    if (!bytes) return json({ error: "upstream" }, 502);
    const headers = new Headers();
    headers.set("Content-Type", mime);
    headers.set(
      "Cache-Control",
      upstream.headers.get("cache-control") ??
        "public, max-age=31536000, immutable",
    );
    const etag = upstream.headers.get("etag");
    if (etag) headers.set("ETag", etag);
    return new Response(bytes as BodyInit, { status: 200, headers });
  } catch {
    return json(
      { error: controller.signal.aborted ? "timeout" : "upstream" },
      controller.signal.aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}
