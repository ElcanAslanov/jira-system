"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import DebugErrorBoundary from "@/app/components/DebugErrorBoundary";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
  Check,
} from "lucide-react";

type GuideRelation = {
  guide_id: string;
  guides?: { id: string; ad: string; soyad: string };
};

type Employee = {
  id: string;
  user_id: string | null;
  email: string;
  ad: string;
  soyad: string;
  ata_adi: string | null;
  elaqe_nomresi: string | null;
  created_at: string;

  company_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  role_id?: string | null;

  companies?: { id: string; name: string } | null;
  departments?: { id: string; name: string; company_id?: string } | null;
  positions?: { id: string; name: string } | null;
  roles?: { id: string; name: string } | null;

  employee_guides?: GuideRelation[];
};

type Option = { id: string; name: string; company_id?: string };
type ToastType = "ok" | "err" | "info";

type Toast = {
  type: ToastType;
  text: string;
} | null;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function getColumnLabels(t: any) {
  return {
    full_name: t.name + " " + t.surname,
    email: "Email",
    company_name: t.company,
    role_name: t.role,
    guides: t.guides,
  };
}

const MAIN_COLUMNS: Array<{
  key: "full_name" | "email" | "company_name" | "role_name" | "guides";
  sortable?: boolean;
}> = [
  { key: "full_name", sortable: true },
  { key: "email", sortable: true },
  { key: "company_name", sortable: true },
  { key: "role_name", sortable: true },
  { key: "guides" },
];

