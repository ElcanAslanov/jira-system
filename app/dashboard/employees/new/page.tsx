"use client";

import { useEffect, useState, useRef } from "react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

type Option = {
  id: string;
  name: string;
  company_id?: string;
};

export default function NewEmployeePage() {

  const { lang } = useLang();
  const t = translations[lang];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [companies, setCompanies] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [guides, setGuides] = useState<Option[]>([]);

  const [selectedCompany, setSelectedCompany] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/employees/meta");
      const data = await res.json();

      setCompanies(data.companies || []);
      setDepartments(data.departments || []);
      setPositions(data.positions || []);
      setRoles(data.roles || []);
      setGuides(data.guides || []);
    };

    fetchData();
  }, []);

  const guideRef = useRef<HTMLDivElement | null>(null);

  const filteredDepartments = departments.filter(
    (d) => d.company_id === selectedCompany
  );

  const [hasGuide, setHasGuide] = useState(false);
  const [selectedGuides, setSelectedGuides] = useState<Option[]>([]);
  const [guideSearch, setGuideSearch] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        guideRef.current &&
        !guideRef.current.contains(event.target as Node)
      ) {
        setGuideOpen(false);
      }
    }

    if (guideOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [guideOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;

    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(form);

    if (hasGuide && selectedGuides.length > 0) {
      selectedGuides.forEach((g) => {
        formData.append("guide_ids", g.id);
      });
    }

    try {
      const res = await fetch("/api/employees/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || t.serverError);
      } else {
        setSuccess(t.employeeCreated);
        form.reset();
        setSelectedCompany("");
      }
    } catch (err: any) {
      setError(err?.message || "Server xətası");
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1100px",
        margin: "0 auto",
        padding: 16,
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>
        ➕ {t.addEmployee}
      </h1>

      <p style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
        {t.addEmployeeDesc}
      </p>

      <div style={{ marginTop: 18, ...card }}>
        <div style={cardHeader}>
          <b>{t.employeeInfo}</b>
        </div>

        <div style={{ padding: 18 }}>
          {error && (
            <div style={errorBox}>
              {error}
            </div>
          )}

          {success && (
            <div style={successBox}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={grid}>
              <Field label={t.email}>
                <input name="email" required style={input} />
              </Field>

              <Field label={t.password}>
                <input
                  name="password"
                  type="password"
                  required
                  style={input}
                />
              </Field>

              <Field label={t.name}>
                <input name="ad" required style={input} />
              </Field>

              <Field label={t.surname}>
                <input name="soyad" required style={input} />
              </Field>

              <Field label={t.fatherName}>
                <input name="ata_adi" style={input} />
              </Field>

              <Field label={t.phone}>
                <input name="elaqe_nomresi" style={input} />
              </Field>

              <Field label={t.company}>
                <select
                  name="company_id"
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  style={input}
                >
                  <option value="">{t.selectCompany}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t.department}>
                <select
                  name="department_id"
                  disabled={!selectedCompany}
                  style={{
                    ...input,
                    background: !selectedCompany ? "#f3f4f6" : "#fff",
                  }}
                >
                  <option value="">
                    {selectedCompany
                      ? t.selectDepartment
                      : t.selectCompanyFirst}
                  </option>
                  {filteredDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t.position}>
                <select name="position_id" style={input}>
                  <option value="">{t.selectPosition}</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t.role}>
                <select name="role_id" style={input}>
                  <option value="">{t.selectRole}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t.addGuide}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={hasGuide}
                    onChange={(e) => {
                      setHasGuide(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedGuides([]);
                        setGuideOpen(false);
                      }
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {t.wantGuide}
                  </span>
                </div>
              </Field>

              {hasGuide && (
                <div
                  ref={guideRef}
                  style={{
                    gridColumn: "1 / -1",
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  <Field label={t.selectGuide}>
                    {/* Selected chips */}
                    {selectedGuides.length > 0 && (
                      <div style={chipWrap}>
                        {selectedGuides.map((g) => (
                          <div key={g.id} style={chip}>
                            <span>{g.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedGuides(
                                  selectedGuides.filter((x) => x.id !== g.id)
                                )
                              }
                              style={chipBtn}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dropdown trigger */}
                    <div
                      onClick={() => setGuideOpen((p) => !p)}
                      style={{
                        ...input,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontWeight: 800,
                        border: guideOpen ? "2px solid #2563eb" : "1px solid #d1d5db",
                        background: guideOpen ? "#eff6ff" : "#fff",
                      }}
                    >
                      <span>
                        {selectedGuides.length
                          ? `${selectedGuides.length} ${t.guidesSelected}`
                          : t.selectGuide}
                      </span>
                      <span style={{ color: "#2563eb", fontWeight: 900 }}>
                        {guideOpen ? "▲" : "▼"}
                      </span>
                    </div>

                    {guideOpen && (
                      <div style={dropdownBox}>
                        <div style={searchWrap}>
                          <input
                            value={guideSearch}
                            onChange={(e) => setGuideSearch(e.target.value)}
                            placeholder={t.search}
                            style={searchInput}
                            autoFocus
                          />
                        </div>

                        <div style={listWrap}>
                          {guides
                            .filter((g) =>
                              g.name.toLowerCase().includes(guideSearch.toLowerCase())
                            )
                            .map((g) => {
                              const selected = selectedGuides.some(
                                (x) => x.id === g.id
                              );

                              return (
                                <div
                                  key={g.id}
                                  onClick={() => {
                                    if (selected) {
                                      setSelectedGuides(
                                        selectedGuides.filter((x) => x.id !== g.id)
                                      );
                                    } else {
                                      setSelectedGuides([...selectedGuides, g]);
                                    }
                                  }}
                                  style={{
                                    ...listItem,
                                    background: selected ? "#eff6ff" : "#fff",
                                    borderLeft: selected
                                      ? "4px solid #2563eb"
                                      : "4px solid transparent",
                                  }}
                                >
                                  <div style={checkboxUI}>
                                    {selected ? "✓" : ""}
                                  </div>
                                  <div style={{ fontWeight: 800 }}>
                                    {g.name}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </Field>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 20,
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? t.loading : t.add}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI Components ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ---------- Styles ---------- */

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  boxShadow: "0 10px 32px rgba(0,0,0,0.05)",
  overflow: "visible", // ✅ VACİB
};

const cardHeader: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb",
  fontWeight: 900,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  outline: "none",
  fontSize: 14,
};

const errorBox: React.CSSProperties = {
  marginBottom: 14,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  padding: 12,
  borderRadius: 10,
  fontSize: 13,
  color: "#991b1b",
  fontWeight: 700,
};

const successBox: React.CSSProperties = {
  marginBottom: 14,
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  padding: 12,
  borderRadius: 10,
  fontSize: 13,
  color: "#065f46",
  fontWeight: 700,
};

const dropdownBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
  position: "absolute",
  top: "100%",
  left: 0,
  width: "100%",
  marginBottom: 8,
  zIndex: 9999,
};

const searchWrap: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #f1f5f9",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  outline: "none",
  fontSize: 14,
  fontWeight: 800,
};

const listWrap: React.CSSProperties = {
  maxHeight: 180, // daha kompakt
  overflowY: "auto",
};

const listItem: React.CSSProperties = {
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  borderBottom: "1px solid #f1f5f9",
};

const checkboxUI: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 7,
  border: "2px solid #2563eb",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: 13,
  color: "#2563eb",
};

const chipWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 8,
};

const chip: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#2563eb",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
};

const chipBtn: React.CSSProperties = {
  border: "none",
  background: "rgba(255,255,255,0.2)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
  width: 22,
  height: 22,
  borderRadius: 999,
};