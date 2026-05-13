"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

dayjs.extend(customParseFormat);

const DATE_FORMATS = ["DD/MM/YYYY", "DD-MM-YYYY"];

type Employee = {
  id?: string;
  user_id?: string;
  employee_id?: string;
  ad: string;
  soyad: string;
  company_id?: string;
};

type Msg = {
  type: "ok" | "err";
  text: string;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getEmployeeId(emp: Employee) {
  return emp.id || emp.user_id || emp.employee_id || "";
}

function getEmployeeName(emp: Employee) {
  return `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim();
}

function fileSizeMB(file: File) {
  return (file.size / 1024 / 1024).toFixed(2);
}

export default function CreateTaskPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const router = useRouter();
  const { user, loading } = useAuth();

  const [commentsEnabled, setCommentsEnabled] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<Msg | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setAssignOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedEmployees = useMemo(() => {
    return assignedTo
      .map((id) => employees.find((emp) => getEmployeeId(emp) === id))
      .filter(Boolean) as Employee[];
  }, [assignedTo, employees]);

  const filteredEmployees = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();

    const normalized = employees.filter((emp) => getEmployeeId(emp));

    if (!q) return normalized;

    return normalized.filter((emp) =>
      getEmployeeName(emp).toLowerCase().includes(q)
    );
  }, [assignSearch, employees]);

  const priorityOptions = useMemo(
    () => [
      {
        key: "LOW",
        label: t.low,
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        activeClassName:
          "border-emerald-500 bg-emerald-600 text-white shadow-emerald-600/20",
      },
      {
        key: "MEDIUM",
        label: t.medium,
        className:
          "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
        activeClassName:
          "border-blue-500 bg-blue-600 text-white shadow-blue-600/20",
      },
      {
        key: "HIGH",
        label: t.high,
        className:
          "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
        activeClassName:
          "border-amber-500 bg-amber-500 text-white shadow-amber-500/20",
      },
      {
        key: "URGENT",
        label: t.urgent,
        className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
        activeClassName:
          "border-red-500 bg-red-600 text-white shadow-red-600/20",
      },
    ],
    [t]
  );

  const loadEmployees = async () => {
    setEmployeesLoading(true);
    setMsg(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error("Session tapılmadı");
      }

      const res = await fetch("/api/tasks/assignable-guides", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Əməkdaşlar yüklənmədi");
      }

      const rows: Employee[] = Array.isArray(data.employees)
        ? data.employees
        : [];

      setEmployees(
        rows
          .filter((emp) => getEmployeeId(emp))
          .sort((a, b) =>
            getEmployeeName(a).localeCompare(getEmployeeName(b), "az")
          )
      );
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setEmployeesLoading(false);
    }
  };

  const toggleAssign = (id: string) => {
    if (!id) return;

    setAssignedTo((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(null);

    const selectedFiles = Array.from(e.target.files || []);

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];

    const maxSize = 20 * 1024 * 1024;
    const maxFiles = 20;

    const currentFiles = [...files];

    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        setMsg({ type: "err", text: t.fileTypeError });
        continue;
      }

      if (file.size > maxSize) {
        setMsg({ type: "err", text: `${file.name} ${t.fileTooLarge}` });
        continue;
      }

      if (currentFiles.length >= maxFiles) {
        setMsg({ type: "err", text: t.maxFilesError });
        break;
      }

      currentFiles.push(file);
    }

    setFiles(currentFiles);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const createTask = async () => {
    setMsg(null);

    if (!title.trim() || assignedTo.length === 0) {
      setMsg({ type: "err", text: t.taskValidationError });
      return;
    }

    setCreating(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error("Session tapılmadı");
      }

      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("priority", priority);
      formData.append("start_date", dateFrom);
      formData.append("due_date", dateTo);

      assignedTo.forEach((id) => {
        formData.append("assigned_to[]", id);
      });

      formData.append("comments_enabled", String(commentsEnabled));

      files.forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Tapşırıq yaradılmadı");
      }

      setMsg({ type: "ok", text: t.created || "Yaradıldı" });
      router.push("/dashboard/tasks");
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Server xətası" });
    } finally {
      setCreating(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f7f8fb]">
        <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-7">
          <div className="h-36 animate-pulse rounded-[30px] border border-slate-200 bg-white" />
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="h-[520px] animate-pulse rounded-[30px] border border-slate-200 bg-white" />
            <div className="h-[360px] animate-pulse rounded-[30px] border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] pb-8">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-5 lg:p-7">
        {/* Header */}
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
          <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
                <Sparkles size={14} />
                Task Flow
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {t.newTask}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Tapşırığı yaradın, əməkdaşlara yönləndirin və lazım olan
                faylları əlavə edin.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard/tasks")}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              ← {t.tasks}
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* Form */}
          <section className="overflow-visible rounded-[30px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    Tapşırıq məlumatları
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Başlıq, tarix, prioritet və icraçıları daxil edin.
                  </p>
                </div>

                <div className="hidden h-10 w-10 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526] sm:grid">
                  <Plus size={18} />
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {msg && (
                <AlertBox
                  type={msg.type}
                  text={msg.text}
                  onClose={() => setMsg(null)}
                />
              )}

              {/* TITLE */}
              <Field label={t.taskName} icon={FileText}>
                <input
                  className="input-modern h-12"
                  placeholder={t.taskTitlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>

              {/* DESCRIPTION */}
              <Field label={t.description} icon={FileText}>
                <textarea
                  rows={4}
                  className="input-modern min-h-[130px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              {/* PRIORITY */}
              <div>
                <Label icon={Sparkles} text={t.priority} />

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {priorityOptions.map((p) => {
                    const active = priority === p.key;

                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPriority(p.key)}
                        className={cn(
                          "h-11 rounded-2xl border px-3 text-sm font-black shadow-sm transition active:scale-[0.98]",
                          active ? p.activeClassName : p.className
                        )}
                      >
                        {p.label as string}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DATE RANGE */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label icon={CalendarDays} text={t.startDate} />

                  <DatePicker
                    value={dateFrom ? dayjs(dateFrom, "YYYY-MM-DD") : null}
                    format={DATE_FORMATS}
                    placeholder={t.startDate}
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 16,
                    }}
                    onChange={(value) => {
                      setDateFrom(value ? value.format("YYYY-MM-DD") : "");
                    }}
                  />
                </div>

                <div>
                  <Label icon={CalendarDays} text={t.endDate} />

                  <DatePicker
                    value={dateTo ? dayjs(dateTo, "YYYY-MM-DD") : null}
                    format={DATE_FORMATS}
                    placeholder={t.endDate}
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 16,
                    }}
                    onChange={(value) => {
                      setDateTo(value ? value.format("YYYY-MM-DD") : "");
                    }}
                  />
                </div>
              </div>

              {/* MULTI ASSIGN */}
              <div ref={dropdownRef} className="relative">
                <Label icon={UserRound} text={t.assign} />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setAssignOpen((p) => !p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setAssignOpen((p) => !p);
                    }
                  }}
                  className={cn(
                    "mt-2 flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition",
                    assignOpen
                      ? "border-[#e42526] bg-[#fff1f1] ring-4 ring-[#e42526]/10"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    {selectedEmployees.length === 0 ? (
                      <span className="px-1 text-sm font-semibold text-slate-400">
                        {employeesLoading ? t.loading : t.selectEmployee}
                      </span>
                    ) : (
                      selectedEmployees.map((emp) => {
                        const empId = getEmployeeId(emp);
                        const empName = getEmployeeName(emp);

                        return (
                          <span
                            key={empId}
                            className="max-w-[190px] truncate rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700"
                            title={empName}
                          >
                            {empName}
                          </span>
                        );
                      })
                    )}
                  </div>

                  <ChevronDown
                    size={18}
                    className={cn(
                      "shrink-0 text-slate-400 transition",
                      assignOpen && "rotate-180 text-[#e42526]"
                    )}
                  />
                </div>

                {assignOpen && (
                  <div
                    className="absolute left-0 top-[calc(100%+8px)] z-[999] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-slate-200 bg-slate-50 p-3">
                      <div className="relative">
                        <Search
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                          value={assignSearch}
                          onChange={(e) => setAssignSearch(e.target.value)}
                          placeholder={t.search}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold outline-none focus:border-[#e42526] focus:ring-4 focus:ring-[#e42526]/10"
                        />
                      </div>
                    </div>

                    <div className="custom-scrollbar max-h-72 overflow-y-auto">
                      {employeesLoading ? (
                        <div className="p-4 text-sm font-bold text-slate-500">
                          {t.loading}
                        </div>
                      ) : filteredEmployees.length === 0 ? (
                        <div className="p-4 text-sm font-bold text-slate-500">
                          {t.notFound || "Tapılmadı"}
                        </div>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const empId = getEmployeeId(emp);
                          const empName = getEmployeeName(emp);
                          const selected = assignedTo.includes(empId);

                          if (!empId) return null;

                          return (
                            <div
                              key={empId}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAssign(empId);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleAssign(empId);
                                }
                              }}
                              className={cn(
                                "flex w-full cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition",
                                selected
                                  ? "bg-[#fff1f1]"
                                  : "bg-white hover:bg-slate-50"
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className={cn(
                                    "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black",
                                    selected
                                      ? "bg-[#e42526] text-white"
                                      : "bg-slate-100 text-slate-500"
                                  )}
                                >
                                  {emp.ad?.[0]}
                                  {emp.soyad?.[0]}
                                </div>

                                <span className="truncate text-sm font-black text-slate-800">
                                  {empName || "-"}
                                </span>
                              </div>

                              {selected && (
                                <Check
                                  size={18}
                                  className="shrink-0 text-[#e42526]"
                                />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignedTo([]);
                        }}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                      >
                        {t.clear || "Təmizlə"}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignOpen(false);
                        }}
                        className="flex-1 rounded-xl bg-[#e42526] px-3 py-2 text-sm font-black text-white transition hover:bg-[#c91f20]"
                      >
                        {t.done || "Hazır"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* COMMENT TOGGLE */}
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-white">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#e42526] shadow-sm">
                    <MessageCircle size={18} />
                  </div>

                  <div>
                    <div className="text-sm font-black text-slate-900">
                      {t.enableComments}
                    </div>
                    <div className="text-xs font-semibold text-slate-400">
                      Tapşırıqda şərh yazmağa icazə ver
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={commentsEnabled}
                  onChange={(e) => setCommentsEnabled(e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[#e42526]"
                />
              </label>

              {/* FILE ATTACH */}
              <div>
                <Label icon={Paperclip} text={t.attachFile} />

                <label className="mt-2 flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition hover:border-[#e42526]/40 hover:bg-[#fff8f8]">
                  <div className="grid h-12 w-12 place-items-center rounded-3xl bg-white text-[#e42526] shadow-sm">
                    <Paperclip size={22} />
                  </div>

                  <div className="mt-3 text-sm font-black text-slate-800">
                    Faylları seçin və əlavə edin
                  </div>

                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    PDF, Word, Excel, JPG, PNG • max 20MB • max 20 fayl
                  </div>

                  <input
                    type="file"
                    multiple
                    accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                        title={file.name}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
                            <Paperclip size={16} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black text-slate-800">
                              {file.name}
                            </div>
                            <div className="text-[11px] font-bold text-slate-400">
                              {fileSizeMB(file)} MB
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100"
                          title={t.delete}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SUBMIT */}
              <button
                type="button"
                onClick={createTask}
                disabled={creating}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e42526] text-sm font-black text-white shadow-sm shadow-[#e42526]/20 transition hover:bg-[#c91f20] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.creating}
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    {t.createTask}
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Preview */}
          <aside className="xl:sticky xl:top-5 xl:self-start">
            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                <h3 className="text-base font-black text-slate-950">
                  Ön baxış
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Yaradılacaq tapşırığın qısa xülasəsi
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <PriorityPreview priority={priority} t={t} />
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-400">
                      NEW
                    </span>
                  </div>

                  <h4 className="line-clamp-2 text-base font-black text-slate-950">
                    {title.trim() || t.taskTitlePlaceholder}
                  </h4>

                  <p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-slate-500">
                    {description.trim() || t.description}
                  </p>
                </div>

                <SummaryRow
                  icon={CalendarDays}
                  label={t.startDate}
                  value={dateFrom ? formatDMY(dateFrom) : "-"}
                />

                <SummaryRow
                  icon={CalendarDays}
                  label={t.endDate}
                  value={dateTo ? formatDMY(dateTo) : "-"}
                />

                <SummaryRow
                  icon={UserRound}
                  label={t.assign}
                  value={`${assignedTo.length} ${t.selected || "seçildi"}`}
                />

                <SummaryRow
                  icon={Paperclip}
                  label={t.attachFile}
                  value={`${files.length} fayl`}
                />

                <SummaryRow
                  icon={MessageCircle}
                  label={t.enableComments}
                  value={commentsEnabled ? "Aktiv" : "Passiv"}
                />

                {selectedEmployees.length > 0 && (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
                      İcraçılar
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedEmployees.slice(0, 8).map((emp) => {
                        const empId = getEmployeeId(emp);
                        const empName = getEmployeeName(emp);

                        return (
                          <span
                            key={empId}
                            className="max-w-[145px] truncate rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700"
                            title={empName}
                          >
                            {empName}
                          </span>
                        );
                      })}

                      {selectedEmployees.length > 8 && (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">
                          +{selectedEmployees.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label icon={Icon} text={label} />
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Label({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
      <Icon size={15} className="text-[#e42526]" />
      {text}
    </label>
  );
}

function AlertBox({
  type,
  text,
  onClose,
}: {
  type: "ok" | "err";
  text: string;
  onClose: () => void;
}) {
  const ok = type === "ok";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-bold",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
        ) : (
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
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

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-50 text-slate-500">
          <Icon size={16} />
        </div>

        <span className="truncate text-sm font-black text-slate-700">
          {label}
        </span>
      </div>

      <span className="shrink-0 text-sm font-black text-slate-950">
        {value}
      </span>
    </div>
  );
}

function PriorityPreview({ priority, t }: { priority: string; t: any }) {
  const map: Record<string, string> = {
    LOW: "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    HIGH: "bg-amber-100 text-amber-700",
    URGENT: "bg-red-100 text-red-700",
  };

  const labelMap: Record<string, string> = {
    LOW: t.low,
    MEDIUM: t.medium,
    HIGH: t.high,
    URGENT: t.urgent,
  };

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-black",
        map[priority] || "bg-slate-100 text-slate-700"
      )}
    >
      {labelMap[priority] || priority}
    </span>
  );
}

function formatDMY(date: string) {
  if (!date) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return date;

  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yy = parsed.getFullYear();

  return `${dd}/${mm}/${yy}`;
}