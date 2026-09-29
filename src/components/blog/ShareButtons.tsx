"use client";

import { useState } from "react";
import { shareLinks } from "@/lib/content-contract";

type ShareButtonsProps = {
  url: string;
  title: string;
};

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const links = shareLinks(url, title);
  const items = [
    { href: links.x, label: "اشتراک در ایکس" },
    { href: links.telegram, label: "اشتراک در تلگرام" },
    { href: links.whatsapp, label: "اشتراک در واتساپ" },
    { href: links.linkedin, label: "اشتراک در لینکدین" },
  ];

  async function handleCopy() {
    const ok = await copyText(url);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="اشتراک‌گذاری">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-line px-4 py-2 text-sm transition-colors hover:text-red"
        >
          {item.label}
        </a>
      ))}
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="border border-line-strong px-4 py-2 text-sm disabled:opacity-60"
      >
        کپی پیوند
      </button>
      <span aria-live="polite" className="text-sm text-smoke">
        {copied ? "پیوند کپی شد." : ""}
      </span>
    </div>
  );
}
