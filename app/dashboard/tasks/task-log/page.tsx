"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

export default function TaskLogPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadDeletedTasks();
  }, []);

  /* ================= TOKEN ================= */

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  /* ================= LOAD ================= */

  async function loadDeletedTasks() {
    const token = await getToken();

    const res = await fetch("/api/tasks?deleted=true", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setTasks(data.tasks || []);
  }

  /* ================= RESTORE ================= */

  async function restoreTask(id: string) {
    const ok = confirm("Task geri qaytarılsın?");
    if (!ok) return;

    setLoadingId(id);

    const token = await getToken();

    await fetch("/api/tasks", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, action: "restore" }),
    });

    await loadDeletedTasks();
    setLoadingId(null);
  }

  /* ================= HARD DELETE ================= */

  async function hardDeleteTask(id: string) {
    const ok = confirm("Bu taskı TAM silmək istəyirsən?");
    if (!ok) return;

    setLoadingId(id);

    const token = await getToken();

    await fetch("/api/tasks", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, hard: true }), // ✅ REAL HARD DELETE
    });

    await loadDeletedTasks();
    setLoadingId(null);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Task Log</h1>

      {tasks.length === 0 && (
        <p className="text-gray-500">Silinmiş task yoxdur</p>
      )}

      <div className="space-y-3">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="border rounded-xl p-4 flex justify-between items-start shadow-sm hover:shadow-md transition"
          >
            {/* LEFT SIDE */}
            <div>
              <p className="font-semibold text-lg">{t.title}</p>

              {t.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {t.description}
                </p>
              )}

              <p className="text-xs text-gray-500 mt-2">
                🗑 Silinmə vaxtı:{" "}
                {t.deleted_at
                  ? new Date(t.deleted_at).toLocaleString()
                  : "-"}
              </p>

              <p className="text-xs text-gray-500">
                👤 Silən:{" "}
                {t.deleter
                  ? `${t.deleter.ad ?? ""} ${t.deleter.soyad ?? ""}`
                  : "-"}
              </p>

              <p className="text-xs text-gray-500">
                📌 Təyin olunanlar:{" "}
                {t.assigned_to?.length
                  ? t.assigned_to.join(", ")
                  : "-"}
              </p>
            </div>

            {/* BUTTONS */}
            <div className="flex gap-2">
              <button
                disabled={loadingId === t.id}
                onClick={() => restoreTask(t.id)}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loadingId === t.id ? "..." : "♻️ Geri yüklə"}
              </button>

              <button
                disabled={loadingId === t.id}
                onClick={() => hardDeleteTask(t.id)}
                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loadingId === t.id ? "..." : "❌ Tam sil"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}