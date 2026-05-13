"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

type Position = {
  id: string;
  name: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function PositionsPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const [positions, setPositions] = useState<Position[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return positions;

    return positions.filter((p) => p.name.toLowerCase().includes(q));
  }, [positions, search]);

  const load = async () => {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/positions", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Vəzifələr yüklənmədi");
      }

      setPositions(data.positions || []);
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createPosition = async () => {
    setMsg(null);

    const positionName = name.trim();

    if (!positionName) {
      setMsg({ type: "err", text: t.emptyPositionName });
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: positionName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Vəzifə yaratmaq alınmadı");
      }

      setPositions((prev) => [data.position, ...prev]);
      setName("");
      setMsg({ type: "ok", text: t.created || "Yaradıldı" });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;

    setBusyId(id);
    setMsg(null);

    try {
      const res = await fetch(`/api/positions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Vəzifə silmək alınmadı");
      }

      setPositions((prev) => prev.filter((p) => p.id !== id));
      setMsg({ type: "ok", text: t.deleted || "Silindi" });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setBusyId(null);
    }
  };

  const clearSearch = () => {
    setSearch("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
        <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
              <BriefcaseBusiness size={14} />
              Task Flow
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {t.positions}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Vəzifələri yaradın, siyahını idarə edin və struktur məlumatlarını
              səliqəli saxlayın.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
            <HeaderStat label="Cəmi" value={positions.length} />
            <HeaderStat label="Göstərilən" value={filteredPositions.length} />
          </div>
        </div>
      </section>

      {/* Main card */}
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                {t.positions}
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {filteredPositions.length} nəticə
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <div className="relative w-full xl:w-80">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.search}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                />
              </div>

              <button
                onClick={clearSearch}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                <X size={17} />
                {t.clear || "Təmizlə"}
              </button>

              <button
                onClick={load}
                disabled={loading}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <RefreshCw size={17} />
                )}
                {t.refresh || "Yenilə"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {msg && (
            <AlertBox
              type={msg.type}
              text={msg.text}
              onClose={() => setMsg(null)}
            />
          )}

          {/* Create */}
          <div className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <BriefcaseBusiness
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPosition()}
                  placeholder={t.newPosition}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:ring-4 focus:ring-[#e42526]/10"
                />
              </div>

              <button
                onClick={createPosition}
                disabled={creating}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#e42526] px-5 text-sm font-black text-white shadow-sm shadow-[#e42526]/20 transition hover:bg-[#c91f20] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
              >
                {creating ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {t.add}
              </button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <PositionSkeleton />
          ) : filteredPositions.length === 0 ? (
            <EmptyState text={t.notFound} />
          ) : (
            <div className="space-y-3">
              {filteredPositions.map((p) => {
                const isBusy = busyId === p.id;

                return (
                  <div
                    key={p.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526]">
                          <BriefcaseBusiness size={20} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {p.name}
                          </p>
                        </div>
                      </div>

                      <button
                        disabled={isBusy}
                        onClick={() => remove(p.id)}
                        className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-xs font-black text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                        {t.delete}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function HeaderStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
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
        "mb-5 flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-bold",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
        ) : (
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
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

function PositionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white text-slate-400 shadow-sm">
        <BriefcaseBusiness size={25} />
      </div>

      <h3 className="mt-4 text-sm font-black text-slate-900">{text}</h3>
    </div>
  );
}