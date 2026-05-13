"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Clock3,
  Download,
  Edit3,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Printer,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { message } from "antd";
import { supabase } from "@/lib/supabaseClient";
import type { Status, Task, TasksByStatus, UserInfo } from "./taskTypes";
import type { RichEditorApi } from "./RichCommentEditor";
import { formatDMY, findTask } from "./taskUtils";
import { PriorityPill, StatusBadge } from "./TaskBadges";
import UserBadge from "./UserBadge";

function stripHtml(value?: string | null) {
  if (!value) return "";

  return String(value)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function priorityLabel(priority?: string | null) {
  if (priority === "LOW") return "Aşağı";
  if (priority === "MEDIUM") return "Orta";
  if (priority === "HIGH") return "Yüksək";
  if (priority === "URGENT") return "Təcili";
  return priority || "-";
}

function openTaskPrintWindow(task: Task, comments: any[], t: any) {
  const now = new Date().toLocaleString("az-AZ");

  const assignees = task.assigned_to?.length
    ? task.assigned_to.join(", ")
    : "-";

  const files = task.files?.length
    ? task.files.map((f: any) => f?.name).filter(Boolean).join(", ")
    : "-";

  const commentRows = comments.length
    ? comments
        .map(
          (c, index) => `
            <tr>
              <td class="center">${index + 1}</td>
              <td>
                <div class="comment-author">${escapeHtml(
                  c.author_name || "-"
                )}</div>
                <div class="muted">${escapeHtml(
                  formatDMY(c.created_at, true)
                )}</div>
              </td>
              <td>${escapeHtml(stripHtml(c.message)) || "-"}</td>
              <td>${
                Array.isArray(c.files) && c.files.length
                  ? escapeHtml(
                      c.files
                        .map((f: any) => f.name)
                        .filter(Boolean)
                        .join(", ")
                    )
                  : "-"
              }</td>
            </tr>
          `
        )
        .join("")
    : "";

  const html = `
    <!doctype html>
    <html lang="az">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(task.title || "Task")}</title>
        <style>
          * { box-sizing: border-box; }

          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, sans-serif;
          }

          body { padding: 20px; }

          .top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;
            border-bottom: 2px solid #111827;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }

          .badge {
            display: inline-block;
            background: #fff1f1;
            color: #c91f20;
            padding: 5px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 900;
            margin-bottom: 8px;
          }

          h1 {
            margin: 0;
            font-size: 23px;
            line-height: 1.25;
            font-weight: 900;
          }

          h2 {
            margin: 22px 0 10px;
            font-size: 15px;
            font-weight: 900;
            color: #111827;
          }

          .meta {
            margin-top: 7px;
            color: #6b7280;
            font-size: 12px;
            font-weight: 700;
          }

          .summary {
            text-align: right;
            font-size: 12px;
            color: #374151;
            font-weight: 800;
            white-space: nowrap;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .card {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 10px 12px;
            min-height: 58px;
          }

          .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            font-weight: 900;
            margin-bottom: 4px;
          }

          .value {
            font-size: 12px;
            font-weight: 800;
            color: #111827;
            word-break: break-word;
          }

          .description {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 12px;
            font-size: 12px;
            line-height: 1.55;
            white-space: pre-wrap;
            word-break: break-word;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 11px;
          }

          th, td {
            border: 1px solid #d1d5db;
            padding: 7px 8px;
            vertical-align: top;
            text-align: left;
            word-break: break-word;
          }

          th {
            background: #f3f4f6;
            color: #374151;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-weight: 900;
          }

          .center { text-align: center; }
          .muted { color: #6b7280; font-size: 10.5px; font-weight: 700; margin-top: 3px; }
          .comment-author { font-weight: 900; color: #111827; }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          @media print {
            body { padding: 0; }
          }
        </style>
      </head>

      <body>
        <div class="top">
          <div>
            <div class="badge">Task Flow · ${escapeHtml(
              t.taskDetails || "Task details"
            )}</div>
            <h1>${escapeHtml(task.title || "-")}</h1>
            <div class="meta">Çap tarixi: ${escapeHtml(now)}</div>
          </div>

          <div class="summary">
            Status: ${escapeHtml(String(task.status || "-").replace("_", " "))}<br />
            Prioritet: ${escapeHtml(priorityLabel(task.priority))}
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="label">${escapeHtml(t.startDate || "Başlama")}</div>
            <div class="value">${escapeHtml(formatDMY(task.start_date))}</div>
          </div>

          <div class="card">
            <div class="label">${escapeHtml(t.endDate || "Son tarix")}</div>
            <div class="value">${escapeHtml(formatDMY(task.due_date))}</div>
          </div>

          <div class="card">
            <div class="label">${escapeHtml(t.createdBy || "Yaradan")}</div>
            <div class="value">${escapeHtml(task.creator_name || "-")}</div>
          </div>

          <div class="card">
            <div class="label">${escapeHtml(t.createdAt || "Yaradılma")}</div>
            <div class="value">${escapeHtml(
              formatDMY(task.created_at, true)
            )}</div>
          </div>

          <div class="card">
            <div class="label">${escapeHtml(t.updatedAt || "Yenilənmə")}</div>
            <div class="value">${escapeHtml(
              formatDMY(task.updated_at, true)
            )}</div>
          </div>

          <div class="card">
            <div class="label">${escapeHtml(t.updatedBy || "Yeniləyən")}</div>
            <div class="value">${escapeHtml(task.updated_by_name || "-")}</div>
          </div>

          <div class="card">
            <div class="label">${escapeHtml(
              t.assignees || "Təyin olunanlar"
            )}</div>
            <div class="value">${escapeHtml(assignees)}</div>
          </div>

          <div class="card">
            <div class="label">${escapeHtml(t.files || "Fayllar")}</div>
            <div class="value">${escapeHtml(files)}</div>
          </div>
        </div>

        <h2>${escapeHtml(t.description || "Təsvir")}</h2>
        <div class="description">${escapeHtml(
          stripHtml(task.description) || "-"
        )}</div>

        <h2>${escapeHtml(t.comments || "Şərhlər")} (${comments.length})</h2>
        ${
          comments.length
            ? `
              <table>
                <thead>
                  <tr>
                    <th style="width: 42px;">№</th>
                    <th style="width: 22%;">Müəllif</th>
                    <th>Şərh</th>
                    <th style="width: 22%;">Fayllar</th>
                  </tr>
                </thead>
                <tbody>${commentRows}</tbody>
              </table>
            `
            : `<div class="description">${escapeHtml(
                t.noComments || "Şərh yoxdur"
              )}</div>`
        }

        <script>
          window.onload = function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=900,height=900");

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

const RichCommentEditor = dynamic(() => import("./RichCommentEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[130px] animate-pulse rounded-2xl bg-slate-100" />
  ),
});

export default function ViewTaskDrawer({
  t,
  lang,
  user,
  viewTask,
  drawerOpen,
  setDrawerOpen,
  setViewTask,
  comments,
  setComments,
  commentFiles,
  setCommentFiles,
  users,
  can,
  tasksBy,
  setTasksBy,
  deleteTask,
  pushActivity,
  moveTask,
  updateTask,
  setSelectedTask,
  handleAddComment,
}: {
  t: any;
  lang: string;
  user: any;
  viewTask: Task;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  setViewTask: (v: Task | null | ((p: Task | null) => Task | null)) => void;
  comments: any[];
  setComments: React.Dispatch<React.SetStateAction<any[]>>;
  commentFiles: File[];
  setCommentFiles: React.Dispatch<React.SetStateAction<File[]>>;
  users: UserInfo[];
  can: (key: string) => boolean;
  tasksBy: TasksByStatus;
  setTasksBy: (v: TasksByStatus) => void;
  deleteTask: (taskId: string) => Promise<void>;
  pushActivity: (msg: string) => void;
  moveTask: (taskId: string, nextStatus: Status) => void;
  updateTask: (id: string, updates: any) => Promise<void>;
  setSelectedTask: (task: Task) => void;
  handleAddComment: (editorApi: RichEditorApi | null) => Promise<void>;
}) {
  const editorRef = useRef<RichEditorApi | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mouseDownOnOverlay, setMouseDownOnOverlay] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      setVisible(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteModalOpen && !deleting) {
          setDeleteModalOpen(false);
          return;
        }

        if (!deleting) close();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, deleteModalOpen, deleting]);

  const isCreator = viewTask?.created_by === user.id;

  const close = () => {
    if (deleting) return;

    setVisible(false);
    setCommentFiles([]);
    setDeleteModalOpen(false);

    window.setTimeout(() => {
      setDrawerOpen(false);
      setViewTask(null);
    }, 260);
  };

  const downloadTaskFile = async (path: string) => {
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("task-files")
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      message.error("Fayl açıla bilmədi");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const downloadCommentFile = async (path: string) => {
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("task-comment-files")
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      message.error("Fayl açıla bilmədi");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeleteFromDrawer = async () => {
    setDeleting(true);

    const snapshot = tasksBy;
    const f = findTask(tasksBy, viewTask.id);

    if (!f) {
      setDeleting(false);
      setDeleteModalOpen(false);
      return;
    }

    const next: TasksByStatus = {
      TODO: [...tasksBy.TODO],
      IN_PROGRESS: [...tasksBy.IN_PROGRESS],
      DONE: [...tasksBy.DONE],
      CANCELLED: [...tasksBy.CANCELLED],
    };

    next[f.status].splice(f.index, 1);
    setTasksBy(next);

    try {
      await deleteTask(viewTask.id);
      pushActivity(`• Deleted "${viewTask.title}"`);
      message.success(t.deleted || "Silindi");
      setDeleteModalOpen(false);
      close();
    } catch {
      setTasksBy(snapshot);
      pushActivity(`• Delete failed "${viewTask.title}"`);
      message.error(t.error || "Silinmədi");
    } finally {
      setDeleting(false);
    }
  };

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={[
        "fixed left-0 top-0 z-[9999] h-[100dvh] w-screen overflow-hidden bg-[#020617]/70 transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      onMouseDown={(e) => {
        if (deleteModalOpen) return;
        if (e.target === e.currentTarget) setMouseDownOnOverlay(true);
      }}
      onMouseUp={(e) => {
        if (deleteModalOpen) return;
        if (e.target === e.currentTarget && mouseDownOnOverlay) close();
        setMouseDownOnOverlay(false);
      }}
    >
      <div
        className={[
          "ml-auto flex h-[100dvh] w-full max-w-[780px] flex-col overflow-hidden bg-[#f6f7fb] shadow-2xl",
          "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-80",
        ].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#e42526]/10 blur-3xl" />
          <div className="absolute -bottom-24 left-24 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
                    <FileText size={13} />
                    {t.taskDetails}
                  </span>

                  <StatusBadge status={String(viewTask.status)} />
                  <PriorityPill p={String(viewTask.priority)} />
                </div>

                <h2 className="line-clamp-2 text-xl font-black leading-7 tracking-tight text-slate-950 sm:text-2xl">
                  {viewTask.title}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                    <UserRound size={13} />
                    {viewTask.creator_name ?? "-"}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                    <Clock3 size={13} />
                    {formatDMY(viewTask.created_at, true)}
                  </span>

                  {viewTask.comment_count ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                      <MessageCircle size={13} />
                      {viewTask.comment_count}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                disabled={deleting}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Bağla"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {can("tasks.export.drawer") && (
                <ActionButton
                  icon={Download}
                  label={t.export}
                  onClick={async () => {
                    const XLSX = await import("xlsx");

                    const data = [
                      {
                        Başlıq: viewTask.title,
                        Təsvir: viewTask.description ?? "",
                        Status: String(viewTask.status).replace("_", " "),
                        Prioritet: viewTask.priority,
                        "Başlama tarixi": formatDMY(viewTask.start_date),
                        "Son tarix": formatDMY(viewTask.due_date),
                        "Təyin olunan": (viewTask.assigned_to ?? []).join(", "),
                        Fayllar: (viewTask.files ?? [])
                          .map((f) => f.name)
                          .join(", "),
                        "Yaradılma tarixi": formatDMY(
                          viewTask.created_at,
                          true
                        ),
                        "Yenilənmə tarixi": formatDMY(
                          viewTask.updated_at,
                          true
                        ),
                      },
                    ];

                    const worksheet = XLSX.utils.json_to_sheet(data);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(
                      workbook,
                      worksheet,
                      "Tapşırıq"
                    );

                    const safeName = (viewTask.title || "task")
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9\-]/g, "")
                      .slice(0, 50);

                    XLSX.writeFile(workbook, `${safeName || "task"}.xlsx`);
                  }}
                />
              )}

              {can("tasks.print.drawer") && (
                <ActionButton
                  icon={Printer}
                  label={t.print}
                  onClick={() => openTaskPrintWindow(viewTask, comments, t)}
                />
              )}

              {can("tasks.edit.drawer") && (
                <ActionButton
                  icon={Edit3}
                  label={t.edit}
                  variant="indigo"
                  onClick={() => {
                    setVisible(false);
                    window.setTimeout(() => {
                      setDrawerOpen(false);
                      setSelectedTask(viewTask);
                    }, 220);
                  }}
                />
              )}

              {can("tasks.delete.drawer") && (
                <ActionButton
                  icon={Trash2}
                  label={t.delete}
                  variant="red"
                  onClick={() => setDeleteModalOpen(true)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-4">
            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <SectionTitle icon={FileText} title={t.description} />

              <div className="mt-3 min-h-[78px] whitespace-pre-wrap rounded-3xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">
                {viewTask.description || "-"}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard
                icon={CalendarDays}
                label={t.startDate}
                value={formatDMY(viewTask.start_date)}
              />
              <InfoCard
                icon={Clock3}
                label={t.endDate}
                value={formatDMY(viewTask.due_date)}
              />
              <InfoCard
                icon={UserRound}
                label={t.createdBy}
                value={viewTask.creator_name ?? "-"}
              />
              <InfoCard
                icon={Clock3}
                label={t.createdAt}
                value={formatDMY(viewTask.created_at, true)}
              />
              <InfoCard
                icon={Clock3}
                label={t.updatedAt}
                value={formatDMY(viewTask.updated_at, true)}
              />
              <InfoCard
                icon={UserRound}
                label={t.updatedBy}
                value={viewTask.updated_by_name ?? "-"}
              />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <SectionTitle icon={UserRound} title={t.assignees} />

              <div className="mt-3">
                {viewTask.assigned_to?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {viewTask.assigned_to.map((u, i) => (
                      <UserBadge key={i} userId={u} users={users} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-slate-400">-</div>
                )}
              </div>
            </section>

            {viewTask.files?.length ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle icon={Paperclip} title={t.files} />

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                    {viewTask.files.length}
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  {viewTask.files.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => downloadTaskFile(f.path)}
                      title={f.name}
                      className="group flex w-full min-w-0 items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm transition group-hover:bg-indigo-100">
                          <Paperclip size={16} />
                        </span>

                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="block max-w-full truncate text-sm font-black text-slate-700 group-hover:text-indigo-700">
                            {f.name}
                          </span>

                          {typeof f.size === "number" && (
                            <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                              {(f.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                        </span>
                      </span>

                      <Download
                        size={16}
                        className="shrink-0 text-slate-400 group-hover:text-indigo-600"
                      />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-black text-slate-950">
                Status əməliyyatları
              </div>

              <div className="flex flex-wrap gap-2">
                {viewTask.status !== "DONE" &&
                  viewTask.status !== "CANCELLED" && (
                    <button
                      type="button"
                      onClick={async () => {
                        let nextStatus: Status | null = null;

                        if (viewTask.status === "TODO") {
                          nextStatus = "IN_PROGRESS";
                        }

                        if (viewTask.status === "IN_PROGRESS") {
                          nextStatus = "DONE";
                        }

                        if (!nextStatus) return;

                        moveTask(viewTask.id, nextStatus);
                        await updateTask(viewTask.id, { status: nextStatus });

                        setViewTask((prev: Task | null) =>
                          prev ? { ...prev, status: nextStatus } : prev
                        );
                      }}
                      className="rounded-2xl bg-[#e42526] px-4 py-2 text-xs font-black text-white transition hover:bg-[#c91f20] active:scale-[0.98]"
                    >
                      {viewTask.status === "TODO" && t.startTask}
                      {viewTask.status === "IN_PROGRESS" && t.completeTask}
                    </button>
                  )}

                {(viewTask.status === "CANCELLED" ||
                  viewTask.status === "DONE") &&
                  isCreator && (
                    <button
                      type="button"
                      onClick={async () => {
                        moveTask(viewTask.id, "TODO");
                        await updateTask(viewTask.id, { status: "TODO" });

                        setViewTask((prev: Task | null) =>
                          prev ? { ...prev, status: "TODO" } : prev
                        );
                      }}
                      className="rounded-2xl bg-slate-200 px-4 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-300 active:scale-[0.98]"
                    >
                      {t.reopenTask}
                    </button>
                  )}
              </div>
            </section>

            {viewTask.allow_comments !== false && (
              <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <SectionTitle icon={MessageCircle} title={t.comments} />

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                    {comments.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {comments.length ? (
                    comments.map((c) => (
                      <CommentCard
                        key={c.id}
                        comment={c}
                        t={t}
                        downloadCommentFile={downloadCommentFile}
                      />
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-400">
                      {t.noComments}
                    </div>
                  )}
                </div>

                <div className="mt-5 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition focus-within:border-[#e42526]/50 focus-within:shadow-md">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2">
                    <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
                      <button
                        type="button"
                        onClick={() => editorRef.current?.toggleBold()}
                        className="grid h-8 w-8 place-items-center rounded-lg text-sm font-black text-slate-700 transition hover:bg-[#fff1f1] hover:text-[#e42526]"
                        title="Bold"
                      >
                        B
                      </button>

                      <button
                        type="button"
                        onClick={() => editorRef.current?.toggleItalic()}
                        className="grid h-8 w-8 place-items-center rounded-lg text-sm italic text-slate-700 transition hover:bg-[#fff1f1] hover:text-[#e42526]"
                        title="Italic"
                      >
                        I
                      </button>
                    </div>

                    <div className="flex-1" />

                    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                      <Paperclip size={14} />
                      {t.file}
                      <input
                        type="file"
                        hidden
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const max = 20 * 1024 * 1024;
                          const valid: File[] = [];

                          for (const file of files) {
                            if (file.size > max) {
                              message.error(`"${file.name}" 20MB-dan böyükdür`);
                              continue;
                            }

                            valid.push(file);
                          }

                          setCommentFiles(valid);
                        }}
                      />
                    </label>
                  </div>

                  <div className="max-h-[260px] min-h-[145px] overflow-y-auto bg-white px-4 py-4">
                    <RichCommentEditor
                      placeholder={t.writeComment}
                      valueKey={lang}
                      onReady={(api) => {
                        editorRef.current = api;
                      }}
                    />
                  </div>

                  {commentFiles.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="mb-1 text-xs font-black uppercase tracking-wide text-slate-400">
                        Seçilmiş fayllar
                      </div>

                      {commentFiles.map((file, i) => (
                        <div
                          key={i}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                          title={file.name}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                              <Paperclip size={15} />
                            </span>

                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="truncate font-black text-slate-700">
                                {file.name}
                              </div>
                              <div className="text-[11px] font-bold text-slate-400">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setCommentFiles((prev) =>
                                prev.filter((_, index) => index !== i)
                              )
                            }
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-50 font-black text-red-500 transition hover:bg-red-100"
                            title="Sil"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
                    <div className="hidden text-xs font-semibold text-slate-400 sm:block">
                      Şərh və ya fayl əlavə edib göndərə bilərsiniz
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddComment(editorRef.current)}
                      className="ml-auto flex h-10 items-center gap-2 rounded-2xl bg-[#e42526] px-5 text-sm font-black text-white shadow-sm shadow-[#e42526]/20 transition hover:bg-[#c91f20] active:scale-[0.98]"
                    >
                      <Send size={16} />
                      {t.send}
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {deleteModalOpen && (
        <DeleteConfirmModal
          title={viewTask.title}
          loading={deleting}
          t={t}
          onClose={() => {
            if (!deleting) setDeleteModalOpen(false);
          }}
          onConfirm={handleDeleteFromDrawer}
        />
      )}
    </div>,
    document.body
  );
}

function DeleteConfirmModal({
  title,
  loading,
  t,
  onClose,
  onConfirm,
}: {
  title: string;
  loading: boolean;
  t: any;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10050] grid place-items-center bg-slate-950/55 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-[30px] border border-slate-200 bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-red-50 text-red-600">
          <Trash2 size={26} />
        </div>

        <h3 className="mt-4 text-center text-xl font-black text-slate-950">
          {t.confirmDeleteTask || "Tapşırığı silmək istəyirsiniz?"}
        </h3>

        <p className="mx-auto mt-2 max-w-sm text-center text-sm font-medium leading-6 text-slate-500">
          Bu tapşırıq log bölməsinə göndəriləcək və lazım olsa geri qaytarıla
          bilər.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">
            Task
          </div>

          <div className="mt-1 line-clamp-2 text-sm font-black text-slate-900">
            {title}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.cancel || "Ləğv et"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Silinir...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                {t.delete || "Sil"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: any;
  label: string;
  onClick: () => void;
  variant?: "default" | "indigo" | "red";
}) {
  const cls =
    variant === "red"
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : variant === "indigo"
        ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black transition active:scale-[0.98]",
        cls,
      ].join(" ")}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-black text-slate-950">
      <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526]">
        <Icon size={16} />
      </span>
      {title}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        <Icon size={15} />
        {label}
      </div>

      <div className="min-w-0 truncate text-sm font-black text-slate-800">
        {value ?? "-"}
      </div>
    </div>
  );
}

function CommentCard({
  comment,
  t,
  downloadCommentFile,
}: {
  comment: any;
  t: any;
  downloadCommentFile: (path: string) => Promise<void>;
}) {
  const seenBy = Array.isArray(comment.reads)
    ? comment.reads.filter((r: any) => r.employee_id !== comment.author_id)
    : [];

  const initials = (comment.author_name || "?")
    .split(" ")
    .map((x: string) => x[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-xs font-black text-slate-700 shadow-sm">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-black text-slate-950">
              {comment.author_name || "-"}
            </span>

            <span className="text-xs font-bold text-slate-400">
              {formatDMY(comment.created_at, true)}
            </span>
          </div>

          {seenBy.length > 0 && (
            <div className="mt-1 text-xs font-bold text-emerald-600">
              {seenBy
                .map((r: any) =>
                  `${r.employees?.ad ?? ""} ${r.employees?.soyad ?? ""}`.trim()
                )
                .filter(Boolean)
                .join(", ")}{" "}
              {t.seenBy}
            </div>
          )}

          {comment.message && (
            <div className="prose prose-sm mt-2 max-w-none overflow-hidden text-slate-700">
              <div dangerouslySetInnerHTML={{ __html: comment.message }} />
            </div>
          )}

          {Array.isArray(comment.files) && comment.files.length > 0 && (
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {comment.files.map((f: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => downloadCommentFile(f.path)}
                  title={f.name}
                  className="group flex max-w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Paperclip size={14} className="shrink-0" />

                  <span className="block min-w-0 max-w-[160px] truncate sm:max-w-[260px]">
                    {f.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}