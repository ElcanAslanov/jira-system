"use client";

import { useEffect, useMemo, useState } from "react";
import { translations } from "@/lib/translations";
import { useLang } from "@/context/LanguageContext";

type Company = {
  id: string;
  name: string;
  created_at?: string;
};

export default function CompaniesPage() {

  const { lang } = useLang();
  const t = translations[lang];
  const [items, setItems] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => x.name.toLowerCase().includes(q));
  }, [items, search]);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Xəta baş verdi");
      setItems(data.companies || []);
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createCompany = async () => {
    setMsg(null);
    const v = name.trim();
    if (!v) return setMsg({ type: "err", text: t.emptyName });

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Yaratmaq alınmadı");

      setItems((prev) => [data.company, ...prev]);
      setName("");
      setMsg({ type: "ok", text: t.created });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    }
  };

  const startEdit = (c: Company) => {
    setEditId(c.id);
    setEditName(c.name);
    setMsg(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  const saveEdit = async () => {
    if (!editId) return;
    const v = editName.trim();
    if (!v) return setMsg({ type: "err", text: "Şirkət adı boş ola bilməz" });

    setBusyId(editId);
    setMsg(null);
    try {
      const res = await fetch("/api/companies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, name: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Yeniləmək alınmadı");

      setItems((prev) => prev.map((x) => (x.id === editId ? data.company : x)));
      setMsg({ type: "ok", text: t.updated });
      cancelEdit();
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    const ok = confirm(t.confirmDelete);
    if (!ok) return;

    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/companies?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Silmək alınmadı");

      setItems((prev) => prev.filter((x) => x.id !== id));
      setMsg({ type: "ok", text: t.deleted });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setBusyId(null);
    }
  };



  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">

          <h1 className="text-2xl font-bold">{t.companies}</h1>

          <div className="w-full md:w-80">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />
          </div>
        </div>

        {msg && (
          <div
            className={`p-3 rounded mb-4 ${msg.type === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
          >
            {msg.text}
          </div>
        )}

        {/* Create */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.newCompany}
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />
          <button
            onClick={createCompany}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-3 transition"
          >
            {t.add}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-gray-500">{t.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500">{t.notFound}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                {editId === c.id ? (
                  <div className="flex-1 flex flex-col md:flex-row gap-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busyId === c.id}
                        onClick={saveEdit}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-3 transition disabled:opacity-60"
                      >
                        {t.save}
                      </button>
                      <button
                        disabled={busyId === c.id}
                        onClick={cancelEdit}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg px-4 py-3 transition disabled:opacity-60"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="font-semibold">{c.name}</div>                      
                    </div>

                    <div className="flex gap-2">
                      <button
                        disabled={busyId === c.id}
                        onClick={() => startEdit(c)}
                        className="bg-white border border-gray-300 hover:bg-gray-50 rounded-lg px-4 py-2 transition disabled:opacity-60"
                      >
                        {t.edit}
                      </button>
                      <button
                        disabled={busyId === c.id}
                        onClick={() => remove(c.id)}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 transition disabled:opacity-60"
                      >
                        {t.delete}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
