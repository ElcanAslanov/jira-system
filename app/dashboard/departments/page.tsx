"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

type Company = { id: string; name: string };

type Department = {
  id: string;
  name: string;
  company_id: string;
  companies?: { name: string };
};

export default function DepartmentsPage() {

  const { lang } = useLang();
  const t = translations[lang];

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [cRes, dRes] = await Promise.all([
      fetch("/api/companies"),
      fetch("/api/departments"),
    ]);

    const cData = await cRes.json();
    const dData = await dRes.json();

    setCompanies(cData.companies || []);
    setDepartments(dData.departments || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createDepartment = async () => {

    if (!name.trim()) {
      alert(t.emptyDepartmentName);
      return;
    }

    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, company_id: companyId }),
    });

    const data = await res.json();

    if (res.ok) {
      setDepartments((prev) => [data.department, ...prev]);
      setName("");
      setCompanyId("");
    } else {
      alert(data.error);
    }
  };

  const remove = async (id: string) => {

    if (!confirm(t.confirmDelete)) return;

    await fetch(`/api/departments?id=${id}`, {
      method: "DELETE",
    });

    setDepartments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow p-6 md:p-8">

        <h1 className="text-2xl font-bold mb-6">
          {t.departments}
        </h1>

        {/* Create */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.departmentName}
            className="input-style"
          />

          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="input-style"
          >
            <option value="">
              {t.selectCompany}
            </option>

            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}

          </select>

          <button
            onClick={createDepartment}
            className="bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition"
          >
            {t.add}
          </button>

        </div>

        {/* List */}

        {loading ? (

          <p>{t.loading}</p>

        ) : (

          <div className="space-y-3">

            {departments.map((d) => (

              <div
                key={d.id}
                className="border rounded-lg p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-2"
              >

                <div>
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-gray-500">
                    {d.companies?.name}
                  </div>
                </div>

                <button
                  onClick={() => remove(d.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
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