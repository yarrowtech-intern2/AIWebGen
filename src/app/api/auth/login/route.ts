import { z } from "zod";
import { clientIp, takeAttempt } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import { normalizeEmail, verifyCredentials } from "@/server/auth/users";
import { errorResponse, HttpError, readJson } from "@/server/http";

const Login = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  try {
    const { email, password } = await readJson(req, Login);
    const allowed =
      takeAttempt(`login-ip:${clientIp(req)}`, 30) && takeAttempt(`login-email:${normalizeEmail(email)}`, 10);
    if (!allowed) throw new HttpError(429, "Too many login attempts. Try again in a few minutes.");

    const userId = await verifyCredentials(email, password);
    if (!userId) throw new HttpError(401, "Incorrect email or password.");
    await createSession(userId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
