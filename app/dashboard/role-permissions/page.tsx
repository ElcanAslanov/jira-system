"use client";

import { useState } from "react";
import RolePermissionsPage from "./RolePermissionsPage";
import UserPermissionsPage from "./UserPermissionsPage";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import {
  Building2,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  UserCog,
  UsersRound,
} from "lucide-react";

type Mode = "role" | "user";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function RolePermissionHub() {
  const [mode, setMode] = useState<Mode>("role");

  const { lang } = useLang();
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-8">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-5 lg:p-7">
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
          <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
                <LockKeyhole size={14} />
                Access Control
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {t.permissionManagement}
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                {t.permissionManagementDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[430px]">
              <MiniStat
                icon={ShieldCheck}
                label={t.permissions}
                value="Role"
                tone="dark"
              />
              <MiniStat
                icon={Building2}
                label={t.companyPermissions}
                value="Company"
                tone="blue"
              />
              <MiniStat
                icon={UsersRound}
                label={t.guidePermissions}
                value="Guide"
                tone="purple"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <HubTab
              active={mode === "role"}
              icon={ShieldCheck}
              title={t.rolePermissions}
              desc="Rol üzrə menyu, düymə, şirkət və rəhbər icazələrini idarə et."
              onClick={() => setMode("role")}
            />

            <HubTab
              active={mode === "user"}
              icon={UserCog}
              title={t.userPermissions}
              desc="User üçün role icazələrinə əlavə və istisna override-lar ver."
              onClick={() => setMode("user")}
            />
          </div>
        </section>

        <section className="animate-fadeIn">
          {mode === "role" ? <RolePermissionsPage /> : <UserPermissionsPage />}
        </section>
      </div>
    </div>
  );
}

function HubTab({
  active,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: any;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-[24px] border p-4 text-left transition active:scale-[0.99]",
        active
          ? "border-[#e42526] bg-[#fff6f6] shadow-sm shadow-[#e42526]/10"
          : "border-slate-200 bg-slate-50 hover:bg-white"
      )}
    >
      <div
        className={cn(
          "absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition",
          active ? "bg-[#e42526]/15" : "bg-slate-300/20"
        )}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition",
              active
                ? "bg-[#e42526] text-white"
                : "bg-white text-slate-500 shadow-sm group-hover:text-[#e42526]"
            )}
          >
            <Icon size={21} />
          </div>

          <div className="min-w-0">
            <div
              className={cn(
                "text-base font-black",
                active ? "text-slate-950" : "text-slate-800"
              )}
            >
              {title}
            </div>

            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              {desc}
            </p>
          </div>
        </div>

        {active && (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e42526] text-white">
            <CheckCircle2 size={16} />
          </div>
        )}
      </div>
    </button>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: "dark" | "blue" | "purple";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "purple"
        ? "bg-violet-50 text-violet-700"
        : "bg-slate-950 text-white";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2">
        <div className={cn("grid h-9 w-9 place-items-center rounded-xl", toneClass)}>
          <Icon size={16} />
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-950">
            {value}
          </div>
          <div className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}