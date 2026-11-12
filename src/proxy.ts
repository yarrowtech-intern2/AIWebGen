import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/token";

/**
 * Optimistic redirects only: send logged-out visitors to /login and logged-in
 * ones away from the auth pages. Every page and API route still checks the
 * session itself; this is not the security boundary.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const loggedIn = (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) !== null;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!loggedIn && !isAuthPage) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (loggedIn && isAuthPage) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/project/:path*", "/login", "/register"],
};
