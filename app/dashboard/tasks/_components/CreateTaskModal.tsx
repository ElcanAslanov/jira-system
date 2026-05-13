"use client";


import { useState } from "react";
import type { Task, UserInfo } from "./taskTypes";

import dynamic from "next/dynamic";
import type { SelectProps } from "antd/es/select";

const Select = dynamic<SelectProps<string[]>>(
    () => import("antd/es/select").then((m) => m.default),
    {
        ssr: false,
    }
);

export default function CreateTaskModal({
    users,
    onClose,
    onCreate,
    t,
}: {
    users: UserInfo[];
    onClose: () => void;
    onCreate: (payload: Partial<Task>) => Promise<void> | void;
    t: any;
}) {
    const [form, setForm] = useState<Partial<Task>>({
        title: "",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        start_date: null,
        due_date: null,
        assigned_to: null,
    });

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-[580px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="text-lg font-black text-slate-950">{t.newTask}</div>
                    <button
                        onClick={onClose}
                        className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 shadow-sm hover:bg-slate-100"
                    >
                        ✖
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <Field label={t.taskName}>
                        <input
                            className="input-modern"
                            value={form.title ?? ""}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Task title..."
                        />
                    </Field>

                    <Field label={t.description}>
                        <textarea
                            className="input-modern min-h-[110px]"
                            value={form.description ?? ""}
                            onChange={(e) =>
                                setForm((p) => ({ ...p, description: e.target.value }))
                            }
                            placeholder="Optional..."
                        />
                    </Field>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label={t.status}>
                            <select
                                className="input-modern"
                                value={(form.status ?? "TODO") as string}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, status: e.target.value as any }))
                                }
                            >
                                <option value="TODO">{t.todo}</option>
                                <option value="IN_PROGRESS">{t.inProgress}</option>
                                <option value="DONE">{t.taskDone}</option>
                                <option value="CANCELLED">{t.cancelled}</option>
                            </select>
                        </Field>

                        <Field label={t.priority}>
                            <select
                                className="input-modern"
                                value={(form.priority ?? "MEDIUM") as string}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, priority: e.target.value as any }))
                                }
                            >
                                <option value="LOW">{t.low}</option>
                                <option value="MEDIUM">{t.medium}</option>
                                <option value="HIGH">{t.high}</option>
                                <option value="URGENT">{t.urgent}</option>
                            </select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label={t.startDate}>
                            <input
                                type="date"
                                className="input-modern"
                                value={(form.start_date ?? "") as string}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, start_date: e.target.value || null }))
                                }
                            />
                        </Field>

                        <Field label={t.dueDate}>
                            <input
                                type="date"
                                className="input-modern"
                                value={(form.due_date ?? "") as string}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, due_date: e.target.value || null }))
                                }
                            />
                        </Field>
                    </div>

                    <Field label={t.assignedTo}>
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder={t.selectUser}
                            className="w-full"
                            value={(form.assigned_to ?? []) as string[]}
                            onChange={(vals) =>
                                setForm((p) => ({
                                    ...p,
                                    assigned_to: vals as string[],
                                }))
                            }
                            options={users.map((u) => ({
                                value: u.id,
                                label: u.name,
                            }))}
                        />
                    </Field>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={async () => {
                                if (!form.title?.trim()) {
                                    alert(t.titleRequired);
                                    return;
                                }

                                await onCreate({
                                    ...form,
                                    title: form.title.trim(),
                                });
                            }}
                            className="rounded-2xl bg-[#e42526] px-5 py-2.5 text-sm font-black text-white hover:bg-[#c91f20]"
                        >
                            {t.createTask}
                        </button>

                        <button
                            onClick={onClose}
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                            {t.cancel}
                        </button>
                    </div>
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
        <div>
            <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                {label}
            </label>
            <div className="mt-1">{children}</div>
        </div>
    );
}