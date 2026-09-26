/**
 * Edge-compatible in-memory rate limiter.
 *
 * Uses a sliding window counter stored in a module-level Map.
 * Works in Next.js Edge Runtime and Node.js runtime.
 *
 * For production at scale, swap the Map for a Redis/Upstash store.
 * The interface stays identical — only the storage backend changes.
 *
 * Usage:
 *   const result = await rateLimit(request, { limit: 20, window: 60 });
 *   if (!result.allowed) return rateLimitResponse(result);
 */

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  window: number;
  /** Key prefix to namespace different limiters */
  prefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp seconds
}

// Module-level store — persists across requests in the same process
const store = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

/**
 * Derive a rate-limit key from the request.
 * Uses the authenticated user ID if present, otherwise falls back to IP.
 * This prevents a single user from evading limits by rotating IPs.
 */
function getKey(request: Request, prefix: string, userId?: string): string {
  if (userId) return `${prefix}:user:${userId}`;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:ip:${ip}`;
}

export function rateLimit(
  request: Request,
  options: RateLimitOptions,
  userId?: string
): RateLimitResult {
  const { limit, window, prefix = "rl" } = options;
  const key     = getKey(request, prefix, userId);
  const nowSecs = Math.floor(Date.now() / 1000);

  const entry = store.get(key);

  // No entry or expired window — start fresh
  if (!entry || entry.resetAt <= nowSecs) {
    const resetAt = nowSecs + window;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  // Within window — increment
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const allowed   = entry.count <= limit;

  return { allowed, limit, remaining, resetAt: entry.resetAt };
}

/** Standard 429 response with Retry-After header */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = result.resetAt - Math.floor(Date.now() / 1000);
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down.",
      retryAfter,
      resetAt: new Date(result.resetAt * 1000).toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type":  "application/json",
        "Retry-After":   String(retryAfter),
        "X-RateLimit-Limit":     String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset":     String(result.resetAt),
      },
    }
  );
}

// ── Pre-configured limiters for each route type ───────────────────────────────

/** AI chat — most expensive, strictest limit */
export const AI_CHAT_LIMIT    = { limit: 15,  window: 5  * 60, prefix: "chat"    };
/** Analytics ingest — high volume expected, generous limit */
export const ANALYTICS_LIMIT  = { limit: 120, window: 60 * 60, prefix: "analytics" };
/** Video signed URL — per request, moderate */
export const VIDEO_LIMIT      = { limit: 30,  window: 60 * 60, prefix: "video"   };
/** Admin actions — low volume, strict */
export const ADMIN_LIMIT      = { limit: 60,  window: 60 * 60, prefix: "admin"   };
/** Payments — very strict */
export const PAYMENT_LIMIT    = { limit: 10,  window: 60 * 60, prefix: "payment" };
/** Auth callback — prevent token stuffing */
export const AUTH_LIMIT       = { limit: 10,  window: 15 * 60, prefix: "auth"    };
/** Data deletion — once per session is enough */
export const DELETION_LIMIT   = { limit: 3,   window: 24 * 60 * 60, prefix: "delete" };
