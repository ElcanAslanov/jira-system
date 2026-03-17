"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { DatePicker, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

const { RangePicker } = DatePicker;

type Employee = {
    id: string;
    ad: string;
    soyad: string;
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

export default function NewRecurringPage() {

    const { lang } = useLang();
    const t = translations[lang];

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
                alert(t.fileTypeError);
                continue;
            }

            if (file.size > maxSize) {
                alert(`${file.name} ${t.fileTooLarge}`);
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

    /* ================= CREATE RULE ================= */

    const createRule = async () => {
        if (!title.trim()) return alert(t.titleRequired);
        if (!startDate || !endDate)
            return alert(t.startEndRequired);
        if (startDate > endDate)
            return alert(t.startGreaterError);

        if (frequency === "WEEKLY" && weekDays.length === 0)
            return alert(t.weeklyDayRequired);

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
        const userId = userData.user?.id;

        /* employee id tapırıq (tasks.created_by üçün lazımdır) */
        const { data: employee, error: empError } = await supabase
            .from("employees")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (empError || !employee) {
            alert(t.employeeNotFoundError);
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
        /* recurring rule yaradırıq */
        const { data: rule, error } = await supabase
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
                created_by: userId
            })
            .select()
            .single();

        if (error) {
            alert(error.message);
            return;
        }

        /* əgər start date bu gündürsə ilk taskı dərhal yaradırıq */
        // const today = dayjs().format("YYYY-MM-DD");

        // if (startDate === today) {
        //     const { error: taskError } = await supabase
        //         .from("tasks")
        //         .insert({
        //             title: title.trim(),
        //             description,
        //             priority,
        //             due_date: startDate,
        //             status: "TODO",
        //             created_by: employee.id,
        //         });

        //     if (taskError) {
        //         console.log("TASK ERROR:", taskError);
        //     }
        // }

        router.push("/dashboard/recurring");
    };



if (!user) {
  return <div className="p-10">Yüklənir...</div>;
}

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-6">
                <h1 className="text-2xl font-bold">
                    🌀 {t.recurringTitle}
                </h1>

                {/* TITLE */}
                <div>
                    <label className="text-sm font-medium text-gray-600">
                        {t.title}
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
                        {t.description}
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
                        {t.frequency}
                    </label>
                    <select
                        className="w-full mt-2 border p-3 rounded-xl"
                        value={frequency}
                        onChange={(e) =>
                            setFrequency(e.target.value as any)
                        }
                    >
                        <option value="DAILY">{t.daily}</option>
                        <option value="WEEKLY">{t.weekly}</option>
                        <option value="MONTHLY">{t.monthly}</option>
                    </select>
                </div>

                {/* WEEK DAYS */}
                {frequency === "WEEKLY" && (
                    <div>
                        <label className="text-sm font-medium text-gray-600">
                            {t.weekDays}
                        </label>
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {WEEK_DAYS.map((day) => (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => toggleWeekDay(day.value)}
                                    className={`px-4 py-2 rounded-full text-sm ${weekDays.includes(day.value)
                                        ? "bg-indigo-600 text-white"
                                        : "bg-gray-100"
                                        }`}
                                >
                                    {t.weekDaysShort?.[day.value as keyof typeof t.weekDaysShort]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* INTERVAL */}
                <div>
                    <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        {t.interval}
                        <Tooltip
                            placement="right"
                            title={
                                <div className="text-sm space-y-1">
                                    <div><b>{t.daily}</b> 1 → {t.intervalDaily1}</div>
                                    <div><b>{t.daily}</b> 2 → {t.intervalDaily2}</div>
                                    <div><b>{t.weekly}</b> 1 → {t.intervalWeekly1}</div>
                                    <div><b>{t.weekly}</b> 2 → {t.intervalWeekly2}</div>
                                    <div><b>{t.monthly}</b> 1 → {t.intervalMonthly1}</div>
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
                            setInterval(Math.max(1, Number(e.target.value)))
                        }
                    />
                </div>

                {/* PRIORITY */}
                <div>
                    <label className="text-sm font-medium text-gray-600">
                        {t.priorityLevel}
                    </label>
                    <select
                        className="w-full mt-2 border p-3 rounded-xl"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                    >
                        <option value="LOW">{t.low}</option>
                        <option value="MEDIUM">{t.medium}</option>
                        <option value="HIGH">{t.high}</option>
                        <option value="URGENT">{t.urgent}</option>
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
                        {t.assignUsers}
                    </label>

                    <div
                        onClick={() => setAssignOpen(!assignOpen)}
                        className="w-full mt-2 border p-3 rounded-xl bg-white cursor-pointer flex justify-between items-center"
                    >
                        <span className="text-sm text-gray-700">
                            {assignedTo.length === 0
                                ? t.selectAssignee
                                : `${assignedTo.length} ${t.assigneeSelected}`}
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
                                    {t.employeeNotFound}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* FILE UPLOAD */}
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
                                            {t.delete}
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
                    {t.createRecurringTask}
                </button>
            </div>
        </div>
    );
}