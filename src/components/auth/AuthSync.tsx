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
    const syncRoute = () => {
      const session = AuthService.getSession();
      const isPublic = pathname === "/" || pathname === "/login";
      const isDashboard = pathname.startsWith("/dashboard/");

      if (!session) {
        if (isDashboard) router.replace("/login");
        return;
      }

      const dashboardPath = getDashboardPath(session.role);
      if (!dashboardPath) {
        AuthService.logout();
        router.replace("/login");
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

    syncRoute();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "ts_user_session" || event.key === "currentUser") {
        syncRoute();
      }
    };

    const handleAuthChange = () => syncRoute();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("ts-auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("ts-auth-change", handleAuthChange);
    };
  }, [pathname, router]);

  return null;
}
