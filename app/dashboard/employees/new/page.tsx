"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";

type Option = {
  id: string;
  name: string;
  company_id?: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function NewEmployeePage() {
  const { lang } = useLang();
  const t = translations[lang];

  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [companies, setCompanies] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [guides, setGuides] = useState<Option[]>([]);

  const [selectedCompany, setSelectedCompany] = useState("");

  const guideRef = useRef<HTMLDivElement | null>(null);

  const [hasGuide, setHasGuide] = useState(false);
  const [selectedGuides, setSelectedGuides] = useState<Option[]>([]);
  const [guideSearch, setGuideSearch] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      try {
        setMetaLoading(true);

        const res = await fetch("/api/employees/meta", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!alive) return;

        setCompanies(data.companies || []);
        setDepartments(data.departments || []);
        setPositions(data.positions || []);
        setRoles(data.roles || []);
        setGuides(data.guides || []);
      } catch (err: any) {
        console.error("Meta load error:", err);
        if (alive) {
          setError(err?.message || t.serverError || "Server xətası");
        }
      } finally {
        if (alive) {
          setMetaLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      alive = false;
    };
  }, [t.serverError]);

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => d.company_id === selectedCompany);
  }, [departments, selectedCompany]);

  const filteredGuides = useMemo(() => {
    const q = guideSearch.trim().toLowerCase();

    if (!q) return guides;

    return guides.filter((g) => g.name.toLowerCase().includes(q));
  }, [guides, guideSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (guideRef.current && !guideRef.current.contains(event.target as Node)) {
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

  const resetGuideState = () => {
    setHasGuide(false);
    setSelectedGuides([]);
    setGuideSearch("");
    setGuideOpen(false);
  };

  const toggleGuide = (guide: Option) => {
    const selected = selectedGuides.some((x) => x.id === guide.id);

    if (selected) {
      setSelectedGuides((prev) => prev.filter((x) => x.id !== guide.id));
    } else {
      setSelectedGuides((prev) => [...prev, guide]);
    }
  };

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
        resetGuideState();
      }
    } catch (err: any) {
      setError(err?.message || "Server xətası");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header - köhnə kimi sadə, amma modern */}
      <div className="mb-5">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
          <UserPlus size={14} />
          Task Flow
        </div>

        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          {t.addEmployee}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {t.addEmployeeDesc}
        </p>
      </div>

      {/* Old style single card */}
      <div className="overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div>
            <h2 className="text-base font-black text-slate-950">
              {t.employeeInfo}
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Məlumatları doldurun və əlavə et düyməsinə klikləyin.
            </p>
          </div>

          <div className="hidden h-10 w-10 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526] sm:grid">
            <Plus size={18} />
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {error && (
            <AlertBox type="error" text={error} onClose={() => setError("")} />
          )}

          {success && (
            <AlertBox
              type="success"
              text={success}
              onClose={() => setSuccess("")}
            />
          )}

          {metaLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t.email}>
                  <input
                    name="email"
                    type="email"
                    required
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  />
                </Field>

                <Field label={t.password}>
                  <input
                    name="password"
                    type="password"
                    required
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  />
                </Field>

                <Field label={t.name}>
                  <input
                    name="ad"
                    required
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  />
                </Field>

                <Field label={t.surname}>
                  <input
                    name="soyad"
                    required
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  />
                </Field>

                <Field label={t.fatherName}>
                  <input
                    name="ata_adi"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  />
                </Field>

                <Field label={t.phone}>
                  <input
                    name="elaqe_nomresi"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  />
                </Field>

                <Field label={t.company}>
                  <select
                    name="company_id"
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
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
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                  <select
                    name="position_id"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  >
                    <option value="">{t.selectPosition}</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t.role}>
                  <select
                    name="role_id"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-[#e42526] focus:bg-white focus:ring-4 focus:ring-[#e42526]/10"
                  >
                    <option value="">{t.selectRole}</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t.addGuide}>
                  <label className="flex h-12 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition hover:bg-white">
                    <input
                      type="checkbox"
                      checked={hasGuide}
                      onChange={(e) => {
                        setHasGuide(e.target.checked);
                        if (!e.target.checked) {
                          setSelectedGuides([]);
                          setGuideSearch("");
                          setGuideOpen(false);
                        }
                      }}
                      className="h-5 w-5 rounded border-slate-300 accent-[#e42526]"
                    />
                    <span className="text-sm font-black text-slate-700">
                      {t.wantGuide}
                    </span>
                  </label>
                </Field>

                {hasGuide && (
                  <div
                    ref={guideRef}
                    className="relative col-span-1 overflow-visible sm:col-span-2 lg:col-span-3"
                  >
                    <Field label={t.selectGuide}>
                      {selectedGuides.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {selectedGuides.map((g) => (
                            <div
                              key={g.id}
                              className="flex items-center gap-2 rounded-full bg-[#e42526] px-3 py-1.5 text-xs font-black text-white shadow-sm"
                            >
                              <span>{g.name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedGuides((prev) =>
                                    prev.filter((x) => x.id !== g.id)
                                  )
                                }
                                className="grid h-5 w-5 place-items-center rounded-full bg-white/20 transition hover:bg-white/30"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setGuideOpen((p) => !p)}
                        className={cn(
                          "flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-black transition",
                          guideOpen
                            ? "border-[#e42526] bg-[#fff1f1] text-[#c91f20] ring-4 ring-[#e42526]/10"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                        )}
                      >
                        <span
                          className={cn(
                            selectedGuides.length
                              ? "text-slate-900"
                              : "text-slate-400"
                          )}
                        >
                          {selectedGuides.length
                            ? `${selectedGuides.length} ${t.guidesSelected}`
                            : t.selectGuide}
                        </span>

                        <ChevronDown
                          size={17}
                          className={cn("transition", guideOpen && "rotate-180")}
                        />
                      </button>

                      {guideOpen && (
                        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                          <div className="border-b border-slate-200 bg-slate-50 p-3">
                            <div className="relative">
                              <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                              />
                              <input
                                value={guideSearch}
                                onChange={(e) => setGuideSearch(e.target.value)}
                                placeholder={t.search}
                                autoFocus
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold outline-none focus:border-[#e42526] focus:ring-4 focus:ring-[#e42526]/10"
                              />
                            </div>
                          </div>

                          <div className="max-h-[220px] overflow-y-auto">
                            {filteredGuides.length === 0 && (
                              <div className="p-4 text-sm font-bold text-slate-500">
                                {t.notFound}
                              </div>
                            )}

                            {filteredGuides.map((g) => {
                              const selected = selectedGuides.some(
                                (x) => x.id === g.id
                              );

                              return (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => toggleGuide(g)}
                                  className={cn(
                                    "flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition",
                                    selected
                                      ? "bg-[#fff1f1]"
                                      : "bg-white hover:bg-slate-50"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 text-xs font-black",
                                      selected
                                        ? "border-[#e42526] text-[#e42526]"
                                        : "border-slate-300 text-transparent"
                                    )}
                                  >
                                    <Check size={14} />
                                  </span>

                                  <span className="text-sm font-bold text-slate-900">
                                    {g.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
                            <button
                              type="button"
                              onClick={() => setSelectedGuides([])}
                              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              {t.clear}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setGuideOpen(false);
                                setGuideSearch("");
                              }}
                              className="flex-1 rounded-xl bg-[#e42526] px-3 py-2 text-sm font-black text-white transition hover:bg-[#c91f20]"
                            >
                              {t.done}
                            </button>
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
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e42526] text-sm font-black text-white shadow-sm shadow-[#e42526]/20 transition hover:bg-[#c91f20] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loading}
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    {t.add}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
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

function AlertBox({
  type,
  text,
  onClose,
}: {
  type: "error" | "success";
  text: string;
  onClose: () => void;
}) {
  const isError = type === "error";

  return (
    <div
      className={cn(
        "mb-5 flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-bold",
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <div className="flex items-start gap-3">
        {isError ? (
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
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