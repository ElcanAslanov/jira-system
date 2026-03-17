"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { Dayjs } from "dayjs";
import { useLang } from "@/context/LanguageContext"
import { translations } from "@/lib/translations"

dayjs.extend(customParseFormat);

const DATE_FORMATS = ["DD/MM/YYYY", "DD-MM-YYYY"];

type Employee = {
  id: string;
  ad: string;
  soyad: string;
};

export default function CreateTaskPage() {


  const { lang } = useLang()
  const t = translations[lang]

  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const router = useRouter();
  const { user, loading } = useUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [creating, setCreating] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadEmployees();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAssignOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadEmployees = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const res = await fetch("/api/tasks/assignable-guides", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setEmployees(data.employees || []);
  };

  const toggleAssign = (id: string) => {
    if (assignedTo.includes(id)) {
      setAssignedTo(assignedTo.filter((i) => i !== id));
    } else {
      setAssignedTo([...assignedTo, id]);
    }
  };

  /* ================= FILE VALIDATION ================= */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    const allowedTypes = [
      // PDF
      "application/pdf",

      // Excel
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",

      // Word
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      // 🔥 IMAGES
      "image/jpeg",
      "image/png",
    ];

    const maxSize = 20 * 1024 * 1024; // 20MB
    const maxFiles = 20;

    let currentFiles = [...files];

    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        alert(t.fileTypeError)
        continue;
      }

      if (file.size > maxSize) {
        alert(`${file.name} ${t.fileTooLarge}`)
        continue;
      }

      if (currentFiles.length >= maxFiles) {
        alert(t.maxFilesError);
        break;
      }

      currentFiles.push(file);
    }

    setFiles(currentFiles);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  /* ================= CREATE TASK ================= */

  const createTask = async () => {
    if (!title || assignedTo.length === 0) {
      alert(t.taskValidationError);
      return;
    }

    setCreating(true);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const formData = new FormData();

    formData.append("title", title);
    formData.append("description", description);
    formData.append("priority", priority);
    formData.append("start_date", dateFrom);
    formData.append("due_date", dateTo);

    assignedTo.forEach((id) =>
      formData.append("assigned_to[]", id)
    );

    formData.append("comments_enabled", String(commentsEnabled));

    files.forEach((file) =>
      formData.append("files", file)
    );

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    setCreating(false);

    if (res.ok) {
      router.push("/dashboard/tasks");
      // router.refresh();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

if (!user) {
  return <div className="p-10">Yüklənir...</div>;
}

  const priorityStyles: any = {
    LOW: "bg-green-100 text-green-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  };

  return (
    <div className="h-full w-full p-6 overflow-y-auto bg-gray-100">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-6">

        <h2 className="text-2xl font-bold">{t.newTask}</h2>

        {/* TITLE */}
        <div>
          <label className="text-sm font-medium text-gray-600">{t.taskName}</label>
          <input
            className="w-full mt-2 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={t.taskTitlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* DESCRIPTION */}
        <div>
          <label className="text-sm font-medium text-gray-600">{t.description}</label>
          <textarea
            rows={4}
            className="w-full mt-2 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* PRIORITY */}
        <div>
          <label className="text-sm font-medium text-gray-600">{t.priority}</label>
          <div className="flex gap-3 mt-3 flex-wrap">
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${priority === p
                  ? priorityStyles[p]
                  : "bg-gray-100 text-gray-600"
                  }`}
              >
                {t[p.toLowerCase() as keyof typeof t] as string}
              </button>
            ))}
          </div>
        </div>

        {/* DATE RANGE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DatePicker
            value={dateFrom ? dayjs(dateFrom, "YYYY-MM-DD") : null}
            format={DATE_FORMATS}
            placeholder={t.startDate}
            style={{ width: "100%", height: 48, borderRadius: 12 }}
            onChange={(value) => {
              setDateFrom(value ? value.format("YYYY-MM-DD") : "");
            }}
          />

          <DatePicker
            value={dateTo ? dayjs(dateTo, "YYYY-MM-DD") : null}
            format={DATE_FORMATS}
            placeholder={t.endDate}
            style={{ width: "100%", height: 48, borderRadius: 12 }}
            onChange={(value) => {
              setDateTo(value ? value.format("YYYY-MM-DD") : "");
            }}
          />
        </div>

        {/* MULTI ASSIGN */}
        <div ref={dropdownRef} className="relative">
          <label className="text-sm font-medium text-gray-600">
            {t.assign}
          </label>

          <div
            onClick={() => setAssignOpen(!assignOpen)}
            className="mt-2 border p-3 rounded-xl cursor-pointer bg-white flex flex-wrap gap-2 min-h-[48px]"
          >
            {assignedTo.length === 0 && (
              <span className="text-gray-400">{t.selectEmployee}</span>
            )}

            {assignedTo.map((id) => {
              const emp = employees.find((e) => e.id === id);
              if (!emp) return null;
              return (
                <span
                  key={id}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                >
                  {emp.ad}
                </span>
              );
            })}
          </div>

          {assignOpen && (
            <div className="absolute z-50 mt-2 w-full bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => toggleAssign(emp.id)}
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100 flex justify-between ${assignedTo.includes(emp.id)
                    ? "bg-blue-50"
                    : ""
                    }`}
                >
                  <span>
                    {emp.ad} {emp.soyad}
                  </span>
                  {assignedTo.includes(emp.id) && (
                    <span className="text-blue-600">✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COMMENT TOGGLE */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="commentsEnabled"
            checked={commentsEnabled}
            onChange={(e) => setCommentsEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <label
            htmlFor="commentsEnabled"
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            {t.enableComments}
          </label>
        </div>

        {/* FILE ATTACH */}
        <div>
          <label className="text-sm font-medium text-gray-600">
            {t.attachFile}
          </label>

          <input
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="mt-2 block w-full border p-3 rounded-xl"
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-2 text-sm">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center bg-gray-50 p-2 rounded-lg"
                >
                  <span>{file.name}</span>
                  <div className="flex gap-3 items-center">
                    <span>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 text-xs"
                    >
                      {t.delete}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SUBMIT */}
        <button
          onClick={createTask}
          disabled={creating}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition disabled:opacity-50"
        >
          {creating ? t.creating : t.createTask}
        </button>
      </div>
    </div>
  );
}

//burdan sora basladim