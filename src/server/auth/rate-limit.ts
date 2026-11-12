import "server-only";

/**
 * Small in-memory fixed-window limiter for login/register attempts.
 * Per process only; use Redis or similar when running several instances.
 */
const globalForLimits = globalThis as unknown as { authAttempts?: Map<string, { count: number; resetAt: number }> };
const attempts = (globalForLimits.authAttempts ??= new Map());

export function takeAttempt(key: string, limit = 10, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
