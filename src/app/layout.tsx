import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { site } from "@/data/site";
import { organizationJsonLd, serializeJsonLd } from "@/lib/structured-data";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} | از علاقه تا حرفه‌ای شدن`,
    template: `%s | ${site.shortName}`,
  },
  description: site.description,
  keywords: [
    "آموزشگاه سینمایی",
    "فیلم‌نما",
    "آموزش بازیگری",
    "فیلم‌برداری",
    "کارگردانی",
    "برنامه‌نویسی",
    "هوش مصنوعی",
    "موسیقی",
    "زبان انگلیسی",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa-IR"
      dir="rtl"
      className={`${vazirmatn.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-ivory text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              organizationJsonLd({
                name: site.name,
                url: "https://film-nama.com/",
                logo: "https://film-nama.com/logo.png",
                sameAs: [site.instagramUrl],
              }),
            ),
          }}
        />
        {children}
      </body>
    </html>
  );
}
