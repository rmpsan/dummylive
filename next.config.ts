import type { NextConfig } from "next";

// Content-Security-Policy: permite apenas os hosts que a plataforma usa
// (Vimeo/YouTube para vídeo, Supabase para dados/realtime, Google Fonts).
// img-src https: cobre logos de CDN de qualquer cliente (white-label).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://player.vimeo.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "frame-src https://player.vimeo.com https://www.youtube.com https://www.youtube-nocookie.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vimeo.com https://*.vimeo.com https://www.youtube.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Headers de segurança (RNF-05).
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
