"use client";

import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

export function PriorityPill({ p }: { p: string }) {
  const { lang } = useLang();
  const t = translations[lang];

  const map: Record<string, string> = {
    LOW: "bg-slate-50 text-slate-700 border-slate-200",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
    HIGH: "bg-amber-50 text-amber-800 border-amber-200",
    URGENT: "bg-red-50 text-red-700 border-red-200",
  };

  const labels: Record<string, string> = {
    LOW: t.low,
    MEDIUM: t.medium,
    HIGH: t.high,
    URGENT: t.urgent,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${map[p] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}
    >
      {labels[p] ?? p}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { lang } = useLang();
  const t = translations[lang];

  const map: Record<string, string> = {
    TODO: "bg-slate-100 text-slate-700 border-slate-200",
    IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
    DONE: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-red-100 text-red-700 border-red-200",
  };

  const labels: Record<string, string> = {
    TODO: t.todo,
    IN_PROGRESS: t.inProgress,
    DONE: t.taskDone,
    CANCELLED: t.cancelled,
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${map[status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}