"use client";

import Sidebar from "../components/Sidebar";
import NotificationBell from "../components/NotificationBell";
import { useAuth } from "@/context/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    if (!loading) {
      setCheckedAuth(true);
    }
  }, [loading]);

  useEffect(() => {
    if (!checkedAuth) return;

    if (!user) {
      router.replace("/login");
    }
  }, [checkedAuth, user, router]);

  useEffect(() => {
    const handleFocusRefresh = () => {
      router.refresh();
    };

    window.addEventListener("app-focus-refresh", handleFocusRefresh);

    return () => {
      window.removeEventListener("app-focus-refresh", handleFocusRefresh);
    };
  }, [router]);

  /*
    Burada artıq mərkəzdə "Yüklənir..." göstərmirik.
    Çünki səhifələrin öz loading/skeleton hissəsi var.
    Belə olanda refresh zamanı ikiqat loading görünmür.
  */
  if (!checkedAuth) {
  return (
    <div className="min-h-screen bg-[#111827]">
      <div className="min-h-screen bg-[#f7f8fb] lg:pl-[264px]" />
    </div>
  );
}

  if (!user) {
    return <div className="min-h-screen bg-[#f7f8fb]" />;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#111827]">
      {/* DESKTOP SIDEBAR */}
      <div
        className={[
          "fixed left-0 top-0 z-50 hidden h-screen transition-[width] duration-300 ease-out lg:block",
          sidebarCollapsed ? "w-[78px]" : "w-[264px]",
        ].join(" ")}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>

      {/* MOBILE OVERLAY SIDEBAR */}
      <div
        className={[
          "fixed inset-0 z-[80] lg:hidden transition",
          mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <div
          className={[
            "absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-300",
            mobileSidebarOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <div
          className={[
            "absolute left-0 top-0 h-full w-[84vw] max-w-[310px] transition-transform duration-300 ease-out",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <Sidebar
            mobile
            collapsed={false}
            onClose={() => setMobileSidebarOpen(false)}
            onCollapsedChange={() => {}}
          />
        </div>
      </div>

      {/* MOBILE HAMBURGER */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className={[
          "fixed left-4 top-4 z-[60] grid h-11 w-11 place-items-center rounded-2xl",
          "border border-slate-200 bg-white text-slate-800 shadow-sm",
          "transition hover:bg-slate-50 active:scale-95 lg:hidden",
        ].join(" ")}
        aria-label="Menyu aç"
      >
        <Menu size={21} />
      </button>

      {/* NOTIFICATION */}
      <div className="fixed right-4 top-4 z-[60] sm:right-6">
        <NotificationBell />
      </div>

      {/* MAIN CONTENT */}
      <div
        className={[
          "min-h-screen bg-[#f7f8fb] transition-[padding] duration-300 ease-out",
          sidebarCollapsed ? "lg:pl-[78px]" : "lg:pl-[264px]",
        ].join(" ")}
      >
        <main className="min-h-screen px-4 pb-8 pt-20 sm:px-5 lg:px-7 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}