function formatDMY(date?: string | null, withTime = false) {
  if (!date) return "-";
  const dt = new Date(date);
  if (Number.isNaN(dt.getTime())) return String(date);

  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();

  if (!withTime) return `${dd}/${mm}/${yy}`;

  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function EmployeesAdminPageInner() {
  const { lang } = useLang();
  const t = translations[lang as keyof typeof translations];

  const [items, setItems] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<{
    companies: Option[];
    departments: Option[];
    positions: Option[];
    roles: Option[];
    guides: Option[];
  }>({ companies: [], departments: [], positions: [], roles: [], guides: [] });

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [search, setSearch] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const [sortBy, setSortBy] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [edit, setEdit] = useState<Employee | null>(null);
  const [editTab, setEditTab] = useState<"BASIC" | "COMPANY" | "GUIDES">(
    "BASIC"
  );
  const [editForm, setEditForm] = useState({
    ad: "",
    soyad: "",
    ata_adi: "",
    elaqe_nomresi: "",
    company_id: "",
    department_id: "",
    position_id: "",
    role_id: "",
    guide_ids: [] as string[],
  });

  function showToast(type: ToastType, text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2500);
  }

  const load = async () => {
    try {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        console.warn("Token yoxdur");
        setLoading(false);
        return;
      }

      const [empRes, metaRes] = await Promise.all([
        fetch("/api/admin/employees", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/employees/meta", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const empData = await empRes.json();
      const metaData = await metaRes.json();

      setItems(empData.employees || []);

      setMeta({
        companies: metaData.companies ?? [],
        departments: metaData.departments ?? [],
        positions: metaData.positions ?? [],
        roles: metaData.roles ?? [],
        guides: metaData.guides ?? [],
      });
    } catch (err) {
      console.error("LOAD ERROR:", err);
      showToast("err", "Məlumatlar yüklənmədi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data?.session) {
        console.warn("Session yoxdur");
        setLoading(false);
        return;
      }

      await load();
    };

    init();
  }, []);

  useEffect(() => {
    if (!edit) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEdit(null);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit]);

  useEffect(() => {
    const onError = (e: any) => {
      console.error("GLOBAL ERROR:", e.error || e.message);
    };

    const onReject = (e: any) => {
      console.error("PROMISE ERROR:", e.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);

  const companyOptions = useMemo(
    () => meta.companies.map((c) => ({ value: c.id, label: c.name })),
    [meta.companies]
  );

  const roleOptions = useMemo(
    () => meta.roles.map((r) => ({ value: r.id, label: r.name })),
    [meta.roles]
  );

  const guideOptions = useMemo(
    () => meta.guides.map((g) => ({ value: g.id, label: g.name })),
    [meta.guides]
  );

  const filteredBase = useMemo(() => {
    let data = [...items];

    const q = search.trim().toLowerCase();

    if (q) {
      data = data.filter((x) =>
        [
          x.ad,
          x.soyad,
          x.email,
          x.companies?.name,
          x.roles?.name,
          x.positions?.name,
          x.departments?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (selectedCompanyIds.length > 0) {
      const set = new Set(selectedCompanyIds);
      data = data.filter((x) => {
        const cid = x.company_id || x.companies?.id || "";
        return set.has(String(cid));
      });
    }

    if (selectedRoleIds.length > 0) {
      const set = new Set(selectedRoleIds);
      data = data.filter((x) => {
        const rid = x.role_id || x.roles?.id || "";
        return set.has(String(rid));
      });
    }

    return data;
  }, [items, search, selectedCompanyIds, selectedRoleIds]);

  const filteredEmployees = useMemo(() => {
    const data = [...filteredBase];

    const getVal = (e: Employee, key: string) => {
      if (key === "full_name") return `${e.ad || ""} ${e.soyad || ""}`.trim();
      if (key === "company_name") return e.companies?.name || "";
      if (key === "role_name") return e.roles?.name || "";
      if (key === "created_at") return e.created_at || "";
      return (e as any)?.[key] ?? "";
    };

    data.sort((a, b) => {
      const A = getVal(a, sortBy);
      const B = getVal(b, sortBy);

      if (sortBy === "created_at") {
        const tA = new Date(String(A)).getTime();
        const tB = new Date(String(B)).getTime();
        return sortDir === "asc" ? tA - tB : tB - tA;
      }

      const nA = Number(A);
      const nB = Number(B);
      const isNum = !Number.isNaN(nA) && !Number.isNaN(nB);

      if (isNum) return sortDir === "asc" ? nA - nB : nB - nA;

      const sA = String(A ?? "").toLowerCase();
      const sB = String(B ?? "").toLowerCase();
      return sortDir === "asc" ? sA.localeCompare(sB) : sB.localeCompare(sA);
    });

    return data;
  }, [filteredBase, sortBy, sortDir]);

  function toggleSort(col: string) {
    setSortBy((prev) => {
      if (prev !== col) {
        setSortDir("asc");
        return col;
      }

      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }

  useEffect(() => {
    setPage(1);
  }, [search, selectedCompanyIds, selectedRoleIds, sortBy, sortDir, pageSize]);

  const totalItems = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    if (p !== page) setPage(p);
  }, [page, totalPages]);

  const paginatedEmployees = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, safePage, pageSize]);

  const openEdit = (e: Employee) => {
    setEdit(e);
    setEditTab("BASIC");

    setEditForm({
      ad: e.ad || "",
      soyad: e.soyad || "",
      ata_adi: e.ata_adi || "",
      elaqe_nomresi: e.elaqe_nomresi || "",
      company_id: String(e.company_id || e.companies?.id || ""),
      department_id: String(e.department_id || e.departments?.id || ""),
      position_id: String(e.position_id || e.positions?.id || ""),
      role_id: String(e.role_id || e.roles?.id || ""),
      guide_ids: e.employee_guides?.map((g) => String(g.guide_id)) || [],
    });
  };

  const closeEdit = () => setEdit(null);

  const saveEdit = async () => {
    if (!edit) return;

    setBusyId(edit.id);
    setToast(null);

    try {
      const res = await fetch("/api/admin/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edit.id, ...editForm }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Yeniləmə xətası");

      await load();
      showToast("ok", "✅ Yeniləndi");
      closeEdit();
    } catch (e: any) {
      showToast("err", e?.message || "Server xətası");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t.deleteEmployeeConfirm)) return;

    setBusyId(id);

    try {
      const res = await fetch(`/api/admin/employees?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Silmə xətası");

      setItems((prev) => prev.filter((x) => x.id !== id));
      showToast("ok", "🗑️ Silindi");
    } catch (e: any) {
      showToast("err", e?.message || "Server xətası");
    } finally {
      setBusyId(null);
    }
  };

  const filteredDepartments = useMemo(() => {
    if (!editForm.company_id) return [];
    return meta.departments.filter(
      (d) => String(d.company_id) === String(editForm.company_id)
    );
  }, [meta.departments, editForm.company_id]);

  const showingFrom = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={cn(
            "fixed right-5 top-5 z-[9999] rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl",
            toast.type === "ok" &&
              "border-emerald-200 bg-emerald-50 text-emerald-800",
            toast.type === "err" && "border-red-200 bg-red-50 text-red-800",
            toast.type === "info" && "border-blue-200 bg-blue-50 text-blue-900"
          )}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
        <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
              <Users size={14} />
              Admin panel
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {t.employees}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              İşçi məlumatlarını, şirkət/struktur əlaqələrini və rəhbər
              təyinatlarını idarə edin.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <HeaderStat
              label={t.showing}
              value={`${showingFrom}-${showingTo}`}
              icon={Users}
            />
            <HeaderStat
              label="Cəmi"
              value={totalItems}
              icon={Building2}
            />
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[#e42526]" />
                <h2 className="text-base font-black text-slate-950">
                  {t.searchFilters}
                </h2>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-400">
                Axtarış, filter, sıralama və səhifələmə
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t.perPage} {n}
                  </option>
                ))}
              </select>

              <button
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-[#e42526] active:scale-[0.98]"
                onClick={() => load()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <RefreshCw size={17} />
                )}
                {t.refresh}
              </button>

              <button
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                onClick={() => {
                  setSearch("");
                  setSelectedCompanyIds([]);
                  setSelectedRoleIds([]);
                  setSortBy("full_name");
                  setSortDir("asc");
                  setPage(1);
                }}
              >
                <X size={17} />
                {t.clear}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2 xl:grid-cols-4">
          <Field label={t.search}>
            <div className="relative">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
              />
            </div>
          </Field>

          <Field label={t.sort}>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
              >
                <option value="full_name">
                  {t.name} {t.surname}
                </option>
                <option value="email">{t.email}</option>
                <option value="company_name">{t.company}</option>
                <option value="role_name">{t.role}</option>
              </select>

              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="h-12 min-w-[76px] rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                title={t.sort}
              >
                {sortDir === "asc" ? "A→Z" : "Z→A"}
              </button>
            </div>
          </Field>

          <Field label={t.company}>
            <MultiSelectPortal
              t={t}
              placeholder={t.selectCompany}
              options={companyOptions}
              selectedValues={selectedCompanyIds}
              onChange={(vals) => setSelectedCompanyIds(vals)}
            />
          </Field>

          <Field label={t.role}>
            <MultiSelectPortal
              t={t}
              placeholder={t.selectRole}
              options={roleOptions}
              selectedValues={selectedRoleIds}
              onChange={setSelectedRoleIds}
            />
          </Field>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-black text-slate-950">
              {t.employees}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {showingFrom}–{showingTo} / {totalItems}
            </p>
          </div>

          <PaginationControls
            t={t}
            safePage={safePage}
            totalPages={totalPages}
            loading={loading}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>

        {loading ? (
          <TableSkeleton />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    {MAIN_COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={cn(
                          "select-none px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400",
                          c.sortable && "cursor-pointer hover:bg-slate-100"
                        )}
                        onClick={() => c.sortable && toggleSort(c.key)}
                        title={c.sortable ? t.sort : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {getColumnLabels(t)[c.key] || c.key}
                          {sortBy === c.key && (
                            <span className="text-[#e42526]">
                              {sortDir === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}

                    <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Əməliyyat
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedEmployees.map((e) => (
                    <tr key={e.id} className="transition hover:bg-[#fff8f8]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar ad={e.ad} soyad={e.soyad} />
                          <div>
                            <p className="text-sm font-black text-slate-950">
                              {e.ad} {e.soyad}
                            </p>
                            <p className="text-xs font-medium text-slate-400">
                              {formatDMY(e.created_at)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                        {e.email || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-2xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                          {e.companies?.name || "-"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-2xl bg-[#fff1f1] px-3 py-1.5 text-xs font-bold text-[#c91f20]">
                          {e.roles?.name || "-"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {e.employee_guides?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {e.employee_guides.map((g, i) => {
                              const guide = g.guides;
                              if (!guide) return null;

                              return (
                                <span
                                  key={i}
                                  className="rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700"
                                >
                                  {guide.ad} {guide.soyad}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(e)}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                          >
                            <Edit3 size={15} />
                            {t.edit}
                          </button>

                          <button
                            onClick={() => remove(e.id)}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
                            disabled={busyId === e.id}
                          >
                            {busyId === e.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                            {t.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td
                        colSpan={MAIN_COLUMNS.length + 1}
                        className="p-12 text-center"
                      >
                        <EmptyState text={t.employeesNotFound} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 md:hidden">
              {paginatedEmployees.map((e) => (
                <div
                  key={e.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar ad={e.ad} soyad={e.soyad} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-slate-950">
                        {e.ad} {e.soyad}
                      </p>
                      <p className="truncate text-xs font-medium text-slate-500">
                        {e.email}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm">
                    <InfoLine label={t.company} value={e.companies?.name || "-"} />
                    <InfoLine label={t.role} value={e.roles?.name || "-"} />
                    <InfoLine
                      label={t.guides}
                      value={
                        e.employee_guides?.length
                          ? e.employee_guides
                              .map((g) => {
                                const guide = Array.isArray(g.guides)
                                  ? g.guides[0]
                                  : g.guides;

                                if (!guide) return null;
                                return `${guide.ad ?? ""} ${
                                  guide.soyad ?? ""
                                }`.trim();
                              })
                              .filter(Boolean)
                              .join(", ")
                          : "-"
                      }
                    />
                    <InfoLine label={t.date} value={formatDMY(e.created_at)} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openEdit(e)}
                      className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-700"
                    >
                      <Edit3 size={15} />
                      {t.edit}
                    </button>

                    <button
                      onClick={() => remove(e.id)}
                      className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-red-600 text-xs font-black text-white"
                      disabled={busyId === e.id}
                    >
                      {busyId === e.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                      {t.delete}
                    </button>
                  </div>
                </div>
              ))}

              {paginatedEmployees.length === 0 && (
                <EmptyState text={t.employeesNotFound} />
              )}
            </div>

            <div className="border-t border-slate-200 p-4">
              <PaginationControls
                t={t}
                safePage={safePage}
                totalPages={totalPages}
                loading={loading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </div>
          </>
        )}
      </section>

      {edit && (
        <ModalOverlay onClose={closeEdit}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl md:max-w-2xl lg:max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1 text-xs font-black text-[#c91f20]">
                  <Edit3 size={13} />
                  {t.editEmployee}
                </div>

                <h2 className="text-lg font-black text-slate-950 md:text-xl">
                  {editForm.ad} {editForm.soyad}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {edit?.email}
                </p>
              </div>

              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                onClick={closeEdit}
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
                <TabBtn
                  title={t.basic}
                  active={editTab === "BASIC"}
                  onClick={() => setEditTab("BASIC")}
                />
                <TabBtn
                  title={t.companyTab}
                  active={editTab === "COMPANY"}
                  onClick={() => setEditTab("COMPANY")}
                />
                <TabBtn
                  title={t.guidesTab}
                  active={editTab === "GUIDES"}
                  onClick={() => setEditTab("GUIDES")}
                />
              </div>

              {editTab === "BASIC" && (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={t.name}>
                    <TextInput
                      value={editForm.ad}
                      onChange={(value) =>
                        setEditForm((p) => ({ ...p, ad: value }))
                      }
                      placeholder="Ad"
                    />
                  </Field>

                  <Field label={t.surname}>
                    <TextInput
                      value={editForm.soyad}
                      onChange={(value) =>
                        setEditForm((p) => ({ ...p, soyad: value }))
                      }
                      placeholder="Soyad"
                    />
                  </Field>

                  <Field label={t.fatherName}>
                    <TextInput
                      value={editForm.ata_adi}
                      onChange={(value) =>
                        setEditForm((p) => ({ ...p, ata_adi: value }))
                      }
                      placeholder="Ata adı"
                    />
                  </Field>

                  <Field label={t.phone}>
                    <TextInput
                      value={editForm.elaqe_nomresi}
                      onChange={(value) =>
                        setEditForm((p) => ({ ...p, elaqe_nomresi: value }))
                      }
                      placeholder="+994..."
                    />
                  </Field>
                </div>
              )}

              {editTab === "COMPANY" && (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={t.company}>
                    <SelectInput
                      value={editForm.company_id}
                      onChange={(value) =>
                        setEditForm((p) => ({
                          ...p,
                          company_id: value,
                          department_id: "",
                        }))
                      }
                    >
                      <option value="">{t.selectCompany}</option>
                      {meta.companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>

                  <Field label={t.department}>
                    <SelectInput
                      value={editForm.department_id}
                      onChange={(value) =>
                        setEditForm((p) => ({ ...p, department_id: value }))
                      }
                      disabled={!editForm.company_id}
                    >
                      <option value="">
                        {editForm.company_id
                          ? t.selectDepartment
                          : t.selectCompanyFirst}
                      </option>
                      {filteredDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>

                  <Field label={t.position}>
                    <SelectInput
                      value={editForm.position_id}
                      onChange={(value) =>
                        setEditForm((p) => ({ ...p, position_id: value }))
                      }
                    >
                      <option value="">{t.selectPosition}</option>
                      {meta.positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>

                  <Field label={t.role}>
                    <SelectInput
                      value={editForm.role_id}
                      onChange={(value) =>
                        setEditForm((p) => ({ ...p, role_id: value }))
                      }
                    >
                      <option value="">{t.selectRole}</option>
                      {meta.roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
              )}

              {editTab === "GUIDES" && (
                <div className="mt-5">
                  <GuideMultiDropdown
                    t={t}
                    label={t.selectGuide}
                    options={guideOptions}
                    selectedIds={editForm.guide_ids}
                    setSelectedIds={(ids) =>
                      setEditForm((p) => ({ ...p, guide_ids: ids }))
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-5 md:flex-row">
              <button
                onClick={saveEdit}
                disabled={busyId === edit?.id}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition active:scale-[0.98]",
                  busyId === edit?.id
                    ? "cursor-not-allowed bg-[#e42526]/60"
                    : "bg-[#e42526] hover:bg-[#c91f20]"
                )}
              >
                {busyId === edit?.id ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Check size={17} />
                )}
                {busyId === edit?.id ? t.saving : t.save}
              </button>

              <button
                onClick={closeEdit}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ---------- UI Pieces ---------- */

function HeaderStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: any;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <div className="grid h-8 w-8 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526]">
          <Icon size={16} />
        </div>
      </div>

      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function PaginationControls({
  t,
  safePage,
  totalPages,
  loading,
  onPrev,
  onNext,
}: {
  t: any;
  safePage: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={safePage <= 1 || loading}
        onClick={onPrev}
      >
        <ChevronLeft size={16} />
        {t.previous}
      </button>

      <div className="grid h-10 min-w-10 place-items-center rounded-2xl bg-slate-900 px-3 text-xs font-black text-white">
        {safePage} / {totalPages}
      </div>

      <button
        className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={safePage >= totalPages || loading}
        onClick={onNext}
      >
        {t.next}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-100 text-slate-400">
        <UserRound size={25} />
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-900">{text}</h3>
    </div>
  );
}

function Avatar({ ad, soyad }: { ad?: string; soyad?: string }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-xs font-black text-slate-700">
      {ad?.[0]}
      {soyad?.[0]}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-white px-3 py-2">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <span className="text-right text-xs font-black text-slate-800">
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </select>
  );
}

function TabBtn({
  title,
  active,
  onClick,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl px-3 text-xs font-black transition",
        active
          ? "bg-white text-[#e42526] shadow-sm"
          : "text-slate-500 hover:text-slate-900"
      )}
    >
      {title}
    </button>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const [mouseDown, setMouseDown] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-[#020617]/75 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setMouseDown(true);
      }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget && mouseDown) onClose();
        setMouseDown(false);
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/* ---------- MultiSelectPortal ---------- */

function MultiSelectPortal({
  placeholder,
  options,
  selectedValues,
  onChange,
  t,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  t: any;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const selectedLabels = useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]));
    return selectedValues.map((v) => m.get(v) || v).filter(Boolean);
  }, [options, selectedValues]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 120);
    return options
      .filter((o) => o.label.toLowerCase().includes(s))
      .slice(0, 120);
  }, [options, q]);

  function toggle(val: string) {
    if (selectedSet.has(val)) onChange(selectedValues.filter((x) => x !== val));
    else onChange([...selectedValues, val]);
  }

  function close() {
    setOpen(false);
    setQ("");
  }

  return (
    <div className="relative">
      {selectedLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedLabels.map((lab, idx) => (
            <div
              key={`${lab}-${idx}`}
              className="flex items-center gap-2 rounded-full bg-[#e42526] px-3 py-1.5 text-xs font-black text-white shadow-sm"
            >
              {lab}
              <button
                type="button"
                className="grid h-5 w-5 place-items-center rounded-full bg-white/20 hover:bg-white/30"
                onClick={() =>
                  onChange(selectedValues.filter((_, i) => i !== idx))
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setPos({ left: rect.left, top: rect.bottom + 8, width: rect.width });
          setOpen((p) => !p);
        }}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center justify-between rounded-2xl border px-4 text-sm font-bold transition",
          open
            ? "border-[#e42526] bg-[#fff1f1] text-[#c91f20] ring-4 ring-[#e42526]/10"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
        )}
      >
        <span
          className={cn(
            selectedValues.length ? "text-slate-900" : "text-slate-400"
          )}
        >
          {selectedValues.length
            ? `${selectedValues.length} ${t.selected}`
            : placeholder}
        </span>

        <ChevronDown
          size={16}
          className={cn("transition", open && "rotate-180")}
        />
      </div>

      {open &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[99999] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            <div className="border-b border-slate-200 bg-slate-50 p-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.search}
                autoFocus
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#e42526] focus:ring-4 focus:ring-[#e42526]/10"
              />
            </div>

            <div className="max-h-[260px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-3 text-sm font-bold text-slate-500">
                  {t.notFound}
                </div>
              )}

              {filtered.map((o) => {
                const checked = selectedSet.has(o.value);

                return (
                  <div
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3",
                      checked ? "bg-[#fff1f1]" : "bg-white hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-lg border-2 text-xs font-black",
                        checked
                          ? "border-[#e42526] text-[#e42526]"
                          : "border-slate-300 text-slate-300"
                      )}
                    >
                      {checked ? "✓" : ""}
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {o.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100"
                onClick={() => onChange([])}
              >
                {t.clear}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#e42526] px-3 py-2 text-sm font-black text-white hover:bg-[#c91f20]"
                onClick={close}
              >
                {t.done}
              </button>
            </div>
          </div>,
          document.body
        )}

      {open && (
        <div
          className="fixed inset-0 z-[99998]"
          onClick={() => setOpen(false)}
          style={{ background: "transparent" }}
        />
      )}
    </div>
  );
}

function GuideMultiDropdown({
  label,
  options,
  selectedIds,
  setSelectedIds,
  t,
}: {
  label: string;
  options: { value: string; label: string }[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  t: any;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selected = useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]));
    return selectedIds.map((id) => ({ id, label: m.get(id) || id }));
  }, [options, selectedIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 120);
    return options
      .filter((o) => o.label.toLowerCase().includes(s))
      .slice(0, 120);
  }, [options, q]);

  function toggle(val: string) {
    if (selectedSet.has(val)) {
      setSelectedIds(selectedIds.filter((x) => x !== val));
    } else {
      setSelectedIds([...selectedIds, val]);
    }
  }

  return (
    <div>
      <Field label={label}>
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selected.map((x) => (
              <div
                key={x.id}
                className="flex items-center gap-2 rounded-full bg-[#e42526] px-3 py-1.5 text-xs font-black text-white shadow-sm"
              >
                {x.label}
                <button
                  type="button"
                  className="grid h-5 w-5 place-items-center rounded-full bg-white/20 hover:bg-white/30"
                  onClick={() => toggle(x.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            setPos({ left: rect.left, top: rect.bottom + 8, width: rect.width });
            setOpen(true);
          }}
          className={cn(
            "flex h-12 w-full cursor-pointer items-center justify-between rounded-2xl border px-4 text-sm font-bold transition",
            open
              ? "border-[#e42526] bg-[#fff1f1] text-[#c91f20] ring-4 ring-[#e42526]/10"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
          )}
        >
          <span
            className={cn(selectedIds.length ? "text-slate-900" : "text-slate-400")}
          >
            {selectedIds.length
              ? `${selectedIds.length} ${t.guidesSelected}`
              : t.selectGuide}
          </span>

          <ChevronDown
            size={16}
            className={cn("transition", open && "rotate-180")}
          />
        </div>

        {open &&
          mounted &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[99999] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              style={{ left: pos.left, top: pos.top, width: pos.width }}
            >
              <div className="border-b border-slate-200 bg-slate-50 p-3">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t.search}
                  autoFocus
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#e42526] focus:ring-4 focus:ring-[#e42526]/10"
                />
              </div>

              <div className="max-h-[260px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="p-3 text-sm font-bold text-slate-500">
                    {t.notFound}
                  </div>
                )}

                {filtered.map((o) => {
                  const checked = selectedSet.has(o.value);

                  return (
                    <div
                      key={o.value}
                      onClick={() => toggle(o.value)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-3",
                        checked ? "bg-[#fff1f1]" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <div
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-lg border-2 text-xs font-black",
                          checked
                            ? "border-[#e42526] text-[#e42526]"
                            : "border-slate-300 text-slate-300"
                        )}
                      >
                        {checked ? "✓" : ""}
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {o.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100"
                  onClick={() => setSelectedIds([])}
                >
                  {t.clear}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-[#e42526] px-3 py-2 text-sm font-black text-white hover:bg-[#c91f20]"
                  onClick={() => setOpen(false)}
                >
                  {t.done}
                </button>
              </div>
            </div>,
            document.body
          )}

        {open && (
          <div
            className="fixed inset-0 z-[99998]"
            onClick={() => setOpen(false)}
            style={{ background: "transparent" }}
          />
        )}
      </Field>
    </div>
  );
}

export default function EmployeesAdminPage() {
  return (
    <DebugErrorBoundary>
      <EmployeesAdminPageInner />
    </DebugErrorBoundary>
  );
}