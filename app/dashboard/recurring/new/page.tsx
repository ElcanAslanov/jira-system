"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { DatePicker, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";
import { useAuth } from "@/context/AuthProvider";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Loader2,
  Paperclip,
  Repeat2,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

const { RangePicker } = DatePicker;

type Employee = {
  id: string;
  ad: string;
  soyad: string;
};

type Msg = {
  type: "ok" | "err";
  text: string;
};

const WEEK_DAYS = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
  { value: 0 },
];

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function employeeName(emp?: Employee) {
  if (!emp) return "";
  return `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim();
}

function formatDMY(value?: string | null) {
  if (!value) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  const d = String(parsed.getDate()).padStart(2, "0");
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const y = parsed.getFullYear();

  return `${d}/${m}/${y}`;
}

function translateFrequency(freq: string, t: any) {
  if (freq === "DAILY") return t.daily;
  if (freq === "WEEKLY") return t.weekly;
  if (freq === "MONTHLY") return t.monthly;
  return freq;
}

function fileSizeMB(file: File) {
  return (file.size / 1024 / 1024).toFixed(2);
}

export default function NewRecurringPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const router = useRouter();
  const { user, loading } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] =
    useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const [interval, setIntervalValue] = useState(1);
  const [priority, setPriority] = useState("MEDIUM");

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [weekDays, setWeekDays] = useState<number[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const loadEmployees = async () => {
      setEmployeesLoading(true);

      try {
        const { data, error } = await supabase
          .from("employees")
          .select("id, ad, soyad")
          .order("ad");

        if (error) throw error;

        setEmployees(data || []);
      } catch (e: any) {
        setMsg({ type: "err", text: e?.message || "Əməkdaşlar yüklənmədi" });
      } finally {
        setEmployeesLoading(false);
      }
    };

    loadEmployees();
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
      .map((id) => employees.find((emp) => emp.id === id))
      .filter(Boolean) as Employee[];
  }, [assignedTo, employees]);

  const filteredEmployees = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();

    if (!q) return employees;

    return employees.filter((emp) =>
      employeeName(emp).toLowerCase().includes(q)
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

  const toggleAssign = (id: string) => {
    setAssignedTo((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleWeekDay = (day: number) => {
    setWeekDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
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

  const createRule = async () => {
    setMsg(null);

    if (!title.trim()) {
      setMsg({ type: "err", text: t.titleRequired });
      return;
    }

    if (!startDate || !endDate) {
      setMsg({ type: "err", text: t.startEndRequired });
      return;
    }

    if (startDate > endDate) {
      setMsg({ type: "err", text: t.startGreaterError });
      return;
    }

    if (frequency === "WEEKLY" && weekDays.length === 0) {
      setMsg({ type: "err", text: t.weeklyDayRequired });
      return;
    }

    setCreating(true);

    try {
      const uploadedFiles: any[] = [];

      for (const file of files) {
        const fileName = `${Date.now()}-${file.name}`;

        const { error } = await supabase.storage
          .from("task-files")
          .upload(fileName, file);

        if (!error) {
          uploadedFiles.push({
            name: file.name,
            path: fileName,
            size: file.size,
          });
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        throw new Error("Session tapılmadı");
      }

      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (empError || !employee) {
        setMsg({ type: "err", text: t.employeeNotFoundError });
        return;
      }

      let nextRunDate = startDate;

      if (frequency === "WEEKLY" && weekDays.length > 0) {
        const start = dayjs(startDate);
        const startWeekday = start.day();

        let minDiff = 7;

        for (const d of weekDays) {
          let diff = d - startWeekday;

          if (diff <= 0) diff += 7;

          if (diff < minDiff) {
            minDiff = diff;
          }
        }

        nextRunDate = start.add(minDiff, "day").format("YYYY-MM-DD");
      }

      const { error } = await supabase
        .from("recurring_rules")
        .insert({
          title: title.trim(),
          description,
          frequency,
          interval,
          priority,
          assigned_to: assignedTo,
          week_days: frequency === "WEEKLY" ? weekDays.map(Number) : null,
          files: uploadedFiles,
          start_date: startDate,
          end_date: endDate,
          next_run_date: nextRunDate,
          is_active: true,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setMsg({ type: "ok", text: t.created || "Yaradıldı" });
      router.push("/dashboard/recurring");
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Dövrlü task yaradılmadı" });
    } finally {
      setCreating(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f7f8fb]">
        <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-5 lg:p-7">
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
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
          <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
                <Repeat2 size={14} />
                Task Flow
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {t.recurringTitle}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Gündəlik, həftəlik və aylıq təkrarlanan tapşırıqları əvvəlcədən
                planlayın.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard/recurring")}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              ← {t.recurringTasks}
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="overflow-visible rounded-[30px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    Dövrlü tapşırıq məlumatları
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Tezlik, tarix aralığı, icraçılar və faylları daxil edin.
                  </p>
                </div>

                <div className="hidden h-10 w-10 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526] sm:grid">
                  <Sparkles size={18} />
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

              <Field label={t.title} icon={FileText}>
                <input
                  className="input-modern h-12"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>

              <Field label={t.description} icon={FileText}>
                <textarea
                  rows={4}
                  className="input-modern min-h-[130px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              <div>
                <Label icon={Repeat2} text={t.frequency} />

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { key: "DAILY", label: t.daily },
                    { key: "WEEKLY", label: t.weekly },
                    { key: "MONTHLY", label: t.monthly },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setFrequency(item.key as any);
                        if (item.key !== "WEEKLY") setWeekDays([]);
                      }}
                      className={cn(
                        "h-11 rounded-2xl border px-3 text-sm font-black transition active:scale-[0.98]",
                        frequency === item.key
                          ? "border-[#e42526] bg-[#e42526] text-white shadow-sm shadow-[#e42526]/20"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {frequency === "WEEKLY" && (
                <div>
                  <Label icon={CalendarDays} text={t.weekDays} />

                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day) => {
                      const active = weekDays.includes(day.value);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleWeekDay(day.value)}
                          className={cn(
                            "h-10 min-w-10 rounded-2xl px-4 text-sm font-black transition active:scale-[0.98]",
                            active
                              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                          )}
                        >
                          {
                            t.weekDaysShort?.[
                              day.value as keyof typeof t.weekDaysShort
                            ]
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  <Clock3 size={15} className="text-[#e42526]" />
                  {t.interval}
                  <Tooltip
                    placement="right"
                    title={
                      <div className="space-y-1 text-sm">
                        <div>
                          <b>{t.daily}</b> 1 → {t.intervalDaily1}
                        </div>
                        <div>
                          <b>{t.daily}</b> 2 → {t.intervalDaily2}
                        </div>
                        <div>
                          <b>{t.weekly}</b> 1 → {t.intervalWeekly1}
                        </div>
                        <div>
                          <b>{t.weekly}</b> 2 → {t.intervalWeekly2}
                        </div>
                        <div>
                          <b>{t.monthly}</b> 1 → {t.intervalMonthly1}
                        </div>
                      </div>
                    }
                  >
                    <InfoCircleOutlined className="cursor-pointer text-slate-400" />
                  </Tooltip>
                </label>

                <input
                  type="number"
                  min={1}
                  className="input-modern mt-2 h-12"
                  value={interval}
                  onChange={(e) =>
                    setIntervalValue(Math.max(1, Number(e.target.value)))
                  }
                />
              </div>

              <div>
                <Label icon={Sparkles} text={t.priorityLevel} />

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

              <div>
                <Label icon={CalendarDays} text="Tarix aralığı" />

                <RangePicker
                  format="DD/MM/YYYY"
                  value={[
                    startDate ? dayjs(startDate, "YYYY-MM-DD") : null,
                    endDate ? dayjs(endDate, "YYYY-MM-DD") : null,
                  ]}
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 16,
                    marginTop: 8,
                  }}
                  onChange={(vals) => {
                    setStartDate(vals?.[0]?.format("YYYY-MM-DD") ?? null);
                    setEndDate(vals?.[1]?.format("YYYY-MM-DD") ?? null);
                  }}
                />
              </div>

              <div ref={dropdownRef} className="relative">
                <Label icon={UserRound} text={t.assignUsers} />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setAssignOpen((prev) => !prev)}
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
                        {employeesLoading ? t.loading : t.selectAssignee}
                      </span>
                    ) : (
                      selectedEmployees.map((emp) => (
                        <span
                          key={emp.id}
                          className="max-w-[180px] truncate rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700"
                          title={employeeName(emp)}
                        >
                          {employeeName(emp)}
                        </span>
                      ))
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
                          {t.employeeNotFound}
                        </div>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const selected = assignedTo.includes(emp.id);

                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => toggleAssign(emp.id)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition",
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
                                  {employeeName(emp)}
                                </span>
                              </div>

                              {selected && (
                                <Check
                                  size={18}
                                  className="shrink-0 text-[#e42526]"
                                />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
                      <button
                        type="button"
                        onClick={() => setAssignedTo([])}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                      >
                        {t.clear || "Təmizlə"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAssignOpen(false)}
                        className="flex-1 rounded-xl bg-[#e42526] px-3 py-2 text-sm font-black text-white transition hover:bg-[#c91f20]"
                      >
                        {t.done || "Hazır"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

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

              <button
                type="button"
                onClick={createRule}
                disabled={creating}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e42526] text-sm font-black text-white shadow-sm shadow-[#e42526]/20 transition hover:bg-[#c91f20] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.creating || "Yaradılır..."}
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    {t.createRecurringTask}
                  </>
                )}
              </button>
            </div>
          </section>

          <aside className="xl:sticky xl:top-5 xl:self-start">
            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                <h3 className="text-base font-black text-slate-950">
                  Ön baxış
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Yaradılacaq qaydanın qısa xülasəsi
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <FrequencyPreview frequency={frequency} t={t} />
                    <PriorityPreview priority={priority} t={t} />
                  </div>

                  <h4 className="line-clamp-2 text-base font-black text-slate-950">
                    {title.trim() || t.title}
                  </h4>

                  <p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-slate-500">
                    {description.trim() || t.description}
                  </p>
                </div>

                <SummaryRow
                  icon={Clock3}
                  label={t.interval}
                  value={interval}
                />

                <SummaryRow
                  icon={CalendarDays}
                  label={t.start}
                  value={formatDMY(startDate)}
                />

                <SummaryRow
                  icon={CalendarDays}
                  label={t.end}
                  value={formatDMY(endDate)}
                />

                <SummaryRow
                  icon={UserRound}
                  label={t.assignUsers}
                  value={`${assignedTo.length} ${t.assigneeSelected || "seçildi"}`}
                />

                <SummaryRow
                  icon={Paperclip}
                  label={t.attachFile}
                  value={`${files.length} fayl`}
                />

                {frequency === "WEEKLY" && (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
                      {t.weekDays}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {weekDays.length ? (
                        weekDays.map((day) => (
                          <span
                            key={day}
                            className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700"
                          >
                            {
                              t.weekDaysShort?.[
                                day as keyof typeof t.weekDaysShort
                              ]
                            }
                          </span>
                        ))
                      ) : (
                        <span className="text-sm font-bold text-slate-400">
                          -
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {selectedEmployees.length > 0 && (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
                      İcraçılar
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedEmployees.slice(0, 8).map((emp) => (
                        <span
                          key={emp.id}
                          className="max-w-[145px] truncate rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700"
                          title={employeeName(emp)}
                        >
                          {employeeName(emp)}
                        </span>
                      ))}

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

function FrequencyPreview({ frequency, t }: { frequency: string; t: any }) {
  const cls =
    frequency === "DAILY"
      ? "bg-emerald-100 text-emerald-700"
      : frequency === "WEEKLY"
        ? "bg-indigo-100 text-indigo-700"
        : "bg-amber-100 text-amber-700";

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", cls)}>
      {translateFrequency(frequency, t)}
    </span>
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