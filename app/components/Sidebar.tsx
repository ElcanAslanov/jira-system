"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Menu,
  X,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";

type SubLink = {
  href: string;
  label: string;
};

type Group = {
  title: string;
  key: string;
  links: SubLink[];
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  // const [isOpen, setIsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const groups: Group[] = [
    {
      title: "İşçilər",
      key: "employees",
      links: [
        { href: "/dashboard/employees", label: "İşçilər" },
        { href: "/dashboard/employees/new", label: "Yeni İşçi" },
      ],
    },
    {
      title: "Struktur",
      key: "structure",
      links: [
        { href: "/dashboard/companies", label: "Şirkətlər" },
        { href: "/dashboard/departments", label: "Departamentlər" },
        { href: "/dashboard/positions", label: "Vəzifələr" },
        { href: "/dashboard/roles", label: "Rollar" },
      ],
    },
    {
      title: "Tapşırıqlar",
      key: "tasks",
      links: [
        { href: "/dashboard/tasks", label: "Tapşırıqlar" },
        { href: "/dashboard/tasks/new", label: "Yeni Tapşırıq" },
      ],
    },
  ];

  // Aktiv route görə parent açıq qalsın
  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.links.some((link) => pathname.startsWith(link.href))
    );
    if (activeGroup) {
      setOpenGroup(activeGroup.key);
    }
  }, [pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Mobile Top */}
      {/* <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0f172a] text-white">
        <h2 className="text-lg font-bold">Jira System</h2>
        <button onClick={() => setIsOpen(true)}>
          <Menu size={24} />
        </button>
      </div> */}

      {/* {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )} */}

      <aside
  className="
    w-64 h-screen
    bg-gradient-to-b from-[#0f172a] to-[#111827]
    text-white
    flex flex-col
    shadow-xl
  "
>
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <h2 className="text-xl font-bold tracking-wide">
            Task Flow
          </h2>
          {/* <p className="text-xs text-gray-400 mt-1">
            Task Management
          </p> */}
        </div>

        {/* Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

          {/* Dashboard (Single Parent) */}
          <Link
            href="/dashboard"
            className={`block px-4 py-2.5 rounded-xl text-sm transition ${
              pathname === "/dashboard"
                ? "bg-[#e42526]/20 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            Dashboard
          </Link>

          {/* Groups */}
          {groups.map((group) => (
            <div key={group.key}>

              {/* Parent */}
              <button
                onClick={() =>
                  setOpenGroup(
                    openGroup === group.key ? null : group.key
                  )
                }
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-white/5 transition"
              >
                {group.title}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
                    openGroup === group.key ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Children */}
              {openGroup === group.key && (
                <div className="mt-2 ml-4 space-y-1">
                  {group.links.map((link) => {
                    const isActive = pathname === link.href;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-4 py-2 rounded-lg text-sm transition ${
                          isActive
                            ? "bg-[#e42526]/20 text-white"
                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="px-6 py-4 border-t border-white/10 space-y-4">

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#e42526] flex items-center justify-center text-sm font-bold">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">
                {user?.email || "User"}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard/settings")}
            className="w-full bg-white/5 hover:bg-white/10 py-2.5 rounded-xl text-sm transition"
          >
            Parametrlər
          </button>

          <button
            onClick={logout}
            className="w-full bg-[#e42526] hover:bg-[#c81f20] py-2.5 rounded-xl text-sm transition"
          >
            Çıxış
          </button>
        </div>
      </aside>
    </>
  );
}