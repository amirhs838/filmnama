import "server-only";

export function contentSource(): "mock" | "api" {
  const source = process.env.FILMNAMA_CONTENT_SOURCE;
  if (process.env.NODE_ENV === "production" && source !== "api") {
    throw new Error("Production requires FILMNAMA_CONTENT_SOURCE=api");
  }
  if (source === undefined && process.env.NODE_ENV !== "production") return "mock";
  if (source !== "mock" && source !== "api") throw new Error("Invalid FILMNAMA_CONTENT_SOURCE");
  return source;
}

export function backendUrl(): URL {
  const value = process.env.BACKEND_API_URL;
  if (!value) throw new Error("BACKEND_API_URL is required for API content");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid BACKEND_API_URL"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Invalid BACKEND_API_URL");
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}
