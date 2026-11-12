import { z } from "zod";
import { clientIp, takeAttempt } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import { EmailTakenError, registerUser } from "@/server/auth/users";
import { errorResponse, HttpError, readJson } from "@/server/http";

const Register = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email("Enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: Request) {
  try {
    if (!takeAttempt(`register:${clientIp(req)}`, 10)) {
      throw new HttpError(429, "Too many attempts. Try again in a few minutes.");
    }
    const input = await readJson(req, Register);
    try {
      const user = await registerUser(input);
      await createSession(user.id);
      return Response.json({ ok: true }, { status: 201 });
    } catch (err) {
      if (err instanceof EmailTakenError) throw new HttpError(409, "An account with this email already exists. Log in instead.");
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
