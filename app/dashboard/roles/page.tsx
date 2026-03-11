"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

type Role = {
  id: string;
  name: string;
};

export default function RolesPage() {

  const { lang } = useLang();
  const t = translations[lang];

  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch("/api/roles");
    const data = await res.json();
    setRoles(data.roles || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createRole = async () => {

    if (!name.trim()) {
      alert(t.emptyRoleName);
      return;
    }

    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();

    if (res.ok) {
      setRoles((prev) => [data.role, ...prev]);
      setName("");
    } else {
      alert(data.error);
    }
  };

  const remove = async (id: string) => {

    if (!confirm(t.confirmDelete)) return;

    await fetch(`/api/roles?id=${id}`, {
      method: "DELETE",
    });

    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow p-6 md:p-8">

        <h1 className="text-2xl font-bold mb-6">
          {t.roles}
        </h1>

        {/* Create */}

        <div className="flex flex-col md:flex-row gap-4 mb-6">

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.newRole}
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />

          <button
            onClick={createRole}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            {t.add}
          </button>

        </div>

        {/* List */}

        {loading ? (
          <p>{t.loading}</p>
        ) : (
          <div className="space-y-3">

            {roles.map((r) => (

              <div
                key={r.id}
                className="border rounded-lg p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3"
              >

                <div className="font-semibold">
                  {r.name}
                </div>

                <button
                  onClick={() => remove(r.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                >
                  {t.delete}
                </button>

              </div>

            ))}

          </div>
        )}

      </div>
    </div>
  );
}