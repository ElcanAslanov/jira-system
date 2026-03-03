"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";

type SubLink = {
  href: string;
  label: string;
  permission?: string;
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

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [employeeInfo, setEmployeeInfo] = useState<{
    ad: string;
    soyad: string;
    email?: string | null;
  } | null>(null);

  /* =============================
     FULL MENU STRUCTURE
  ==============================*/

  const groups: Group[] = [
        {
      title: "İşçilər",
      key: "employees",
      links: [
        {
          href: "/dashboard/employees",
          label: "İşçilər",
          permission: "employees.view",
        },
        {
          href: "/dashboard/employees/new",
          label: "Yeni İşçi",
          permission: "employees.create",
        },
      ],
    },
    {
      title: "Struktur",
      key: "structure",
      links: [
        {
          href: "/dashboard/companies",
          label: "Şirkətlər",
          permission: "companies.view",
        },
        {
          href: "/dashboard/departments",
          label: "Departamentlər",
          permission: "departments.view",
        },
        {
          href: "/dashboard/positions",
          label: "Vəzifələr",
          permission: "positions.view",
        },
        {
          href: "/dashboard/roles",
          label: "Rollar",
          permission: "roles.view",
        },
      ],
    },
    {
      title: "Tapşırıqlar",
      key: "tasks",
      links: [
        {
          href: "/dashboard/tasks",
          label: "Tapşırıqlar",
          permission: "tasks.view",
        },
        {
          href: "/dashboard/tasks/new",
          label: "Yeni Tapşırıq",
          permission: "tasks.create",
        },
      ],
    },
    {
      title: "Dövrlü Tapşırıqlar",
      key: "recurring",
      links: [
        {
          href: "/dashboard/recurring",
          label: "Dövrlü Tasklar",
          permission: "recurring.view",
        },
        {
          href: "/dashboard/recurring/new",
          label: "Yeni Dövrlü Task",
          permission: "recurring.create",
        },
      ],
    },
    {
      title: "Yetkilər",
      key: "permissions",
      links: [
        {
          href: "/dashboard/role-permissions",
          label: "Yetki İdarəsi",
          permission: "role_permissions.view",
        },
      ],
    },
  ];

  /* =============================
     LOAD PERMISSIONS + EMPLOYEE
  ==============================*/

useEffect(() => {
  if (!user?.id) return;

  let mounted = true;

  async function loadPermissions() {
    try {
      // 🚀 EMPLOYEE-ni tez yüklə
      const { data: employee } = await supabase
        .from("employees")
        .select("ad,soyad,email,role_id")
        .eq("user_id", user.id)
        .single();

      if (!employee?.role_id || !mounted) return;

      setEmployeeInfo({
        ad: employee.ad,
        soyad: employee.soyad,
        email: employee.email ?? user?.email ?? null,
      });

      const roleId = employee.role_id;

      // 🚀 Paralel permission query
      const [rolePermRes, userPermRes] = await Promise.all([
        supabase
          .from("role_permissions")
          .select("permission_key")
          .eq("role_id", roleId),

        supabase
          .from("user_permissions")
          .select("permission_key,allowed")
          .eq("user_id", user.id),
      ]);

      let finalPerms =
        rolePermRes.data?.map((x: any) => x.permission_key) || [];

      const userPerms = userPermRes.data;

      if (userPerms) {
        userPerms.forEach((p: any) => {
          if (p.allowed === true) {
            if (!finalPerms.includes(p.permission_key)) {
              finalPerms.push(p.permission_key);
            }
          }
          if (p.allowed === false) {
            finalPerms = finalPerms.filter(
              (k) => k !== p.permission_key
            );
          }
        });
      }

      if (mounted) {
        setPermissions(finalPerms);
      }

    } catch (err) {
      console.error("Sidebar load error:", err);
    }
  }

  loadPermissions();

  return () => {
    mounted = false;
  };
}, [user?.id]);

  /* =============================
     FILTER GROUPS
  ==============================*/
const visibleGroups = useMemo(() => {
  return groups
    .map((group) => {
      if (group.key === "dashboards") {
        return group;
      }

      const filteredLinks = group.links.filter(
        (link) =>
          !link.permission ||
          permissions.includes(link.permission)
      );

      if (filteredLinks.length === 0) return null;

      return { ...group, links: filteredLinks };
    })
    .filter(Boolean) as Group[];
}, [permissions]);

  /* =============================
     AUTO OPEN ACTIVE GROUP
  ==============================*/

  useEffect(() => {
    const activeGroup = visibleGroups.find((group) =>
      group.links.some((link) =>
        pathname.startsWith(link.href)
      )
    );

    if (activeGroup) {
      setOpenGroup(activeGroup.key);
    }
  }, [pathname, visibleGroups]);

  const logout = async () => {
  try {
    await supabase.auth.signOut();

    // 🔥 bütün state reset üçün tam reload
    window.location.href = "/login";
  } catch (err) {
    console.error("Logout error:", err);
  }
};

  return (
    <aside className="fixed top-0 left-0 w-64 h-screen bg-gradient-to-b from-[#0f172a] to-[#111827] text-white flex flex-col shadow-xl">
      <div className="px-6 py-6 border-b border-white/10">
        <h2 className="text-xl font-bold tracking-wide">
          Task Flow
        </h2>

        {employeeInfo && (
          <div className="mt-3">
            <div className="text-sm font-semibold text-white">
              {employeeInfo.ad} {employeeInfo.soyad}
            </div>
            {(employeeInfo.email || user?.email) && (
              <div className="text-xs text-gray-400">
                {employeeInfo.email || user?.email}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.key}>
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
                  openGroup === group.key
                    ? "rotate-180"
                    : ""
                }`}
              />
            </button>

            {openGroup === group.key && (
              <div className="mt-2 ml-4 space-y-1">
                {group.links.map((link) => {
                  const isActive =
                    pathname === link.href;

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

      <div className="px-6 py-4 border-t border-white/10 space-y-3">
        {permissions.includes("settings.view") && (
          <Link
            href="/dashboard/settings"
            className={`block w-full text-center py-2.5 rounded-xl text-sm transition ${
              pathname === "/dashboard/settings"
                ? "bg-[#e42526]/20 text-white"
                : "bg-white/5 hover:bg-white/10 text-gray-300"
            }`}
          >
            Parametrlər
          </Link>
        )}

        <button
          onClick={logout}
          className="w-full bg-[#e42526] hover:bg-[#c81f20] py-2.5 rounded-xl text-sm transition"
        >
          Çıxış
        </button>
      </div>
    </aside>
  );
}