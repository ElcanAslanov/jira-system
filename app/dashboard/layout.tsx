"use client";

import Sidebar from "../components/Sidebar";
import NotificationBell from "../components/NotificationBell";
import {useAuth} from "@/context/AuthProvider"
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 🔥 auth check flag (loop-un qarşısını alır)
  const [checkedAuth, setCheckedAuth] = useState(false);

  // loading bitəndə işə düşür
  useEffect(() => {
    if (!loading) {
      setCheckedAuth(true);
    }
  }, [loading]);

  // 🔥 redirect logic (loop FIX)
  useEffect(() => {
    if (!checkedAuth) return;

    if (!user) {
      router.replace("/login");
    }
  }, [checkedAuth, user, router]);

  // 🔥 optional refresh listener (səndə var idi)
  useEffect(() => {
    const handleFocusRefresh = () => {
      router.refresh();
    };

    window.addEventListener("app-focus-refresh", handleFocusRefresh);

    return () => {
      window.removeEventListener("app-focus-refresh", handleFocusRefresh);
    };
  }, [router]);

  // 🔥 LOADING UI
  if (!checkedAuth) {
    return <div className="p-10">Yüklənir...</div>;
  }

  // 🔥 redirect gedəndə boş qalmasın
  if (!user) {
    return <div className="p-10">Redirect olunur...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:block fixed top-0 left-0 h-screen w-64 z-40">
        <Sidebar onClose={sidebarOpen ? () => setSidebarOpen(false) : undefined} />
      </div>

      {/* MOBILE SIDEBAR */}
     <div
  className={`fixed inset-0 z-50 lg:hidden transition ${
    sidebarOpen ? "pointer-events-auto" : "pointer-events-none"
  }`}
>
  <div
    className={`absolute inset-0 bg-black/40 transition-opacity ${
      sidebarOpen ? "opacity-100" : "opacity-0"
    }`}
    onClick={() => setSidebarOpen(false)}
  />

  <div
    className={`absolute top-0 left-0 h-screen w-72 bg-slate-900 shadow-xl transform transition-transform ${
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    }`}
  >
    <Sidebar onClose={() => setSidebarOpen(false)} />
  </div>
</div>

      {/* MAIN CONTENT */}
      <div className="flex flex-col min-h-screen lg:ml-64">

        {/* MOBILE MENU BUTTON */}
        <button
          className="lg:hidden fixed top-4 left-4 z-40 text-2xl"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>

        {/* NOTIFICATION */}
        <div className="fixed top-4 right-6 z-40">
          <NotificationBell />
        </div>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-6">
          {children}
        </main>

      </div>
    </div>
  );
}