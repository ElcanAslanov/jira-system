"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";


type Rule = {
  id: string;
  title: string;
  description: string | null;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  week_days: number[] | null; // ✅ BURAYA ƏLAVƏ ET
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

function formatDMY(date: string | null) {
  if (!date) return "-";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function DrawerRow({ label, value }: { label: string; value: any }) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 10,
      }}
      className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2"
    >
      <div style={{ fontWeight: 900, fontSize: 13 }} className="text-xs sm:text-[13px]">
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13 }} className="text-xs sm:text-[13px]">
        {value ?? "-"}
      </div>
    </div>
  );
}

function translateFrequency(freq: string) {
  if (freq === "DAILY") return "Gündəlik";
  if (freq === "WEEKLY") return "Həftəlik";
  if (freq === "MONTHLY") return "Aylıq";
  return freq;
}

export default function RecurringPage() {
  const [viewRule, setViewRule] = useState<Rule | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { user, loading } = useUser();
  const router = useRouter();

  const [permissions, setPermissions] = useState<string[]>([]);

  const can = (key: string) => permissions.includes(key);

  const [rules, setRules] = useState<Rule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  /* ================= LOAD DATA ================= */

  const loadData = async () => {
    setLoadingData(true);

    const { data: rulesData } = await supabase
      .from("recurring_rules")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: empData } = await supabase.from("employees").select("id, ad, soyad");

    setRules(rulesData || []);
    setEmployees(empData || []);
    setLoadingData(false);
  };

  useEffect(() => {
    if (!loading && user) loadData();
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

      let finalPerms =
        rolePerms?.map((p: any) => p.permission_key) || [];

      if (userPerms) {
        userPerms.forEach((p: any) => {
          if (p.allowed === true && !finalPerms.includes(p.permission_key)) {
            finalPerms.push(p.permission_key);
          }
          if (p.allowed === false) {
            finalPerms = finalPerms.filter(
              (k) => k !== p.permission_key
            );
          }
        });
      }

      setPermissions(finalPerms);
    }

    loadPermissions();
  }, [user?.id]);

  /* ================= ACTIONS ================= */

  const toggleActive = async (rule: Rule) => {
    await supabase
      .from("recurring_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);

    loadData();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Bu dövrlü tapşırıq silinsin?")) return;

    await supabase.from("recurring_rules").delete().eq("id", id);

    loadData();
  };

  const employeesById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const e of employees) map.set(e.id, e);
    return map;
  }, [employees]);

  const openDrawer = (r: Rule) => {
    setViewRule(r);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setViewRule(null), 220);
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">🌀 Dövrlü Tapşırıqlar</h1>

        </div>

        {loadingData ? (
          <div>Yüklənir...</div>
        ) : rules.length === 0 ? (
          <div className="text-gray-500">Dövrlü tapşırıq yoxdur.</div>
        ) : (
          <>
            {/* ================= DESKTOP/TABLE (lg+) ================= */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm border rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Ad</th>
                    <th className="p-3 text-left">Tezlik</th>
                    <th className="p-3 text-left">İnterval</th>
                    <th className="p-3 text-left">Həftənin günləri</th>
                    <th className="p-3 text-left">Başlama</th>
                    <th className="p-3 text-left">Bitmə</th>
                    <th className="p-3 text-left">Növbəti</th>
                    <th className="p-3 text-left">Təyin edilənlər</th>
                    <th className="p-3 text-left">Fayl</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Əməliyyat</th>
                  </tr>
                </thead>

                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{r.title}</td>

                      <td className="p-3">{translateFrequency(r.frequency)}</td>

                      <td className="p-3">{r.interval}</td>
                      <td className="p-3">
                        {r.frequency === "WEEKLY" && r.week_days?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.week_days.map((d) => {
                              const map: Record<number, string> = {
                                1: "B.e",
                                2: "Ç.a",
                                3: "Ç",
                                4: "C.a",
                                5: "C",
                                6: "Ş",
                                0: "B",
                              };

                              return (
                                <span
                                  key={d}
                                  className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs"
                                >
                                  {map[d]}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="p-3">{formatDMY(r.start_date)}</td>

                      <td className="p-3">{formatDMY(r.end_date)}</td>

                      <td className="p-3">{formatDMY(r.next_run_date)}</td>

                      {/* ASSIGNED USERS */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {r.assigned_to?.map((id) => {
                            const emp = employeesById.get(id);
                            if (!emp) return null;

                            return (
                              <span
                                key={id}
                                className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs"
                              >
                                {emp.ad} {emp.soyad}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* FILE COUNT */}
                      <td className="p-3">
                        {r.files && r.files.length > 0 ? (
                          <button
                            onClick={() => openDrawer(r)}
                            className="text-indigo-600 text-xs hover:underline"
                          >
                            📎 {r.files.length} fayl
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="p-3">
                        {r.is_active ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                            Aktiv
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-600">
                            Dayandırılıb
                          </span>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">

                        {can("recurring.view.button") && (
                          <button
                            onClick={() => openDrawer(r)}
                            className="border px-3 py-1.5 rounded-lg text-xs"
                          >
                            Bax
                          </button>
                        )}

                        {can("recurring.pause.button") && (
                          <button
                            onClick={() => toggleActive(r)}
                            className="border px-3 py-1.5 rounded-lg text-xs"
                          >
                            {r.is_active ? "Pause" : "Resume"}
                          </button>
                        )}

                        {can("recurring.delete.button") && (
                          <button
                            onClick={() => deleteRule(r.id)}
                            className="border px-3 py-1.5 rounded-lg text-xs text-red-600 border-red-200"
                          >
                            Sil
                          </button>
                        )}

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ================= MOBILE/TABLET CARDS (<lg) ================= */}
            <div className="lg:hidden grid gap-4">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-base truncate">{r.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {translateFrequency(r.frequency)} • interval: {r.interval}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {r.is_active ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                          Aktiv
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-600">
                          Dayandırılıb
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="font-extrabold text-gray-700">Başlama</div>
                      <div className="font-semibold mt-1">{formatDMY(r.start_date)}</div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="font-extrabold text-gray-700">Bitmə</div>
                      <div className="font-semibold mt-1">{formatDMY(r.end_date)}</div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="font-extrabold text-gray-700">Növbəti</div>
                      <div className="font-semibold mt-1">{formatDMY(r.next_run_date)}</div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="font-extrabold text-gray-700">Fayl</div>
                      <div className="font-semibold mt-1">
                        {r.files && r.files.length > 0 ? (
                          <button
                            onClick={() => openDrawer(r)}
                            className="text-indigo-600 hover:underline"
                          >
                            📎 {r.files.length} fayl
                          </button>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assigned */}
                  <div className="mt-3">
                    <div className="text-xs font-extrabold text-gray-700 mb-2">
                      Təyin edilənlər
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.assigned_to?.length ? (
                        r.assigned_to.map((id) => {
                          const emp = employeesById.get(id);
                          if (!emp) return null;
                          return (
                            <span
                              key={id}
                              className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs"
                            >
                              {emp.ad} {emp.soyad}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">

                    {can("recurring.view.button") && (
                      <button
                        onClick={() => openDrawer(r)}
                        className="border px-3 py-2 rounded-xl text-xs w-full sm:w-auto"
                      >
                        Bax
                      </button>
                    )}

                    {can("recurring.pause.button") && (
                      <button
                        onClick={() => toggleActive(r)}
                        className="border px-3 py-2 rounded-xl text-xs w-full sm:w-auto"
                      >
                        {r.is_active ? "Pause" : "Resume"}
                      </button>
                    )}

                    {can("recurring.delete.button") && (
                      <button
                        onClick={() => deleteRule(r.id)}
                        className="border px-3 py-2 rounded-xl text-xs text-red-600 border-red-200 w-full sm:w-auto"
                      >
                        Sil
                      </button>
                    )}

                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ================= DRAWER ================= */}
      {viewRule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            zIndex: 100000,
            display: "flex",
            justifyContent: "flex-end",
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? "auto" : "none",
            transition: "opacity 0.22s ease",
          }}
          onClick={closeDrawer}
        >
          <div
            style={{
              width: 550,
              height: "100%",
              background: "#fff",
              padding: 24,
              overflowY: "auto",
              boxShadow: "-30px 0 90px rgba(15,23,42,0.40)",
              transform: drawerOpen ? "translateX(0)" : "translateX(110%)",
              transition: "transform 0.22s ease",
            }}
            className="w-full sm:w-[550px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>🌀 Dövrlü tapşırıq</h2>
              <button onClick={closeDrawer}>✖</button>
            </div>

            <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
              <DrawerRow label="Ad" value={viewRule.title} />

              <DrawerRow
                label="Tezlik"
                value={translateFrequency(viewRule.frequency)}
              />

              <DrawerRow label="İnterval" value={viewRule.interval} />

              <DrawerRow
                label="Həftənin günləri"
                value={
                  viewRule.frequency === "WEEKLY" && viewRule.week_days?.length ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {viewRule.week_days.map((d) => {
                        const map: Record<number, string> = {
                          1: "B.e",
                          2: "Ç.a",
                          3: "Ç",
                          4: "C.a",
                          5: "C",
                          6: "Ş",
                          0: "B",
                        };
                        return (
                          <span
                            key={d}
                            className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs"
                          >
                            {map[d]}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    "-"
                  )
                }
              />

              <DrawerRow
                label="Başlama"
                value={formatDMY(viewRule.start_date)}
              />

              <DrawerRow
                label="Bitmə"
                value={formatDMY(viewRule.end_date)}
              />

              <DrawerRow
                label="Növbəti icra"
                value={formatDMY(viewRule.next_run_date)}
              />

              {/* Assigned in drawer (extra, does not remove anything) */}
              <DrawerRow
                label="Təyin edilənlər"
                value={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {viewRule.assigned_to?.length ? (
                      viewRule.assigned_to.map((id) => {
                        const emp = employeesById.get(id);
                        if (!emp) return null;
                        return (
                          <span
                            key={id}
                            className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs"
                          >
                            {emp.ad} {emp.soyad}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </div>
                }
              />

              {viewRule.files?.length ? (
                <DrawerRow
                  label="Fayllar"
                  value={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {viewRule.files.map((f: any, i: number) => (
                        <button
                          key={i}
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from("task-files")
                              .createSignedUrl(f.path, 60);

                            if (data?.signedUrl) {
                              window.open(data.signedUrl, "_blank");
                            }
                          }}
                          style={{
                            padding: "6px 10px",
                            background: "#eff6ff",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          📎 {f.name}
                        </button>
                      ))}
                    </div>
                  }
                />
              ) : null}
            </div>

            {/* Extra space at bottom on mobile for comfort */}
            <div className="h-10" />
          </div>
        </div>
      )}
    </div>
  );
}