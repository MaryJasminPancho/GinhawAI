import type { NextConfig } from "next";

// Basic security headers on every page (alpha-testing review, Nov 2026). The CSP only blocks
// framing, <base> tags and plugins; it does not restrict scripts, styles, map tiles or Google
// sign-in. The API sets the same headers in backend/app/main.py.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  // Hide the Next.js "N" development indicator. Build/runtime errors are still shown.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
