"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { DatePicker, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

type Employee = {
    id: string;
    ad: string;
    soyad: string;
};

const WEEK_DAYS = [
    { label: "B.e", value: 1 },
    { label: "Ç.a", value: 2 },
    { label: "Ç", value: 3 },
    { label: "C.a", value: 4 },
    { label: "C", value: 5 },
    { label: "Ş", value: 6 },
    { label: "B", value: 0 },
];

export default function NewRecurringPage() {
    const router = useRouter();
    const { user, loading } = useUser();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [frequency, setFrequency] =
        useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
    const [interval, setInterval] = useState(1);
    const [priority, setPriority] = useState("MEDIUM");

    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);

    const [weekDays, setWeekDays] = useState<number[]>([]);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [assignedTo, setAssignedTo] = useState<string[]>([]);
    const [assignOpen, setAssignOpen] = useState(false);

    const [files, setFiles] = useState<File[]>([]);

    const dropdownRef = useRef<HTMLDivElement>(null);

    /* ================= LOAD EMPLOYEES ================= */

    useEffect(() => {
        if (!user) return;

        const loadEmployees = async () => {
            const { data } = await supabase
                .from("employees")
                .select("id, ad, soyad")
                .order("ad");

            setEmployees(data || []);
        };

        loadEmployees();
    }, [user]);

    /* Close dropdown */
    useEffect(() => {
        const handleClickOutside = (e: any) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setAssignOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleAssign = (id: string) => {
        if (assignedTo.includes(id)) {
            setAssignedTo(assignedTo.filter((i) => i !== id));
        } else {
            setAssignedTo([...assignedTo, id]);
        }
    };

    const toggleWeekDay = (day: number) => {
        if (weekDays.includes(day)) {
            setWeekDays(weekDays.filter((d) => d !== day));
        } else {
            setWeekDays([...weekDays, day]);
        }
    };

    /* ================= FILE VALIDATION ================= */

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        let currentFiles = [...files];

        for (const file of selectedFiles) {
            if (!allowedTypes.includes(file.type)) {
                alert("Yalnız PDF, Excel, Word, JPG və PNG icazəlidir");
                continue;
            }

            if (file.size > maxSize) {
                alert(`${file.name} 20MB-dan böyükdür`);
                continue;
            }

            if (currentFiles.length >= maxFiles) {
                alert("Maksimum 20 fayl əlavə edə bilərsiniz");
                break;
            }

            currentFiles.push(file);
        }

        setFiles(currentFiles);
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    /* ================= CREATE RULE ================= */

    const createRule = async () => {
        if (!title.trim()) return alert("Title tələb olunur");
        if (!startDate || !endDate)
            return alert("Start və End tarixi seçilməlidir");
        if (startDate > endDate)
            return alert("Start date end-dən böyük ola bilməz");

        if (frequency === "WEEKLY" && weekDays.length === 0)
            return alert("Həftəlik üçün ən azı 1 gün seçilməlidir");

        let uploadedFiles: any[] = [];

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

        const { error } = await supabase.from("recurring_rules").insert({
            title: title.trim(),
            description,
            frequency,
            interval,
            priority,
            assigned_to: assignedTo,
            week_days: frequency === "WEEKLY" ? weekDays : null,
            files: uploadedFiles,
            start_date: startDate,
            end_date: endDate,
            next_run_date: startDate,
            is_active: true,
            created_by: userData.user?.id,
        });

        if (error) {
            alert(error.message);
            return;
        }

        router.push("/dashboard/recurring");
    };

    if (loading || !user) return null;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-6">
                <h1 className="text-2xl font-bold">
                    🌀 Dövrlü Tapşırıq Əlavə et
                </h1>

                {/* TITLE */}
                <div>
                    <label className="text-sm font-medium text-gray-600">
                        Ad
                    </label>
                    <input
                        className="w-full mt-2 border p-3 rounded-xl"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                {/* DESCRIPTION */}
                <div>
                    <label className="text-sm font-medium text-gray-600">
                        Məzmun
                    </label>
                    <textarea
                        rows={4}
                        className="w-full mt-2 border p-3 rounded-xl"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                {/* FREQUENCY */}
                <div>
                    <label className="text-sm font-medium text-gray-600">
                        Tezlik
                    </label>
                    <select
                        className="w-full mt-2 border p-3 rounded-xl"
                        value={frequency}
                        onChange={(e) =>
                            setFrequency(e.target.value as any)
                        }
                    >
                        <option value="DAILY">Gündəlik</option>
                        <option value="WEEKLY">Həftəlik</option>
                        <option value="MONTHLY">Aylıq</option>
                    </select>
                </div>

                {/* WEEK DAYS */}
                {frequency === "WEEKLY" && (
                    <div>
                        <label className="text-sm font-medium text-gray-600">
                            Həftənin günləri
                        </label>
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {WEEK_DAYS.map((day) => (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => toggleWeekDay(day.value)}
                                    className={`px-4 py-2 rounded-full text-sm ${
                                        weekDays.includes(day.value)
                                            ? "bg-indigo-600 text-white"
                                            : "bg-gray-100"
                                    }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* INTERVAL */}
                <div>
                    <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        İnterval
                        <Tooltip
                            placement="right"
                            title={
                                <div className="text-sm space-y-1">
                                    <div><b>Gündəlik</b> 1 → hər gün</div>
                                    <div><b>Gündəlik</b> 2 → hər 2 gündən bir</div>
                                    <div><b>Həftəlik</b> 1 → hər həftə</div>
                                    <div><b>Həftəlik</b> 2 → hər 2 həftə</div>
                                    <div><b>Aylıq</b> 1 → hər ay</div>
                                </div>
                            }
                        >
                            <InfoCircleOutlined className="text-gray-400 cursor-pointer" />
                        </Tooltip>
                    </label>

                    <input
                        type="number"
                        min={1}
                        className="w-full mt-2 border p-3 rounded-xl"
                        value={interval}
                        onChange={(e) =>
                            setInterval(Number(e.target.value))
                        }
                    />
                </div>

                {/* PRIORITY */}
                <div>
                    <label className="text-sm font-medium text-gray-600">
                        Vaciblik dərəcəsi
                    </label>
                    <select
                        className="w-full mt-2 border p-3 rounded-xl"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                    >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                    </select>
                </div>

                {/* DATE RANGE */}
                <RangePicker
                    format="DD/MM/YYYY"
                    style={{ width: "100%" }}
                    onChange={(vals) => {
                        setStartDate(
                            vals?.[0]?.format("YYYY-MM-DD") ?? null
                        );
                        setEndDate(
                            vals?.[1]?.format("YYYY-MM-DD") ?? null
                        );
                    }}
                />

                {/* ASSIGN USERS */}
<div ref={dropdownRef}>
    <label className="text-sm font-medium text-gray-600">
        İcraçılar
    </label>

    <div
        onClick={() => setAssignOpen(!assignOpen)}
        className="w-full mt-2 border p-3 rounded-xl bg-white cursor-pointer flex justify-between items-center"
    >
        <span className="text-sm text-gray-700">
            {assignedTo.length === 0
                ? "İcraçı seç"
                : `${assignedTo.length} nəfər seçilib`}
        </span>
        <span className="text-gray-400 text-xs">
            ▼
        </span>
    </div>

    {assignOpen && (
        <div className="mt-2 border rounded-xl bg-white shadow-md max-h-60 overflow-y-auto">
            {employees.map((emp) => (
                <label
                    key={emp.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer text-sm"
                >
                    <input
                        type="checkbox"
                        checked={assignedTo.includes(emp.id)}
                        onChange={() => toggleAssign(emp.id)}
                    />
                    {emp.ad} {emp.soyad}
                </label>
            ))}

            {employees.length === 0 && (
                <div className="p-3 text-sm text-gray-400">
                    İşçi tapılmadı
                </div>
            )}
        </div>
    )}
</div>

                {/* FILE UPLOAD */}
                <div>
                    <label className="text-sm font-medium text-gray-600">
                        Fayl əlavə et (PDF, Excel, Word, Şəkil — max 20MB)
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
                            {files.map((file, i) => (
                                <div
                                    key={i}
                                    className="flex justify-between items-center bg-gray-50 p-2 rounded-lg"
                                >
                                    <span>{file.name}</span>
                                    <div className="flex gap-3 items-center">
                                        <span>
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                        <button
                                            onClick={() => removeFile(i)}
                                            className="text-red-500 text-xs"
                                        >
                                            Sil
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    onClick={createRule}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700"
                >
                    Yarat
                </button>
            </div>
        </div>
    );
}