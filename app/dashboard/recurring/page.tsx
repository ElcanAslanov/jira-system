"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthProvider";
import { useRouter } from "next/navigation";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Loader2,
  PauseCircle,
  Paperclip,
  PlayCircle,
  RefreshCcw,
  Repeat2,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

type Rule = {
  id: string;
  title: string;
  description: string | null;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  week_days: number[] | null;
  start_date: string;
  end_date: string;
  next_run_date: string;
  is_active: boolean;
  assigned_to: string[] | null;
  files: any[] | null;
  created_at: string;
};

type Employee = {
  id: string;
  ad: string;
  soyad: string;
};

type Msg = {
  type: "ok" | "err";
  text: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDMY(date: string | null) {
  if (!date) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  const d = String(parsed.getDate()).padStart(2, "0");
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const y = parsed.getFullYear();

  return `${d}/${m}/${y}`;
}

function translateFrequency(freq: string, t: any) {
  if (freq === "DAILY") return t.daily;
  if (freq === "WEEKLY") return t.weekly;
  if (freq === "MONTHLY") return t.monthly;
  return freq;
}

function getEmployeeName(emp?: Employee) {
  if (!emp) return "";
  return `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim();
}

export default function RecurringPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const { user, loading } = useAuth();
  const router = useRouter();

  const [viewRule, setViewRule] = useState<Rule | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [confirmRule, setConfirmRule] = useState<Rule | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PAUSED">(
    "ALL"
  );
  const [msg, setMsg] = useState<Msg | null>(null);

  const can = (key: string) => permissions.includes(key);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  useEffect(() => {
    if (!user?.id) return;

    async function loadPermissions() {
      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", (user as any)?.role_id);

      const { data: userPerms } = await supabase
        .from("user_permissions")
        .select("permission_key, allowed")
        .eq("user_id", user.id);

      let finalPerms = rolePerms?.map((p: any) => p.permission_key) || [];

      if (userPerms) {
        userPerms.forEach((p: any) => {
          if (p.allowed === true && !finalPerms.includes(p.permission_key)) {
            finalPerms.push(p.permission_key);
          }

          if (p.allowed === false) {
            finalPerms = finalPerms.filter((k) => k !== p.permission_key);
          }
        });
      }

      setPermissions(finalPerms);
    }

    loadPermissions();
  }, [user]);

  const employeesById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const emp of employees) map.set(emp.id, emp);
    return map;
  }, [employees]);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rules.filter((rule) => {
      if (statusFilter === "ACTIVE" && !rule.is_active) return false;
      if (statusFilter === "PAUSED" && rule.is_active) return false;

      if (!q) return true;

      const assignedNames =
        rule.assigned_to
          ?.map((id) => getEmployeeName(employeesById.get(id)))
          .join(" ") ?? "";

      const haystack = [
        rule.title,
        rule.description,
        rule.frequency,
        assignedNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [employeesById, query, rules, statusFilter]);

  const activeCount = useMemo(
    () => rules.filter((rule) => rule.is_active).length,
    [rules]
  );

  const pausedCount = useMemo(
    () => rules.filter((rule) => !rule.is_active).length,
    [rules]
  );

  async function loadData() {
    setLoadingData(true);
    setMsg(null);

    try {
      const [
        { data: rulesData, error: rulesError },
        { data: empData, error: empError },
      ] = await Promise.all([
        supabase
          .from("recurring_rules")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase.from("employees").select("id, ad, soyad"),
      ]);

      if (rulesError) throw rulesError;
      if (empError) throw empError;

      setRules(rulesData || []);
      setEmployees(empData || []);
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Məlumat yüklənmədi" });
    } finally {
      setLoadingData(false);
    }
  }

  async function toggleActive(rule: Rule) {
    setActionId(rule.id);
    setMsg(null);

    const prev = rules;

    setRules((current) =>
      current.map((item) =>
        item.id === rule.id ? { ...item, is_active: !item.is_active } : item
      )
    );

    try {
      const { error } = await supabase
        .from("recurring_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);

      if (error) throw error;

      setMsg({
        type: "ok",
        text: !rule.is_active ? "Qayda aktiv edildi" : "Qayda dayandırıldı",
      });
    } catch (e: any) {
      setRules(prev);
      setMsg({ type: "err", text: e?.message || "Əməliyyat alınmadı" });
    } finally {
      setActionId(null);
    }
  }

  function askDeleteRule(rule: Rule) {
    setConfirmRule(rule);
    setTimeout(() => setConfirmOpen(true), 10);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setTimeout(() => setConfirmRule(null), 220);
  }

  async function deleteRule(rule: Rule) {
    setActionId(rule.id);
    setMsg(null);

    const prev = rules;
    setRules((current) => current.filter((item) => item.id !== rule.id));

    try {
      const { error } = await supabase
        .from("recurring_rules")
        .delete()
        .eq("id", rule.id);

      if (error) throw error;

      setMsg({ type: "ok", text: "Dövrlü tapşırıq silindi" });
      closeConfirm();
    } catch (e: any) {
      setRules(prev);
      setMsg({ type: "err", text: e?.message || "Silinmədi" });
    } finally {
      setActionId(null);
    }
  }

  function openDrawer(rule: Rule) {
    setViewRule(rule);
    setTimeout(() => setDrawerOpen(true), 10);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setViewRule(null), 240);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f7f8fb]">
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-5 lg:p-7">
          <div className="h-36 animate-pulse rounded-[30px] border border-slate-200 bg-white" />
          <div className="h-[520px] animate-pulse rounded-[30px] border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-8">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-5 lg:p-7">
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
          <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
                <Repeat2 size={14} />
                Task Flow
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {t.recurringTasks}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Gündəlik, həftəlik və aylıq təkrarlanan tapşırıq qaydalarını
                idarə edin.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center">
              <StatCard label="Cəmi" value={rules.length} tone="dark" />
              <StatCard label={t.active} value={activeCount} tone="green" />
              <StatCard label={t.paused} value={pausedCount} tone="gray" />
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Başlıq, təsvir və ya icraçı üzrə axtar..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <SegmentButton
                active={statusFilter === "ALL"}
                onClick={() => setStatusFilter("ALL")}
              >
                Hamısı
              </SegmentButton>

              <SegmentButton
                active={statusFilter === "ACTIVE"}
                onClick={() => setStatusFilter("ACTIVE")}
              >
                {t.active}
              </SegmentButton>

              <SegmentButton
                active={statusFilter === "PAUSED"}
                onClick={() => setStatusFilter("PAUSED")}
              >
                {t.paused}
              </SegmentButton>

              <button
                type="button"
                onClick={loadData}
                disabled={loadingData}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
              >
                {loadingData ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <RefreshCcw size={17} />
                )}
                Yenilə
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/recurring/new")}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#e42526] px-4 text-sm font-black text-white shadow-sm shadow-[#e42526]/20 transition hover:bg-[#c91f20] active:scale-[0.98]"
              >
                <Sparkles size={17} />
                Yeni
              </button>
            </div>
          </div>

          {msg && (
            <div className="mt-4">
              <AlertBox
                type={msg.type}
                text={msg.text}
                onClose={() => setMsg(null)}
              />
            </div>
          )}
        </section>

        {loadingData ? (
          <RecurringSkeleton />
        ) : filteredRules.length === 0 ? (
          <EmptyState hasQuery={!!query.trim() || statusFilter !== "ALL"} />
        ) : (
          <>
            <section className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm lg:block">
              <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-base font-black text-slate-950">
                    {t.recurringTasks}
                  </div>
                  <div className="text-sm font-bold text-slate-500">
                    {filteredRules.length} nəticə
                  </div>
                </div>
              </div>

              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full min-w-[980px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[10%]" />
                  </colgroup>

                  <thead className="bg-slate-100">
                    <tr>
                      <Th>{t.name}</Th>
                      <Th>{t.start}</Th>
                      <Th>{t.end}</Th>
                      <Th>{t.nextRun}</Th>
                      <Th>{t.assignedTo}</Th>
                      <Th align="right">{t.actions}</Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredRules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        t={t}
                        employeesById={employeesById}
                        can={can}
                        actionId={actionId}
                        onView={() => openDrawer(rule)}
                        onToggle={() => toggleActive(rule)}
                        onDelete={() => askDeleteRule(rule)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 lg:hidden">
              {filteredRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  t={t}
                  employeesById={employeesById}
                  can={can}
                  actionId={actionId}
                  onView={() => openDrawer(rule)}
                  onToggle={() => toggleActive(rule)}
                  onDelete={() => askDeleteRule(rule)}
                />
              ))}
            </section>
          </>
        )}
      </div>

      {mounted &&
        viewRule &&
        createPortal(
          <RecurringDrawer
            rule={viewRule}
            open={drawerOpen}
            t={t}
            employeesById={employeesById}
            onClose={closeDrawer}
          />,
          document.body
        )}

      {mounted &&
        confirmRule &&
        createPortal(
          <ConfirmDeleteModal
            open={confirmOpen}
            rule={confirmRule}
            loading={actionId === confirmRule.id}
            onClose={closeConfirm}
            onConfirm={() => deleteRule(confirmRule)}
          />,
          document.body
        )}
    </div>
  );
}

function RuleRow({
  rule,
  t,
  employeesById,
  can,
  actionId,
  onView,
  onToggle,
  onDelete,
}: {
  rule: Rule;
  t: any;
  employeesById: Map<string, Employee>;
  can: (key: string) => boolean;
  actionId: string | null;
  onView: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="transition hover:bg-[#fff8f8]">
      <td className="px-4 py-3 align-top">
        <div className="min-w-0">
          <div className="truncate font-black text-slate-950" title={rule.title}>
            {rule.title}
          </div>
          {rule.description ? (
            <div
              className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-400"
              title={rule.description}
            >
              {rule.description}
            </div>
          ) : (
            <div className="mt-1 text-xs font-medium text-slate-300">-</div>
          )}
        </div>
      </td>

      {/* <td className="px-4 py-3 align-top">
        <FrequencyPill freq={rule.frequency} t={t} />
      </td>

      <td className="px-4 py-3 align-top font-black text-slate-700">
        {rule.interval}
      </td>

      <td className="px-4 py-3 align-top">
        <WeekDaysPills
          weekDays={rule.week_days}
          t={t}
          frequency={rule.frequency}
        />
      </td> */}

      <td className="px-4 py-3 align-top text-slate-600">
        {formatDMY(rule.start_date)}
      </td>

      <td className="px-4 py-3 align-top text-slate-600">
        {formatDMY(rule.end_date)}
      </td>

      <td className="px-4 py-3 align-top text-slate-600">
        {formatDMY(rule.next_run_date)}
      </td>

      <td className="px-4 py-3 align-top">
        <AssignedPills ids={rule.assigned_to} employeesById={employeesById} />
      </td>

      {/* <td className="px-4 py-3 align-top">
        {rule.files?.length ? (
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
          >
            <Paperclip size={13} />
            {rule.files.length}
          </button>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <StatusPill active={rule.is_active} t={t} />
      </td> */}

      <td className="px-4 py-3 align-top text-right">
        <div className="flex justify-end gap-2 whitespace-nowrap">
          {can("recurring.view.button") && (
            <SmallIconButton onClick={onView} icon={Eye} label={t.view} />
          )}

          {can("recurring.pause.button") && (
            <SmallIconButton
              onClick={onToggle}
              icon={rule.is_active ? PauseCircle : PlayCircle}
              label={rule.is_active ? t.pause : t.resume}
              loading={actionId === rule.id}
            />
          )}

          {can("recurring.delete.button") && (
            <SmallIconButton
              onClick={onDelete}
              icon={Trash2}
              label={t.delete}
              tone="red"
              loading={actionId === rule.id}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function RuleCard({
  rule,
  t,
  employeesById,
  can,
  actionId,
  onView,
  onToggle,
  onDelete,
}: {
  rule: Rule;
  t: any;
  employeesById: Map<string, Employee>;
  can: (key: string) => boolean;
  actionId: string | null;
  onView: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-base font-black text-slate-950">
            {rule.title}
          </div>
          {rule.description ? (
            <div className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">
              {rule.description}
            </div>
          ) : null}
        </div>

        <StatusPill active={rule.is_active} t={t} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <FrequencyPill freq={rule.frequency} t={t} />
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
          {t.interval}: {rule.interval}
        </span>
        {rule.files?.length ? (
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700"
          >
            <Paperclip size={13} />
            {rule.files.length}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MiniInfo
          icon={CalendarDays}
          label={t.start}
          value={formatDMY(rule.start_date)}
        />
        <MiniInfo
          icon={CalendarDays}
          label={t.end}
          value={formatDMY(rule.end_date)}
        />
        <MiniInfo
          icon={CalendarClock}
          label={t.nextRun}
          value={formatDMY(rule.next_run_date)}
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
          {t.weekDays}
        </div>
        <WeekDaysPills
          weekDays={rule.week_days}
          t={t}
          frequency={rule.frequency}
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
          {t.assignedTo}
        </div>
        <AssignedPills ids={rule.assigned_to} employeesById={employeesById} />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {can("recurring.view.button") && (
          <BigButton onClick={onView} icon={Eye}>
            {t.view}
          </BigButton>
        )}

        {can("recurring.pause.button") && (
          <BigButton
            onClick={onToggle}
            icon={rule.is_active ? PauseCircle : PlayCircle}
            loading={actionId === rule.id}
          >
            {rule.is_active ? t.pause : t.resume}
          </BigButton>
        )}

        {can("recurring.delete.button") && (
          <BigButton
            onClick={onDelete}
            icon={Trash2}
            tone="red"
            loading={actionId === rule.id}
          >
            {t.delete}
          </BigButton>
        )}
      </div>
    </article>
  );
}

function ConfirmDeleteModal({
  open,
  rule,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  rule: Rule;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-[10000] grid h-[100dvh] w-screen place-items-center bg-slate-950/60 px-4 backdrop-blur-[2px] transition-opacity duration-200",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      onMouseDown={onClose}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl transition-all duration-200",
          open ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-red-50 text-red-600">
          <AlertTriangle size={26} />
        </div>

        <h2 className="mt-4 text-center text-xl font-black text-slate-950">
          Silmək istədiyinizə əminsiniz?
        </h2>

        <p className="mx-auto mt-2 max-w-sm text-center text-sm font-medium leading-6 text-slate-500">
          Bu dövrlü tapşırıq qaydası silinəcək. Bu əməliyyatı geri qaytarmaq
          mümkün olmaya bilər.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">
            Qayda
          </div>
          <div className="mt-1 line-clamp-2 text-sm font-black text-slate-900">
            {rule.title}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
          >
            Ləğv et
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}

function RecurringDrawer({
  rule,
  open,
  t,
  employeesById,
  onClose,
}: {
  rule: Rule;
  open: boolean;
  t: any;
  employeesById: Map<string, Employee>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  async function openFile(file: any) {
    if (!file?.path) return;

    const { data } = await supabase.storage
      .from("task-files")
      .createSignedUrl(file.path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-[9999] h-[100dvh] w-screen bg-slate-950/70 transition-opacity duration-300",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "ml-auto flex h-[100dvh] w-full max-w-[680px] flex-col overflow-hidden bg-[#f7f8fb] shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#e42526]/10 blur-3xl" />
          <div className="absolute -bottom-24 left-24 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
                <Repeat2 size={14} />
                {t.recurringTask}
              </div>

              <h2 className="line-clamp-2 text-xl font-black leading-7 text-slate-950 sm:text-2xl">
                {rule.title}
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <FrequencyPill freq={rule.frequency} t={t} />
                <StatusPill active={rule.is_active} t={t} />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-4">
            <DetailCard icon={FileText} label={t.name} value={rule.title} />

            <DetailCard
              icon={Repeat2}
              label={t.frequency}
              value={translateFrequency(rule.frequency, t)}
            />

            <DetailCard icon={Clock3} label={t.interval} value={rule.interval} />

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <SectionTitle icon={CalendarDays} title={t.weekDays} />
              <div className="mt-3">
                <WeekDaysPills
                  weekDays={rule.week_days}
                  t={t}
                  frequency={rule.frequency}
                />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DetailCard
                icon={CalendarDays}
                label={t.start}
                value={formatDMY(rule.start_date)}
              />
              <DetailCard
                icon={CalendarDays}
                label={t.end}
                value={formatDMY(rule.end_date)}
              />
              <DetailCard
                icon={CalendarClock}
                label={t.nextRun}
                value={formatDMY(rule.next_run_date)}
              />
            </div>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <SectionTitle icon={UserRound} title={t.assignedTo} />
              <div className="mt-3">
                <AssignedPills
                  ids={rule.assigned_to}
                  employeesById={employeesById}
                  full
                />
              </div>
            </section>

            {rule.files?.length ? (
              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle icon={Paperclip} title={t.files} />
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                    {rule.files.length}
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  {rule.files.map((file: any, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openFile(file)}
                      title={file.name}
                      className="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
                          <Paperclip size={16} />
                        </span>

                        <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-700 group-hover:text-indigo-700">
                          {file.name}
                        </span>
                      </span>

                      <ChevronRight
                        size={16}
                        className="shrink-0 text-slate-400 group-hover:text-indigo-600"
                      />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

function AssignedPills({
  ids,
  employeesById,
  full = false,
}: {
  ids?: string[] | null;
  employeesById: Map<string, Employee>;
  full?: boolean;
}) {
  if (!ids?.length) {
    return <span className="text-xs font-bold text-slate-400">-</span>;
  }

  const employees = ids
    .map((id) => employeesById.get(id))
    .filter(Boolean) as Employee[];

  if (!employees.length) {
    return <span className="text-xs font-bold text-slate-400">-</span>;
  }

  const visible = full ? employees : employees.slice(0, 3);

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        full ? "max-w-full" : "max-w-[220px]"
      )}
    >
      {visible.map((emp) => (
        <span
          key={emp.id}
          className={cn(
            "truncate rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700",
            full ? "max-w-[220px]" : "max-w-[120px]"
          )}
          title={getEmployeeName(emp)}
        >
          {getEmployeeName(emp)}
        </span>
      ))}

      {!full && employees.length > 3 && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
          +{employees.length - 3}
        </span>
      )}
    </div>
  );
}

function WeekDaysPills({
  weekDays,
  t,
  frequency,
}: {
  weekDays: number[] | null;
  t: any;
  frequency: string;
}) {
  if (frequency !== "WEEKLY" || !weekDays?.length) {
    return <span className="text-xs font-bold text-slate-400">-</span>;
  }

  return (
    <div className="flex max-w-[150px] flex-wrap gap-1.5">
      {weekDays.map((day) => (
        <span
          key={day}
          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700"
        >
          {t.weekDaysShort?.[day] ?? day}
        </span>
      ))}
    </div>
  );
}

function FrequencyPill({ freq, t }: { freq: string; t: any }) {
  const cls =
    freq === "DAILY"
      ? "bg-emerald-50 text-emerald-700"
      : freq === "WEEKLY"
        ? "bg-indigo-50 text-indigo-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", cls)}>
      {translateFrequency(freq, t)}
    </span>
  );
}

function StatusPill({ active, t }: { active: boolean; t: any }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
      <CheckCircle2 size={13} />
      {t.active}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
      <PauseCircle size={13} />
      {t.paused}
    </span>
  );
}

function SmallIconButton({
  icon: Icon,
  label,
  tone = "default",
  loading,
  onClick,
}: {
  icon: any;
  label: string;
  tone?: "default" | "red";
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      title={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-xl border transition active:scale-[0.98] disabled:opacity-60",
        tone === "red"
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Icon size={14} />
      )}
    </button>
  );
}

function BigButton({
  children,
  icon: Icon,
  tone = "default",
  loading,
  onClick,
}: {
  children: React.ReactNode;
  icon: any;
  tone?: "default" | "red";
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={cn(
        "flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition active:scale-[0.98] disabled:opacity-60",
        tone === "red"
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Icon size={16} />
      )}
      {children}
    </button>
  );
}

function MiniInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Icon size={13} />
        {label}
      </div>
      <div className="truncate text-xs font-black text-slate-700" title={value}>
        {value}
      </div>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        <Icon size={15} />
        {label}
      </div>
      <div className="min-w-0 break-words text-sm font-black text-slate-800">
        {value ?? "-"}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-black text-slate-950">
      <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526]">
        <Icon size={16} />
      </span>
      {title}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "dark" | "green" | "gray";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : tone === "gray"
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : "border-slate-200 bg-slate-950 text-white";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-center shadow-sm",
        toneClass
      )}
    >
      <div className="text-xl font-black">{value}</div>
      <div
        className={cn(
          "text-[11px] font-black uppercase tracking-wide",
          tone === "dark" ? "text-slate-300" : "text-current/70"
        )}
      >
        {label}
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 rounded-2xl px-4 text-sm font-black transition active:scale-[0.98]",
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function AlertBox({
  type,
  text,
  onClose,
}: {
  type: "ok" | "err";
  text: string;
  onClose: () => void;
}) {
  const ok = type === "ok";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-bold",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
        ) : (
          <XCircle size={19} className="mt-0.5 shrink-0" />
        )}

        <span>{text}</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/70"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <section className="rounded-[30px] border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-slate-100 text-slate-400">
        <Repeat2 size={25} />
      </div>

      <h2 className="mt-4 text-lg font-black text-slate-900">
        {hasQuery ? "Axtarış üzrə nəticə tapılmadı" : "Dövrlü tapşırıq yoxdur"}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
        {hasQuery
          ? "Axtarış və ya filteri dəyişərək yenidən yoxlayın."
          : "Yeni dövrlü task yaratdıqda burada görünəcək."}
      </p>
    </section>
  );
}

function RecurringSkeleton() {
  return (
    <section className="grid gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[135px] animate-pulse rounded-[26px] border border-slate-200 bg-white"
        />
      ))}
    </section>
  );
}