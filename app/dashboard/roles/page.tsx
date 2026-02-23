"use client";

import { useEffect, useState } from "react";

type Role = {
  id: string;
  name: string;
};

export default function RolesPage() {
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
    if (!confirm("Silinsin?")) return;

    await fetch(`/api/roles?id=${id}`, {
      method: "DELETE",
    });

    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">
          Rollar
        </h1>

        {/* Create */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yeni rol adı"
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />

          <button
            onClick={createRole}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Əlavə et
          </button>
        </div>

        {/* List */}
        {loading ? (
          <p>Yüklənir...</p>
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
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
