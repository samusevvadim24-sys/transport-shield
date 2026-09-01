import { NextRequest, NextResponse } from "next/server";

/**
 * Authentication is validated by the dashboard page/server layer via the
 * server-side session endpoint. The session cookie is an opaque random token,
 * so middleware must not try to parse it as a JWT/signed payload.
 *
 * Keeping this middleware as a pass-through also avoids redirect loops while
 * the login response is establishing the HttpOnly session cookie.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/admin/:path*",
    "/dashboard/customer/:path*",
    "/dashboard/driver/:path*",
  ],
};
