"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthService } from "@/services/auth.service";

const DASHBOARD_BY_ROLE = {
  admin: "/dashboard/admin",
  customer: "/dashboard/customer",
  driver: "/dashboard/driver",
} as const;

function getDashboardPath(role: string | undefined) {
  if (!role) return null;
  return DASHBOARD_BY_ROLE[role as keyof typeof DASHBOARD_BY_ROLE] ?? null;
}

export default function AuthSync() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let disposed = false;

    const syncRoute = async () => {
      const session = await AuthService.getServerSession();
      if (disposed) return;

      const isPublic = pathname === "/" || pathname === "/login";
      const isDashboard = pathname.startsWith("/dashboard/");

      if (!session) {
        if (isDashboard) router.replace("/login");
        return;
      }

      const dashboardPath = getDashboardPath(session.role);
      if (!dashboardPath) {
        await AuthService.logout();
        if (!disposed) router.replace("/login");
        return;
      }

      if (isPublic) {
        router.replace(dashboardPath);
        return;
      }

      if (isDashboard && !pathname.startsWith(dashboardPath)) {
        router.replace(dashboardPath);
      }
    };

    void syncRoute();

    const handleAuthChange = () => {
      void syncRoute();
    };

    window.addEventListener("ts-auth-change", handleAuthChange);

    return () => {
      disposed = true;
      window.removeEventListener("ts-auth-change", handleAuthChange);
    };
  }, [pathname, router]);

  return null;
}
