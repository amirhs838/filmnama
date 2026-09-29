import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social share image: pure brand shapes + latin wordmark only
// (no Persian glyphs, so no font files are needed at render time).
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#111111",
          padding: "0 120px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 28, height: 28, backgroundColor: "#d71920" }} />
          <div style={{ fontSize: 44, letterSpacing: 18, color: "#8a8a8a", fontFamily: "sans-serif" }}>
            FILMNAMA
          </div>
        </div>
        <div style={{ fontSize: 120, fontWeight: 800, color: "#f4f2ed", marginTop: 16, fontFamily: "sans-serif" }}>
          Filmnama
        </div>
        <div style={{ width: 320, height: 6, backgroundColor: "#d71920", marginTop: 32 }} />
      </div>
    ),
    { ...size },
  );
}
