import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ts_auth_session";
const DASHBOARD_BY_ROLE: Record<string, string> = {
  admin: "/dashboard/admin",
  customer: "/dashboard/customer",
  driver: "/dashboard/driver",
};

function getSecret() {
  return process.env.AUTH_SESSION_SECRET;
}

function getSessionRole(request: NextRequest): string | null {
  const secret = getSecret();
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret || !value) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { role?: string; exp?: number };

    if (!session.role || !DASHBOARD_BY_ROLE[session.role]) return null;
    if (!Number.isFinite(session.exp) || session.exp! <= Math.floor(Date.now() / 1000)) return null;

    return session.role;
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
  matcher: ["/dashboard/admin/:path*", "/dashboard/customer/:path*", "/dashboard/driver/:path*"],
};
