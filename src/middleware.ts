import { NextResponse, type NextRequest } from "next/server";

/**
 * Nonce-based Content Security Policy.
 *
 * ALSOS teaches security, so the frontend is held to the standard it teaches:
 * no external script origins at all (§17), every asset self-hosted, and inline
 * scripts allowed only when they carry a per-request nonce.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    `default-src 'self'`,
    // `strict-dynamic` lets Next's nonced bootstrap load its own chunks while
    // still refusing anything a third party injects.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""}`,
    // Styles stay inline-capable: CSS Modules ship as files, but React inlines
    // a handful of style attributes (progress meters, particle opacity).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ]
    .filter(Boolean)
    .join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Static assets are served with immutable caching and need no nonce.
    {
      source: "/((?!_next/static|_next/image|assets|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
