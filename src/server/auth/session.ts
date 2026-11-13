import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken, verifySessionToken } from "./token";

export type SessionUser = { id: string; email: string; name: string | null };

export async function createSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The logged-in user, or null. Checks the user still exists. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
}

/** For pages: the logged-in user, or a redirect to /login. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  // `expired` tells the proxy to drop the cookie: it can be validly signed but name a user
  // that no longer exists (deleted, or a different database), which would otherwise loop.
  if (!user) redirect("/login?expired=1");
  return user;
}
