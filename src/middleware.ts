import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

// In-memory sliding window rate limiter stores: IP -> bucket
const generalApiBuckets = new Map<string, RateLimitBucket>();
const workspaceCreationBuckets = new Map<string, RateLimitBucket>();

// Cleanup stale buckets periodically
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupBuckets(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  generalApiBuckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      generalApiBuckets.delete(key);
    }
  });
  workspaceCreationBuckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      workspaceCreationBuckets.delete(key);
    }
  });
}

/**
 * Checks in-memory rate limit for a client IP.
 */
export function checkRateLimit(
  store: Map<string, RateLimitBucket>,
  ip: string,
  limit: number,
  windowMs: number = 60_000,
  now: number = Date.now()
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanupBuckets(now);

  const existing = store.get(ip);
  if (!existing || existing.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  // Rate Limiting on /api routes
  if (pathname.startsWith("/api")) {
    // 1. Explicitly bypass rate limiting for PayPal webhooks
    if (pathname === "/api/webhooks/paypal") {
      // Allow unrestricted delivery of payment webhooks
    } else if (pathname === "/api/workspaces" && request.method === "POST") {
      // 2. Strict rate limit on workspace creation: 10 req/min
      const res = checkRateLimit(workspaceCreationBuckets, ip, 10, 60_000);
      if (!res.allowed) {
        return NextResponse.json(
          {
            error: "Too many workspace creation requests. Please try again later.",
            code: "RATE_LIMIT_EXCEEDED",
          },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil((res.resetAt - Date.now()) / 1000).toString(),
            },
          }
        );
      }
    } else {
      // 3. General API rate limit: 60 req/min
      const res = checkRateLimit(generalApiBuckets, ip, 60, 60_000);
      if (!res.allowed) {
        return NextResponse.json(
          {
            error: "Too many requests. Please slow down.",
            code: "RATE_LIMIT_EXCEEDED",
          },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil((res.resetAt - Date.now()) / 1000).toString(),
            },
          }
        );
      }
    }
  }

  // Next response with applied Security Headers
  const response = NextResponse.next();

  // Security Headers
  // CSP tuned for Next.js hydration, AG Studio (workers, blob, eval), and PayPal sandbox frames
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.paypal.com https://generativelanguage.googleapis.com",
    "frame-src 'self' https://*.paypal.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
