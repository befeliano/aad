import type { NextConfig } from "next";

/* Supabase projesinin host'u — connect/img/media izinleri için */
const SUPABASE_ORIGIN = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co"
).replace(/\/+$/, "");
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^https:/, "wss:");

/**
 * İçerik Güvenliği Politikası (CSP)
 * - script: 'wasm-unsafe-eval' sql.js (WASM) için gerekli.
 *   'unsafe-inline' Next.js'in bootstrap'i ve tema (FOUC) script'i için.
 * - connect: Supabase REST + Realtime (websocket)
 * - img/media: Supabase Storage imzalı URL'leri, harita karoları, blob önizlemeler
 * - frame-ancestors 'none': clickjacking'e karşı
 * - form-action 'self': formun dışarı POST etmesini engeller
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // 'unsafe-eval' YALNIZCA geliştirmede: React dev araçları (callstack
  // yeniden kurma vb.) eval kullanır. Üretimde React eval kullanmaz,
  // bu yüzden prod CSP'sinde yer almaz.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN} https://server.arcgisonline.com https://*.tile.openstreetmap.org`,
  `media-src 'self' blob: ${SUPABASE_ORIGIN}`,
  // ws:/wss: yalnızca geliştirmede — Next.js HMR websocket'i için
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}${
    process.env.NODE_ENV === "development" ? " ws: wss:" : ""
  }`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
