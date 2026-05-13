"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Users,
  Building2,
  CheckSquare,
  Repeat,
  ShieldCheck,
  Settings,
  Languages,
  Plus,
  ListChecks,
  FileClock,
  Home,
  BriefcaseBusiness,
  Network,
  Crown,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthProvider";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

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

type SidebarProps = {
  onClose?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (value: boolean) => void;
  mobile?: boolean;
};

const groupIcons: Record<string, any> = {
  dashboard: LayoutDashboard,
  employees: Users,
  structure: Building2,
  tasks: CheckSquare,
  recurring: Repeat,
  permissions: ShieldCheck,
};

const linkIcons: Record<string, any> = {
  "/dashboard": Home,
  "/dashboard/employees": Users,
  "/dashboard/employees/new": Plus,
  "/dashboard/companies": BriefcaseBusiness,
  "/dashboard/departments": Network,
  "/dashboard/positions": Crown,
  "/dashboard/roles": ShieldCheck,
  "/dashboard/tasks": ListChecks,
  "/dashboard/tasks/new": Plus,
  "/dashboard/tasks/task-log": FileClock,
  "/dashboard/recurring": Repeat,
  "/dashboard/recurring/new": Plus,
  "/dashboard/role-permissions": ShieldCheck,
};

export default function Sidebar({
  onClose,
  collapsed = false,
  onCollapsedChange,
  mobile = false,
}: SidebarProps) {
  const { lang, setLang } = useLang();
  const t = translations[lang];

  const pathname = usePathname();
  const { user } = useAuth();

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [langOpen, setLangOpen] = useState(false);

  const [employeeInfo, setEmployeeInfo] = useState<{
    ad: string;
    soyad: string;
    email?: string | null;
  } | null>(null);

  const compact = collapsed && !mobile;

  const groups: Group[] = useMemo(
    () => [
      {
        title: t.dashboard,
        key: "dashboard",
        links: [
          {
            href: "/dashboard",
            label: t.home,
            permission: "dashboard.view",
          },
        ],
      },
      {
        title: t.employees,
        key: "employees",
        links: [
          {
            href: "/dashboard/employees",
            label: t.employees,
            permission: "employees.view",
          },
          {
            href: "/dashboard/employees/new",
            label: t.newEmployee,
            permission: "employees.create",
          },
        ],
      },
      {
        title: t.structure,
        key: "structure",
        links: [
          {
            href: "/dashboard/companies",
            label: t.companies,
            permission: "companies.view",
          },
          {
            href: "/dashboard/departments",
            label: t.departments,
            permission: "departments.view",
          },
          {
            href: "/dashboard/positions",
            label: t.positions,
            permission: "positions.view",
          },
          {
            href: "/dashboard/roles",
            label: t.roles,
            permission: "roles.view",
          },
        ],
      },
      {
        title: t.tasks,
        key: "tasks",
        links: [
          {
            href: "/dashboard/tasks",
            label: t.tasks,
            permission: "tasks.view",
          },
          {
            href: "/dashboard/tasks/new",
            label: t.newTask,
            permission: "tasks.create",
          },
          {
            href: "/dashboard/tasks/task-log",
            label: "Task Log",
            permission: "tasks.log.view",
          },
        ],
      },
      {
        title: t.recurringTasks,
        key: "recurring",
        links: [
          {
            href: "/dashboard/recurring",
            label: t.recurringTasks,
            permission: "recurring.view",
          },
          {
            href: "/dashboard/recurring/new",
            label: t.newRecurringTask,
            permission: "recurring.create",
          },
        ],
      },
      {
        title: t.permissions,
        key: "permissions",
        links: [
          {
            href: "/dashboard/role-permissions",
            label: t.permissionManagement,
            permission: "role_permissions.view",
          },
        ],
      },
    ],
    [t]
  );

  useEffect(() => {
    if (!user?.id) {
      setPermissions([]);
      return;
    }

    let mounted = true;

    async function loadPermissions() {
      if (!user || permissions.length > 0) return;

      try {
        const { data: employee } = await supabase
          .from("employees")
          .select("ad,soyad,email,role_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!employee || !mounted) return;

        setEmployeeInfo({
          ad: employee.ad,
          soyad: employee.soyad,
          email: employee.email ?? user?.email ?? null,
        });

        const roleId = employee.role_id;

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
              finalPerms = finalPerms.filter((k) => k !== p.permission_key);
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
  }, [user, permissions.length]);

  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => {
        const filteredLinks = group.links.filter(
          (link) => !link.permission || permissions.includes(link.permission)
        );

        if (filteredLinks.length === 0) return null;

        return { ...group, links: filteredLinks };
      })
      .filter(Boolean) as Group[];
  }, [permissions, groups]);

  useEffect(() => {
    const activeGroup = visibleGroups.find((group) =>
      group.links.some((link) => pathname.startsWith(link.href))
    );

    if (activeGroup) {
      setOpenGroup(activeGroup.key);
    }
  }, [pathname, visibleGroups]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleNavigate = () => {
    onClose?.();
  };

  return (
    <aside className="relative flex h-full flex-col overflow-hidden border-r border-white/10 bg-[#111827] text-slate-200 shadow-[18px_0_50px_rgba(15,23,42,0.25)]">
      {/* Soft dark background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[#e42526]/18 blur-3xl" />
        <div className="absolute -right-28 top-1/3 h-56 w-56 rounded-full bg-slate-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.035] via-transparent to-black/10" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-3 pb-3 pt-4">
        <div
          className={[
            "flex items-center gap-2",
            compact ? "justify-center" : "justify-between",
          ].join(" ")}
        >
          {!compact ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e42526] text-white shadow-sm shadow-[#e42526]/20">
                <CircleDot size={18} />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-extrabold tracking-tight text-white">
                  Cahan Flow
                </h2>
                <p className="truncate text-[11px] font-medium text-slate-400">
                  Task workspace
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onCollapsedChange?.(false)}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-200 shadow-sm transition hover:bg-white/[0.1] active:scale-95"
              aria-label="Sidebar aç"
              title="Sidebar aç"
            >
              <Menu size={20} />
            </button>
          )}

          {!compact && (
            <button
              onClick={() => onCollapsedChange?.(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-300 transition hover:bg-white/[0.1] hover:text-white active:scale-95"
              aria-label="Sidebar bağla"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {employeeInfo && !compact && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.055] p-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.09] text-[12px] font-extrabold text-white">
                {employeeInfo.ad?.[0]}
                {employeeInfo.soyad?.[0]}
              </div>

              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-white">
                  {employeeInfo.ad} {employeeInfo.soyad}
                </p>

                {(employeeInfo.email || user?.email) && (
                  <p className="truncate text-[11px] text-slate-400">
                    {employeeInfo.email || user?.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="relative z-10 custom-scrollbar flex-1 overflow-y-auto px-2.5 pb-3">
        <div className="space-y-1">
          {visibleGroups.map((group) => {
            const GroupIcon = groupIcons[group.key] || LayoutDashboard;
            const isOpen = openGroup === group.key;
            const groupActive = group.links.some((link) =>
              pathname.startsWith(link.href)
            );

            return (
              <div key={group.key}>
                <button
                  onClick={() => {
                    if (compact) {
                      onCollapsedChange?.(false);
                      setOpenGroup(group.key);
                      return;
                    }

                    setOpenGroup(isOpen ? null : group.key);
                  }}
                  title={compact ? group.title : undefined}
                  className={[
                    "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200",
                    compact ? "justify-center px-0" : "",
                    groupActive
                      ? "bg-white/[0.1] text-white"
                      : "text-slate-400 hover:bg-white/[0.065] hover:text-white",
                  ].join(" ")}
                >
                  {groupActive && !compact && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#e42526]" />
                  )}

                  <span
                    className={[
                      "grid shrink-0 place-items-center rounded-xl transition",
                      compact ? "h-10 w-10" : "h-8 w-8",
                      groupActive
                        ? "bg-[#e42526] text-white shadow-sm shadow-[#e42526]/20"
                        : "bg-white/[0.075] text-slate-300 group-hover:bg-white/[0.12] group-hover:text-white",
                    ].join(" ")}
                  >
                    <GroupIcon size={compact ? 19 : 17} />
                  </span>

                  {!compact && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {group.title}
                      </span>

                      <ChevronDown
                        size={15}
                        className={[
                          "shrink-0 text-slate-500 transition-transform duration-300",
                          isOpen ? "rotate-180 text-slate-300" : "",
                        ].join(" ")}
                      />
                    </>
                  )}
                </button>

                <div
                  className={[
                    "grid transition-all duration-300 ease-out",
                    isOpen && !compact
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0",
                  ].join(" ")}
                >
                  <div className="overflow-hidden">
                    <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                      {group.links.map((link) => {
                        const LinkIcon = linkIcons[link.href] || ListChecks;
                        const isActive = pathname === link.href;

                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            prefetch={false}
                            onClick={handleNavigate}
                            className={[
                              "relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] font-medium transition-all duration-200",
                              isActive
                                ? "bg-[#e42526] text-white shadow-sm shadow-[#e42526]/20"
                                : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
                            ].join(" ")}
                          >
                            {isActive && (
                              <span className="absolute -left-[17px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#e42526] ring-4 ring-[#111827]" />
                            )}

                            <LinkIcon size={14} />
                            <span className="truncate">{link.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom */}
      <div className="relative z-20 border-t border-white/10 bg-black/10 p-2.5">
        <div className="space-y-1.5">
          {permissions.includes("settings.view") && (
            <Link
              href="/dashboard/settings"
              prefetch={false}
              onClick={handleNavigate}
              title={compact ? t.settings : undefined}
              className={[
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200",
                compact ? "justify-center px-0" : "",
                pathname === "/dashboard/settings"
                  ? "bg-white/[0.1] text-white"
                  : "text-slate-400 hover:bg-white/[0.065] hover:text-white",
              ].join(" ")}
            >
              <span
                className={[
                  "grid shrink-0 place-items-center rounded-xl bg-white/[0.075] text-slate-300",
                  compact ? "h-10 w-10" : "h-8 w-8",
                ].join(" ")}
              >
                <Settings size={compact ? 19 : 17} />
              </span>

              {!compact && <span>{t.settings}</span>}
            </Link>
          )}

          <div className="relative">
            <button
              onClick={() => {
                if (compact) {
                  onCollapsedChange?.(false);
                  setLangOpen(true);
                  return;
                }

                setLangOpen((v) => !v);
              }}
              title={compact ? "Dil" : undefined}
              className={[
                "flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-slate-400 transition hover:bg-white/[0.065] hover:text-white",
                compact ? "justify-center px-0" : "",
              ].join(" ")}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={[
                    "grid shrink-0 place-items-center rounded-xl bg-white/[0.075] text-slate-300",
                    compact ? "h-10 w-10" : "h-8 w-8",
                  ].join(" ")}
                >
                  <Languages size={compact ? 19 : 17} />
                </span>

                {!compact && (
                  <span className="truncate">
                    {lang === "az" && "🇦🇿 Azərbaycan"}
                    {lang === "en" && "ᴇɴ English"}
                    {lang === "tr" && "🇹🇷 Türkçe"}
                    {lang === "ru" && "🇷🇺 Русский"}
                  </span>
                )}
              </span>

              {!compact && (
                <ChevronDown
                  size={15}
                  className={`text-slate-500 transition ${
                    langOpen ? "rotate-180 text-slate-300" : ""
                  }`}
                />
              )}
            </button>

            {langOpen && !compact && (
              <div className="absolute bottom-12 left-0 z-50 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1f2937] p-1 shadow-xl">
                {[
                  ["az", "🇦🇿 Azərbaycan"],
                  ["en", "ᴇɴ English"],
                  ["tr", "🇹🇷 Türkçe"],
                  ["ru", "🇷🇺 Русский"],
                ].map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => {
                      setLang(code as any);
                      setLangOpen(false);
                    }}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition",
                      lang === code
                        ? "bg-[#e42526] text-white"
                        : "text-slate-300 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={logout}
            title={compact ? t.logout : undefined}
            className={[
              "flex w-full items-center justify-center gap-2 rounded-xl bg-[#e42526] px-2.5 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-[#e42526]/20 transition",
              "hover:bg-[#c91f20] active:scale-[0.98]",
              compact ? "h-10 px-0" : "",
            ].join(" ")}
          >
            <LogOut size={compact ? 18 : 16} />
            {!compact && <span>{t.logout}</span>}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.22);
          border-radius: 999px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.36);
        }
      `}</style>
    </aside>
  );
}