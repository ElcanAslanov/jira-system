"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import { supabase } from "@/lib/supabaseClient";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  PieChart as PieChartIcon,
  Sparkles,
  Target,
  TimerReset,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";

const STATUS_COLORS = ["#64748b", "#3b82f6", "#22c55e", "#ef4444"];
const PRIORITY_COLOR = "#6366f1";
const OVERDUE_COLOR = "#ef4444";
const PRODUCTIVITY_COLOR = "#22c55e";

export default function DashboardPage() {
  const { lang } = useLang();

  const t =
    translations[lang as keyof typeof translations] ??
    translations.az;

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        let session = null;

        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession();
          session = data.session;

          if (session) break;

          await new Promise((r) => setTimeout(r, 50));
        }

        const token = session?.access_token;

        if (!token) {
          if (alive) {
            setError("Session not ready");
            setLoading(false);
          }
          return;
        }

        const res = await fetch(`/api/dashboard?t=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Dashboard API error");
        }

        const json = await res.json();

        if (alive) {
          setStats(json);
        }
      } catch (e: any) {
        console.error(e);

        if (alive) {
          setError(e.message);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const statusData = useMemo(
    () => [
      { name: t.todo, value: stats?.todo ?? 0 },
      { name: t.inProgress, value: stats?.progress ?? 0 },
      { name: t.taskDone, value: stats?.done ?? 0 },
      { name: t.cancelled, value: stats?.cancelled ?? 0 },
    ],
    [stats, t]
  );

  const priorityData = useMemo(
    () => [
      { name: t.low, value: stats?.priorityStats?.LOW ?? 0 },
      { name: t.medium, value: stats?.priorityStats?.MEDIUM ?? 0 },
      { name: t.high, value: stats?.priorityStats?.HIGH ?? 0 },
      { name: t.urgent, value: stats?.priorityStats?.URGENT ?? 0 },
    ],
    [stats, t]
  );

  if (loading) {
    return <DashboardSkeleton label={t.loading} />;
  }

  if (error) {
    return (
      <div className="min-h-screen rounded-[28px] border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="max-w-md rounded-[28px] border border-red-100 bg-red-50 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-red-100 text-red-600">
              <AlertTriangle size={26} />
            </div>

            <h2 className="mt-4 text-lg font-black text-slate-950">
              Dashboard yüklənmədi
            </h2>

            <p className="mt-2 text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">{t.notFound}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
        <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
              <Sparkles size={14} />
              Task Flow Analytics
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {t.dashboard}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Tapşırıqların statusu, prioritet bölgüsü və komanda performansı
              üzrə ümumi baxış.
            </p>
          </div>

          
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          title={t.assignedToMe}
          value={stats?.assignedToMe ?? 0}
          icon={UserCheck}
          tone="indigo"
        />
        <KpiCard
          title={t.createdByMe}
          value={stats?.createdByMe ?? 0}
          icon={UserPlus}
          tone="purple"
        />
        <KpiCard
          title={t.todo}
          value={stats?.todo ?? 0}
          icon={Clock3}
          tone="blue"
        />
        <KpiCard
          title={t.inProgress}
          value={stats?.progress ?? 0}
          icon={Target}
          tone="amber"
        />
        <KpiCard
          title={t.taskDone}
          value={stats?.done ?? 0}
          icon={CheckCircle2}
          tone="green"
        />
        <KpiCard
          title={t.cancelled}
          value={stats?.cancelled ?? 0}
          icon={XCircle}
          tone="rose"
        />
        <KpiCard
          title={t.overdue}
          value={stats?.overdue ?? 0}
          icon={AlertTriangle}
          tone="red"
        />
      </section>

      {/* Charts row 1 */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.tasksByStatus}
          subtitle="Tapşırıqların statuslara görə bölgüsü"
          icon={PieChartIcon}
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_180px] lg:items-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={92}
                  innerRadius={54}
                  paddingAngle={4}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip content={<ModernTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <LegendList data={statusData} colors={STATUS_COLORS} />
          </div>
        </ChartCard>

        <ChartCard
          title={t.tasksByPriority}
          subtitle="Prioritet səviyyələrinə görə tapşırıqlar"
          icon={BarChart3}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={priorityData} barSize={38}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ModernTooltip />} />
              <Bar
                dataKey="value"
                fill={PRIORITY_COLOR}
                radius={[12, 12, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Charts row 2 */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.mostOverdueEmployees}
          subtitle="Ən çox gecikmiş tapşırığı olan əməkdaşlar"
          icon={AlertTriangle}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats?.overdueUsers ?? []} barSize={34}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ModernTooltip />} />
              <Bar
                dataKey="count"
                fill={OVERDUE_COLOR}
                radius={[12, 12, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t.employeeProductivity}
          subtitle="Tamamlanmış tapşırıqlara görə məhsuldarlıq"
          icon={CheckCircle2}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats?.productivity ?? []} barSize={34}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ModernTooltip />} />
              <Bar
                dataKey="done"
                fill={PRODUCTIVITY_COLOR}
                radius={[12, 12, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
}

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#e42526]" />
          <p className="text-sm font-bold text-slate-600">{label}</p>
        </div>

        <div className="mt-6 h-8 w-64 animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-xl bg-slate-100" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-[24px] border border-slate-200 bg-white shadow-sm"
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[360px] animate-pulse rounded-[28px] border border-slate-200 bg-white shadow-sm"
          />
        ))}
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: any;
  danger?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <div
          className={[
            "grid h-8 w-8 place-items-center rounded-2xl",
            danger
              ? "bg-red-100 text-red-600"
              : "bg-[#fff1f1] text-[#e42526]",
          ].join(" ")}
        >
          <Icon size={16} />
        </div>
      </div>

      <p
        className={[
          "mt-2 text-2xl font-black",
          danger ? "text-red-600" : "text-slate-950",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: any;
  tone: "indigo" | "purple" | "blue" | "amber" | "green" | "rose" | "red";
}) {
  const styles: Record<
    string,
    {
      card: string;
      icon: string;
      value: string;
    }
  > = {
    indigo: {
      card: "from-indigo-50 to-white",
      icon: "bg-indigo-100 text-indigo-600",
      value: "text-indigo-700",
    },
    purple: {
      card: "from-purple-50 to-white",
      icon: "bg-purple-100 text-purple-600",
      value: "text-purple-700",
    },
    blue: {
      card: "from-blue-50 to-white",
      icon: "bg-blue-100 text-blue-600",
      value: "text-blue-700",
    },
    amber: {
      card: "from-amber-50 to-white",
      icon: "bg-amber-100 text-amber-600",
      value: "text-amber-700",
    },
    green: {
      card: "from-emerald-50 to-white",
      icon: "bg-emerald-100 text-emerald-600",
      value: "text-emerald-700",
    },
    rose: {
      card: "from-rose-50 to-white",
      icon: "bg-rose-100 text-rose-600",
      value: "text-rose-700",
    },
    red: {
      card: "from-red-50 to-white",
      icon: "bg-red-100 text-red-600",
      value: "text-red-700",
    },
  };

  const s = styles[tone];

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br p-4 shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-md",
        s.card,
      ].join(" ")}
    >
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/70 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-[34px] text-[12px] font-black leading-4 text-slate-500">
            {title}
          </p>

          <p className={`mt-3 text-3xl font-black tracking-tight ${s.value}`}>
            {value}
          </p>
        </div>

        <div
          className={[
            "grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105",
            s.icon,
          ].join(" ")}
        >
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-xs font-medium text-slate-400">{subtitle}</p>
        </div>

        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon size={19} />
        </div>
      </div>

      {children}
    </div>
  );
}

function LegendList({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: string[];
}) {
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div
          key={item.name}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors[index] }}
            />
            <span className="truncate text-xs font-bold text-slate-600">
              {item.name}
            </span>
          </div>

          <span className="text-sm font-black text-slate-950">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ModernTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
      {label && (
        <p className="mb-1 text-xs font-bold text-slate-400">{label}</p>
      )}

      {payload.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color || item.fill }}
          />
          <span className="text-xs font-bold text-slate-700">
            {item.name}: {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}