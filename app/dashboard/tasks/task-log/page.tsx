"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertTriangle,
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  description?: string;
  deleted_at: string;
  assigned_to?: string[];
  deleter?: {
    ad?: string;
    soyad?: string;
  };
};

type Msg = {
  type: "ok" | "err";
  text: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("az-AZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDeleterName(task: Task) {
  const name = `${task.deleter?.ad ?? ""} ${task.deleter?.soyad ?? ""}`.trim();
  return name || "-";
}

export default function TaskLogPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<Msg | null>(null);

  useEffect(() => {
    loadDeletedTasks();
  }, []);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  async function loadDeletedTasks() {
    setLoading(true);
    setMsg(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Session tapılmadı");
      }

      const res = await fetch("/api/tasks?deleted=true", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Silinmiş task-lar yüklənmədi");
      }

      setTasks(data?.tasks || []);
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  async function restoreTask(id: string) {
    const ok = confirm("Task geri qaytarılsın?");
    if (!ok) return;

    setLoadingId(id);
    setMsg(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Session tapılmadı");
      }

      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, action: "restore" }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Task geri qaytarılmadı");
      }

      setMsg({ type: "ok", text: "Task geri yükləndi" });
      await loadDeletedTasks();
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setLoadingId(null);
    }
  }

  async function hardDeleteTask(id: string) {
    const ok = confirm("Bu taskı TAM silmək istəyirsən?");
    if (!ok) return;

    setLoadingId(id);
    setMsg(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Session tapılmadı");
      }

      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, hard: true }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Task tam silinmədi");
      }

      setMsg({ type: "ok", text: "Task tam silindi" });
      await loadDeletedTasks();
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setLoadingId(null);
    }
  }

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return tasks;

    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.description,
        getDeleterName(task),
        task.assigned_to?.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [query, tasks]);

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-8">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-5 lg:p-7">
        {/* HEADER */}
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
          <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-slate-900/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">
                <Trash2 size={14} />
                Task Log
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Silinmiş task-lar
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Silinmiş tapşırıqları izləyin, geri yükləyin və ya sistemdən
                tam silin.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <StatCard label="Silinmiş" value={tasks.length} tone="red" />
              <StatCard label="Görünən" value={filteredTasks.length} tone="dark" />
            </div>
          </div>
        </section>

        {/* TOOLBAR */}
        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Başlıq, silən şəxs və ya təyin olunan üzrə axtar..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
              />
            </div>

            <button
              type="button"
              onClick={loadDeletedTasks}
              disabled={loading}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <RefreshCcw size={17} />
              )}
              Yenilə
            </button>
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

        {/* CONTENT */}
        {loading ? (
          <TaskLogSkeleton />
        ) : filteredTasks.length === 0 ? (
          <EmptyState hasQuery={!!query.trim()} />
        ) : (
          <section className="grid gap-3">
            {filteredTasks.map((task) => (
              <TaskLogCard
                key={task.id}
                task={task}
                loading={loadingId === task.id}
                onRestore={() => restoreTask(task.id)}
                onHardDelete={() => hardDeleteTask(task.id)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function TaskLogCard({
  task,
  loading,
  onRestore,
  onHardDelete,
}: {
  task: Task;
  loading: boolean;
  onRestore: () => void;
  onHardDelete: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-black text-red-700">
              <Trash2 size={13} />
              Silinib
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
              #{task.id?.slice(0, 6)}
            </span>
          </div>

          <h2 className="line-clamp-2 text-base font-black leading-6 text-slate-950">
            {task.title}
          </h2>

          {task.description ? (
            <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-500">
              {task.description}
            </p>
          ) : null}

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <MiniInfo
              icon={CalendarClock}
              label="Silinmə vaxtı"
              value={formatDate(task.deleted_at)}
            />
            <MiniInfo
              icon={UserRound}
              label="Silən"
              value={getDeleterName(task)}
            />
            <MiniInfo
              icon={FileText}
              label="Təyin olunanlar"
              value={task.assigned_to?.length ? task.assigned_to.join(", ") : "-"}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:w-[250px] xl:flex-col">
          <button
            type="button"
            disabled={loading}
            onClick={onRestore}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArchiveRestore size={16} />
            )}
            Geri yüklə
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onHardDelete}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <XCircle size={16} />
            )}
            Tam sil
          </button>
        </div>
      </div>
    </article>
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "dark";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-center shadow-sm",
        tone === "red"
          ? "border-red-100 bg-red-50"
          : "border-slate-200 bg-slate-50"
      )}
    >
      <div
        className={cn(
          "text-xl font-black",
          tone === "red" ? "text-red-700" : "text-slate-950"
        )}
      >
        {value}
      </div>
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
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
          <AlertTriangle size={19} className="mt-0.5 shrink-0" />
        )}

        <span>{text}</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/70"
      >
        ×
      </button>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <section className="rounded-[30px] border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-slate-100 text-slate-400">
        <Trash2 size={25} />
      </div>

      <h2 className="mt-4 text-lg font-black text-slate-900">
        {hasQuery ? "Axtarış üzrə nəticə tapılmadı" : "Silinmiş task yoxdur"}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
        {hasQuery
          ? "Axtarış sözünü dəyişərək yenidən yoxlayın."
          : "Task silindikdə burada görünəcək və lazım olsa geri qaytara biləcəksiniz."}
      </p>
    </section>
  );
}

function TaskLogSkeleton() {
  return (
    <section className="grid gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[150px] animate-pulse rounded-[26px] border border-slate-200 bg-white"
        />
      ))}
    </section>
  );
}