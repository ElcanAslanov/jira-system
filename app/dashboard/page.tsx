"use client";

import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardRedirect() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      switch (user.role) {
        case "ADMIN":
          router.replace("/dashboard/admin-dashboard");
          break;
        case "BOSS":
          router.replace("/dashboard/boss-dashboard");
          break;
        case "REHBER":
          router.replace("/dashboard/rehber-dashboard");
          break;
        case "EMPLOYEE":
          router.replace("/dashboard/employee-dashboard");
          break;
        default:
          router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return null;
}