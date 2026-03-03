"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

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

const COLUMN_LABELS: Record<string, string> = {
  full_name: "Ad Soyad",
  email: "Email",
  company_name: "Şirkət",
  role_name: "Rol",
  guides: "Rəhbər(lər)",   // ✅ əlavə et
  // created_at: "Yaradılma",
};

const MAIN_COLUMNS: Array<
  { key: "full_name" | "email" | "company_name" | "role_name" | "guides"; sortable?: boolean }
> = [
    { key: "full_name", sortable: true },
    { key: "email", sortable: true },
    { key: "company_name", sortable: true },
    { key: "role_name", sortable: true },
    { key: "guides" },
    // { key: "created_at", sortable: true },
  ];

function formatDMY(date?: string | null, withTime = false) {
  if (!date) return "-";
  // created_at ISO
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

export default function EmployeesAdminPage() {
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

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Sorting
  const [sortBy, setSortBy] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Edit modal
  const [edit, setEdit] = useState<Employee | null>(null);
  const [editTab, setEditTab] = useState<"BASIC" | "COMPANY" | "GUIDES">("BASIC");
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
  // ---------------- LOAD ----------------
  const load = async () => {
    setLoading(true);
    setToast(null);

   try {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session tapılmadı");
  }

  // EMPLOYEES
  const res = await fetch("/api/admin/employees", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Yükləmə xətası");

  setItems(data.employees || []);

  // META
  const metaRes = await fetch("/api/employees/meta", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const metaData = await metaRes.json();

  setMeta({
    companies: metaData.companies || [],
    departments: metaData.departments || [],
    positions: metaData.positions || [],
    roles: metaData.roles || [],
    guides: metaData.guides || [],
  });
} catch (e: any) {
  showToast("err", e?.message || "Server xətası");
} finally {
  setLoading(false);
}
  };

  useEffect(() => {
    load();
  }, []);

  // Esc closes modal
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEdit(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit]);

  // Options for MultiSelectPortal
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

  // ---------------- FILTER BASE ----------------
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

  // ---------------- SORTED ----------------
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

      // date sort if created_at
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

  // Reset page on filter/sort changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedCompanyIds, selectedRoleIds, sortBy, sortDir, pageSize]);

  // Pagination derived
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

  // ---------------- EDIT OPEN ----------------
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

  // ---------------- SAVE ----------------
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
    if (!confirm("İşçi silinsin?")) return;

    setBusyId(id);

    try {
      const res = await fetch(`/api/admin/employees?id=${id}`, { method: "DELETE" });
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

  // Edit modal department list depends on selected company
  const filteredDepartments = useMemo(() => {
    if (!editForm.company_id) return [];
    return meta.departments.filter((d) => String(d.company_id) === String(editForm.company_id));
  }, [meta.departments, editForm.company_id]);

  // ---------------- UI ----------------
  return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-6 lg:max-w-7xl lg:mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-5 right-5 z-[9999] px-4 py-3 rounded-xl shadow-xl border text-sm font-bold",
            toast.type === "ok" && "bg-emerald-50 text-emerald-800 border-emerald-200",
            toast.type === "err" && "bg-red-50 text-red-800 border-red-200",
            toast.type === "info" && "bg-blue-50 text-blue-900 border-blue-200"
          )}
        >
          {toast.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900">👥 İşçilər</h1>
            <p className="text-sm text-slate-500 mt-1">
              Axtarış, filter, sıralama və səhifələmə ilə idarə et.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            <div className="text-xs font-extrabold text-slate-500">
              Göstərilir:{" "}
              <span className="text-slate-900">
                {totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)}
              </span>{" "}
              / <span className="text-slate-900">{totalItems}</span>
            </div>

            <select
              className="border rounded-xl px-3 py-2 text-sm font-bold bg-white"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Səhifədə {n}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                className={cn(
                  "px-3 py-2 rounded-xl border font-extrabold text-sm bg-white",
                  safePage <= 1 && "opacity-60 cursor-not-allowed"
                )}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Əvvəlki
              </button>
              <div className="text-sm font-black text-slate-900">
                {safePage} / {totalPages}
              </div>
              <button
                className={cn(
                  "px-3 py-2 rounded-xl border font-extrabold text-sm bg-white",
                  safePage >= totalPages && "opacity-60 cursor-not-allowed"
                )}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sonrakı →
              </button>
            </div>
          </div>
        </div>

        {/* FILTER CARD (digər səhifə stili) */}
        <div className="border rounded-2xl overflow-hidden shadow-sm mb-6">
          <div className="px-6 py-4 bg-slate-50 border-b font-extrabold text-slate-700">
            Axtarış & Filtrlər
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Search */}
            <Field label="Axtar">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ad / Email / Şirkət / Rol..."
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </Field>

            {/* Sort */}
            <Field label="Sıralama">
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="full_name">Ad Soyad</option>
                  <option value="email">Email</option>
                  <option value="company_name">Şirkət</option>
                  <option value="role_name">Rol</option>
                  {/* <option value="created_at">Yaradılma</option> */}
                </select>

                <button
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="px-4 py-3 rounded-xl border font-black bg-white hover:bg-slate-50"
                  title="A→Z / Z→A"
                >
                  {sortDir === "asc" ? "A→Z" : "Z→A"}
                </button>
              </div>
            </Field>

            {/* Companies multi */}
            <Field label="Şirkətlər">
              <MultiSelectPortal
                placeholder="Şirkət seç"
                options={companyOptions}
                selectedValues={selectedCompanyIds}
                onChange={(vals) => {
                  setSelectedCompanyIds(vals);
                  // (istəsən) departament filter də əlavə edəndə burada reset edərik
                }}
              />
            </Field>

            {/* Roles multi */}
            {/* <Field label="Rollar">
              <MultiSelectPortal
                placeholder="Rol seç"
                options={roleOptions}
                selectedValues={selectedRoleIds}
                onChange={setSelectedRoleIds}
              />
            </Field> */}

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                className="px-4 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700"
                onClick={() => load()}
              >
                🔄 Yenilə
              </button>

              <button
                className="px-4 py-3 rounded-xl border font-black bg-white hover:bg-slate-50"
                onClick={() => {
                  setSearch("");
                  setSelectedCompanyIds([]);
                  setSelectedRoleIds([]);
                  setSortBy("full_name");
                  setSortDir("asc");
                  setPage(1);
                }}
              >
                🧹 Clear
              </button>
            </div>
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="py-10 text-slate-600 font-bold">Yüklənir...</div>
        ) : (
          <div className="hidden md:block overflow-x-auto border rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {MAIN_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={cn(
                        "p-3 text-left font-black text-slate-700 border-b select-none",
                        c.sortable && "cursor-pointer hover:bg-slate-100"
                      )}
                      onClick={() => c.sortable && toggleSort(c.key)}
                      title={c.sortable ? "Sırala" : undefined}
                    >
                      {COLUMN_LABELS[c.key] || c.key}{" "}
                      {sortBy === c.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                  {/* <th className="p-3 text-left font-black text-slate-700 border-b w-[220px]">
                    Əməliyyat
                  </th> */}
                </tr>
              </thead>

              <tbody>
                {paginatedEmployees.map((e) => (
                  <tr key={e.id} className="border-t hover:bg-slate-50/60">
                    <td className="p-3 font-bold text-slate-900">
                      {e.ad} {e.soyad}
                    </td>
                    <td className="p-3 text-slate-800">{e.email}</td>
                    <td className="p-3 text-slate-800">{e.companies?.name || "-"}</td>
                    <td className="p-3 text-slate-800">{e.roles?.name || "-"}</td>
                    <td className="p-3">
                      {e.employee_guides?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {e.employee_guides.map((g, i) => {
                            const guide = g.guides;
                            if (!guide) return null;

                            return (
                              <span
                                key={i}
                                className="px-2 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {guide.ad} {guide.soyad}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    {/* <td className="p-3 text-slate-800">{formatDMY(e.created_at, true)}</td> */}

                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(e)}
                          className="px-3 py-2 rounded-xl border font-black bg-white hover:bg-slate-50"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => remove(e.id)}
                          className="px-3 py-2 rounded-xl font-black text-white bg-red-600 hover:bg-red-700"
                          disabled={busyId === e.id}
                        >
                          {busyId === e.id ? "..." : "🗑️ Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={MAIN_COLUMNS.length + 1} className="p-10 text-center text-slate-500 font-bold">
                      Heç bir işçi tapılmadı
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          </div>

        )}
      </div>
      <div className="md:hidden space-y-4 mt-4">
        {paginatedEmployees.map((e) => (
          <div key={e.id} className="border rounded-2xl p-4 shadow-sm bg-white">
            <div className="font-bold text-lg">
              {e.ad} {e.soyad}
            </div>

            <div className="text-sm text-slate-500">
              {e.email}
            </div>

            <div className="mt-3 text-sm space-y-1">
              <div>Şirkət: {e.companies?.name || "-"}</div>
              <div>Rol: {e.roles?.name || "-"}</div>
              <div>
                Rəhbər(lər):{" "}
                {e.employee_guides?.length
                  ? e.employee_guides
                    .map((g) => {
                      const guide = Array.isArray(g.guides)
                        ? g.guides[0]
                        : g.guides;

                      if (!guide) return null;
                      return `${guide.ad ?? ""} ${guide.soyad ?? ""}`.trim();
                    })
                    .filter(Boolean)
                    .join(", ")
                  : "-"}
              </div>
              <div>Tarix: {formatDMY(e.created_at)}</div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => openEdit(e)}
                className="flex-1 py-2 rounded-xl border font-bold"
              >
                Edit
              </button>

              <button
                onClick={() => remove(e.id)}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* EDIT MODAL */}
      {edit && (
        <ModalOverlay onClose={closeEdit}>
          <div
            className="bg-white w-full max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border p-5 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg md:text-xl font-black text-slate-900">
                  ✏️ İşçini düzəliş et
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Dəyişiklikləri edib “Yadda saxla” bas.
                </p>
              </div>

              <button
                className="px-3 py-2 rounded-xl border font-black bg-white hover:bg-slate-50"
                onClick={closeEdit}
              >
                ✖ Bağla
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex flex-wrap gap-2">
              <TabBtn title="BASIC" active={editTab === "BASIC"} onClick={() => setEditTab("BASIC")} />
              <TabBtn title="COMPANY" active={editTab === "COMPANY"} onClick={() => setEditTab("COMPANY")} />
              <TabBtn title="GUIDES" active={editTab === "GUIDES"} onClick={() => setEditTab("GUIDES")} />
            </div>

            {/* BASIC */}
            {editTab === "BASIC" && (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Ad">
                  <input
                    value={editForm.ad}
                    onChange={(e) => setEditForm((p) => ({ ...p, ad: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    placeholder="Ad"
                  />
                </Field>

                <Field label="Soyad">
                  <input
                    value={editForm.soyad}
                    onChange={(e) => setEditForm((p) => ({ ...p, soyad: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    placeholder="Soyad"
                  />
                </Field>

                <Field label="Ata adı">
                  <input
                    value={editForm.ata_adi}
                    onChange={(e) => setEditForm((p) => ({ ...p, ata_adi: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    placeholder="Ata adı"
                  />
                </Field>

                <Field label="Əlaqə nömrəsi">
                  <input
                    value={editForm.elaqe_nomresi}
                    onChange={(e) => setEditForm((p) => ({ ...p, elaqe_nomresi: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    placeholder="+994..."
                  />
                </Field>
              </div>
            )}

            {/* COMPANY */}
            {editTab === "COMPANY" && (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Şirkət">
                  <select
                    value={editForm.company_id}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        company_id: e.target.value,
                        department_id: "",
                      }))
                    }
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                  >
                    <option value="">Şirkət seç</option>
                    {meta.companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Departament">
                  <select
                    value={editForm.department_id}
                    onChange={(e) => setEditForm((p) => ({ ...p, department_id: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                    disabled={!editForm.company_id}
                  >
                    <option value="">
                      {editForm.company_id ? "Departament seç" : "Əvvəl şirkət seç"}
                    </option>
                    {filteredDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Vəzifə">
                  <select
                    value={editForm.position_id}
                    onChange={(e) => setEditForm((p) => ({ ...p, position_id: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                  >
                    <option value="">Vəzifə seç</option>
                    {meta.positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Rol">
                  <select
                    value={editForm.role_id}
                    onChange={(e) => setEditForm((p) => ({ ...p, role_id: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                  >
                    <option value="">Rol seç</option>
                    {meta.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {/* GUIDES */}
            {editTab === "GUIDES" && (
              <div className="mt-5">
                <GuideMultiDropdown
                  label="Rəhbər(lər) seç"
                  options={guideOptions}
                  selectedIds={editForm.guide_ids}
                  setSelectedIds={(ids) => setEditForm((p) => ({ ...p, guide_ids: ids }))}
                />
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex flex-col md:flex-row gap-2">
              <button
                onClick={saveEdit}
                disabled={busyId === edit?.id}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl font-black text-white",
                  busyId === edit?.id ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {busyId === edit?.id ? "Yadda saxlanılır..." : "✅ Yadda saxla"}
              </button>

              <button
                onClick={closeEdit}
                className="flex-1 px-4 py-3 rounded-xl font-black border bg-white hover:bg-slate-50"
              >
                Ləğv et
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ---------- UI Pieces ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-extrabold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function TabBtn({ title, active, onClick }: { title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl border font-black text-sm",
        active ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-50"
      )}
    >
      {title}
    </button>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mouseDown, setMouseDown] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/55 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setMouseDown(true);
      }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget && mouseDown) onClose();
        setMouseDown(false);
      }}
    >
      {children}
    </div>
  );
}

/* ---------- MultiSelectPortal (chip + portal dropdown) ---------- */

function MultiSelectPortal({
  placeholder,
  options,
  selectedValues,
  onChange,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360 });

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const selectedLabels = useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]));
    return selectedValues.map((v) => m.get(v) || v).filter(Boolean);
  }, [options, selectedValues]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 120);
    return options.filter((o) => o.label.toLowerCase().includes(s)).slice(0, 120);
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
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedLabels.map((lab, idx) => (
            <div
              key={`${lab}-${idx}`}
              className="px-3 py-2 rounded-full bg-blue-600 text-white font-black text-sm flex items-center gap-2 shadow"
            >
              {lab}
              <button
                type="button"
                className="w-6 h-6 grid place-items-center rounded-full bg-white/20 hover:bg-white/30"
                onClick={() => onChange(selectedValues.filter((_, i) => i !== idx))}
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
          "w-full border rounded-xl px-4 py-3 font-extrabold cursor-pointer flex items-center justify-between",
          open ? "border-blue-600 bg-blue-50" : "bg-white hover:bg-slate-50"
        )}
      >
        <span className={cn(selectedValues.length ? "text-slate-900" : "text-slate-400")}>
          {selectedValues.length ? `${selectedValues.length} seçildi` : placeholder}
        </span>
        <span className="text-blue-600">{open ? "▲" : "▼"}</span>
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[99999] bg-white border rounded-2xl overflow-hidden shadow-2xl"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            <div className="p-3 bg-slate-50 border-b">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Axtar..."
                autoFocus
                className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div className="max-h-[260px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-3 text-sm text-slate-500 font-bold">Nəticə tapılmadı</div>
              )}

              {filtered.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <div
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "px-3 py-3 cursor-pointer border-b flex items-center gap-3",
                      checked ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 grid place-items-center font-black",
                        checked ? "border-blue-600 text-blue-600" : "border-slate-300 text-slate-300"
                      )}
                    >
                      {checked ? "✓" : ""}
                    </div>
                    <div className="font-extrabold text-slate-900">{o.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 border-t flex gap-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 rounded-xl border font-black bg-white hover:bg-slate-100"
                onClick={() => onChange([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-2 rounded-xl font-black bg-blue-600 text-white hover:bg-blue-700"
                onClick={close}
              >
                Done
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

/* ---------- GuideMultiDropdown (chip + portal dropdown) ---------- */

function GuideMultiDropdown({
  label,
  options,
  selectedIds,
  setSelectedIds,
}: {
  label: string;
  options: { value: string; label: string }[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360 });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selected = useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]));
    return selectedIds.map((id) => ({ id, label: m.get(id) || id }));
  }, [options, selectedIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 120);
    return options.filter((o) => o.label.toLowerCase().includes(s)).slice(0, 120);
  }, [options, q]);

  function toggle(val: string) {
    if (selectedSet.has(val)) setSelectedIds(selectedIds.filter((x) => x !== val));
    else setSelectedIds([...selectedIds, val]);
  }

  return (
    <div>
      <Field label={label}>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selected.map((x) => (
              <div
                key={x.id}
                className="px-3 py-2 rounded-full bg-blue-600 text-white font-black text-sm flex items-center gap-2 shadow"
              >
                {x.label}
                <button
                  type="button"
                  className="w-6 h-6 grid place-items-center rounded-full bg-white/20 hover:bg-white/30"
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
            "w-full border rounded-xl px-4 py-3 font-extrabold cursor-pointer flex items-center justify-between",
            open ? "border-blue-600 bg-blue-50" : "bg-white hover:bg-slate-50"
          )}
        >
          <span className={cn(selectedIds.length ? "text-slate-900" : "text-slate-400")}>
            {selectedIds.length ? `${selectedIds.length} rəhbər seçildi` : "Rəhbər seç"}
          </span>
          <span className="text-blue-600">{open ? "▲" : "▼"}</span>
        </div>

        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[99999] bg-white border rounded-2xl overflow-hidden shadow-2xl"
              style={{ left: pos.left, top: pos.top, width: pos.width }}
            >
              <div className="p-3 bg-slate-50 border-b">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Axtar..."
                  autoFocus
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div className="max-h-[260px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="p-3 text-sm text-slate-500 font-bold">Nəticə tapılmadı</div>
                )}

                {filtered.map((o) => {
                  const checked = selectedSet.has(o.value);
                  return (
                    <div
                      key={o.value}
                      onClick={() => toggle(o.value)}
                      className={cn(
                        "px-3 py-3 cursor-pointer border-b flex items-center gap-3",
                        checked ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg border-2 grid place-items-center font-black",
                          checked ? "border-blue-600 text-blue-600" : "border-slate-300 text-slate-300"
                        )}
                      >
                        {checked ? "✓" : ""}
                      </div>
                      <div className="font-extrabold text-slate-900">{o.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-slate-50 border-t flex gap-2">
                <button
                  type="button"
                  className="flex-1 px-3 py-2 rounded-xl border font-black bg-white hover:bg-slate-100"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="flex-1 px-3 py-2 rounded-xl font-black bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => setOpen(false)}
                >
                  Done
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