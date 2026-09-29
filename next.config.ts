import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  // Migration phase 4 (user-approved): legacy WP archive URLs with no
  // same-path equivalent redirect permanently to the closest hub.
  // NOTE: only `redirects` may be added here; URL masking stays forbidden
  // (see content.test.ts).
  async redirects() {
    return [
      { source: "/2022/09/26/", destination: "/blog/", permanent: true },
      { source: "/2024/09/25/", destination: "/blog/", permanent: true },
      { source: "/2024/09/26/", destination: "/blog/", permanent: true },
      { source: "/2024/09/28/", destination: "/blog/", permanent: true },
      { source: "/author/deli/", destination: "/blog/", permanent: true },
      { source: "/author/jaberi/", destination: "/contact-us/", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        // Placeholder photo service — replace with local assets in /public when ready
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
