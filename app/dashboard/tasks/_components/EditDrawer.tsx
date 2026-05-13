"use client";

import dynamic from "next/dynamic";
import type { SelectProps } from "antd/es/select";
import { useEffect, useState } from "react";
import type { Task, UserInfo } from "./taskTypes";

const Select = dynamic<SelectProps<string[]>>(
    () => import("antd/es/select").then((m) => m.default),
    {
        ssr: false,
    }
);

export default function EditDrawer({
    task,
    users,
    currentUserId,
    onClose,
    onSave,
    t,
}: {
    task: Task;
    users: UserInfo[];
    currentUserId: string;
    onClose: () => void;
    onSave: (updates: Partial<Task>) => Promise<void> | void;
    t: any;
}) {
    const isAssignedUser = task.assigned_to?.includes(currentUserId);

    const [form, setForm] = useState<Partial<Task>>({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        start_date: task.start_date ?? null,
        due_date: task.due_date ?? null,
        assigned_to: (task as any).assigned_ids ?? task.assigned_to ?? [],
    });

    const [newFiles, setNewFiles] = useState<File[]>([]);

    useEffect(() => {
        setForm({
            title: task.title,
            description: task.description ?? "",
            status: task.status,
            priority: task.priority,
            start_date: task.start_date ?? null,
            due_date: task.due_date ?? null,
            assigned_to: (task as any).assigned_ids ?? task.assigned_to ?? [],
        });
    }, [task]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-[720px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                    <h2 className="text-lg font-black text-slate-950">{t.editTask}</h2>
                    <button
                        onClick={onClose}
                        className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-500 shadow-sm hover:bg-slate-100"
                    >
                        ✖
                    </button>
                </div>

                <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
                    <Field label={t.title}>
                        <input
                            className="input-modern"
                            value={form.title ?? ""}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                        />
                    </Field>

                    <Field label={t.description}>
                        <textarea
                            className="input-modern min-h-[120px]"
                            value={form.description ?? ""}
                            onChange={(e) =>
                                setForm((p) => ({ ...p, description: e.target.value }))
                            }
                        />
                    </Field>

                    <Field label="Status">
                        <select
                            className="input-modern"
                            value={form.status as string}
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

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label={t.priority}>
                            <select
                                className="input-modern"
                                value={form.priority as string}
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

                        <div className="sm:col-span-2">
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
                        </div>
                    </div>

                    <Field label={t.addFiles}>
                        <input
                            type="file"
                            multiple
                            className="input-modern"
                            onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
                        />
                    </Field>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100"
                    >
                        {t.cancel}
                    </button>

                    <button
                        onClick={async () => {
                            const payload = isAssignedUser ? { status: form.status } : form;
                            await onSave(payload);
                        }}
                        className="rounded-2xl bg-[#e42526] px-5 py-2.5 text-sm font-black text-white hover:bg-[#c91f20]"
                    >
                        {t.saveChanges}
                    </button>
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