import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring capability for one project's preview.
 *
 * The preview iframe is sandboxed without same-origin, so its CSS/JS requests
 * carry no session cookie. The token in the URL path authorises them instead,
 * and relative links inside the site keep it automatically.
 *
 * Format: <projectId>.<expiry, base36 seconds>.<HMAC-SHA256, base64url>
 */
const TTL_SECONDS = 12 * 60 * 60;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is not set");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`preview:${payload}`).digest("base64url");

export function createPreviewToken(projectId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${projectId}.${exp.toString(36)}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the project id if the token is authentic and unexpired. */
export function verifyPreviewToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [projectId, expB36, sig] = parts;
  const expected = Buffer.from(sign(`${projectId}.${expB36}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (parseInt(expB36, 36) * 1000 < Date.now()) return null;
  return projectId;
}
