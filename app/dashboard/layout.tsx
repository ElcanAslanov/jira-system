"use client";

import Sidebar from "../components/Sidebar";
import NotificationBell from "../components/NotificationBell";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
<div className="h-screen flex bg-gray-100">      
      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* MOBILE SIDEBAR */}
      <div className="fixed inset-0 z-50 lg:hidden pointer-events-none">
        
        {/* Overlay */}
        <div
          onClick={() => setSidebarOpen(false)}
          className={`
            absolute inset-0 bg-black/40
            transition-opacity duration-300
            ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0"}
          `}
        />

        {/* Sidebar Panel */}
        <div
          className={`
            absolute left-0 top-0 w-72 h-full bg-slate-900 shadow-xl
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            pointer-events-auto
          `}
        >
          <Sidebar />
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">

        {/* MOBILE MENU BUTTON */}
        <button
          className="lg:hidden absolute top-4 left-4 text-2xl z-40"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>

        {/* NOTIFICATION (top-right, no navbar) */}
        <div className="absolute top-4 right-6 z-40">
          <NotificationBell />
        </div>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

      </div>
    </div>
  );
}