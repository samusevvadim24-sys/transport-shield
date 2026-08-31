import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ts_auth_session";
const DASHBOARD_BY_ROLE: Record<string, string> = {
  admin: "/dashboard/admin",
  customer: "/dashboard/customer",
  driver: "/dashboard/driver",
};

/**
 * Middleware must stay Edge-compatible. Session authenticity is validated by
 * the route/server layer; middleware only reads the signed session payload
 * to prevent cross-dashboard redirect loops.
 */
function getSessionRole(request: NextRequest): string | null {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(value.slice(0, separator), "base64url").toString("utf8")
    ) as { role?: string; exp?: number };

    if (!payload.role || !DASHBOARD_BY_ROLE[payload.role]) return null;
    if (!Number.isFinite(payload.exp) || payload.exp! <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload.role;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const matchedRole =
    pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")
      ? "admin"
      : pathname === "/dashboard/customer" || pathname.startsWith("/dashboard/customer/")
        ? "customer"
        : pathname === "/dashboard/driver" || pathname.startsWith("/dashboard/driver/")
          ? "driver"
          : null;

  if (!matchedRole) return NextResponse.next();

  const role = getSessionRole(request);

  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role !== matchedRole) {
    return NextResponse.redirect(new URL(DASHBOARD_BY_ROLE[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/admin/:path*",
    "/dashboard/customer/:path*",
    "/dashboard/driver/:path*",
  ],
};
