import sitemap from "@/app/sitemap";

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(): Promise<Response> {
  const entries = await sitemap();
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastModified instanceof Date ? entry.lastModified.toISOString() : String(entry.lastModified ?? "");
      return `  <url><loc>${escapeXml(entry.url)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}</url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
