"use client";

import {
  CalendarDays,
  Columns3,
  Download,
  List,
  Printer,
  Sparkles,
} from "lucide-react";
import type { Task } from "./taskTypes";
import { formatDMY } from "./taskUtils";

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

function openTasksPrintWindow(tasks: Task[], t: any) {
  const now = new Date().toLocaleString("az-AZ");

  const rows = tasks
    .map((task, index) => {
      const assignees = task.assigned_to?.length
        ? task.assigned_to.join(", ")
        : "-";

      const files = task.files?.length
        ? task.files.map((f: any) => f?.name).filter(Boolean).join(", ")
        : "-";

      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>
            <div class="task-title">${escapeHtml(task.title || "-")}</div>
            ${
              task.description
                ? `<div class="task-desc">${escapeHtml(stripHtml(task.description))}</div>`
                : ""
            }
          </td>
          <td>${escapeHtml(String(task.status || "-").replace("_", " "))}</td>
          <td>${escapeHtml(priorityLabel(task.priority))}</td>
          <td>${escapeHtml(formatDMY(task.start_date))}</td>
          <td>${escapeHtml(formatDMY(task.due_date))}</td>
          <td>${escapeHtml(assignees)}</td>
          <td>${escapeHtml(files)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!doctype html>
    <html lang="az">
      <head>
        <meta charset="utf-8" />
        <title>Task Flow - Çap</title>
        <style>
          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, sans-serif;
          }

          body {
            padding: 18px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            border-bottom: 2px solid #111827;
            padding-bottom: 12px;
            margin-bottom: 14px;
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
            font-size: 22px;
            line-height: 1.2;
            font-weight: 900;
          }

          .meta {
            margin-top: 6px;
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

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 11px;
          }

          th,
          td {
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

          .center {
            text-align: center;
          }

          .task-title {
            font-weight: 900;
            color: #111827;
            font-size: 12px;
            line-height: 1.35;
          }

          .task-desc {
            margin-top: 4px;
            color: #6b7280;
            font-size: 10.5px;
            line-height: 1.35;
          }

          .empty {
            margin-top: 50px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            font-weight: 800;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          @media print {
            body {
              padding: 0;
            }

            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <div class="badge">Task Flow</div>
            <h1>${escapeHtml(t.tasks || "Tapşırıqlar")}</h1>
            <div class="meta">Çap tarixi: ${escapeHtml(now)}</div>
          </div>

          <div class="summary">
            Cəmi: ${tasks.length} tapşırıq
          </div>
        </div>

        ${
          tasks.length
            ? `
              <table>
                <thead>
                  <tr>
                    <th style="width: 42px;">№</th>
                    <th style="width: 30%;">Tapşırıq</th>
                    <th style="width: 10%;">Status</th>
                    <th style="width: 10%;">Prioritet</th>
                    <th style="width: 10%;">Başlama</th>
                    <th style="width: 10%;">Son tarix</th>
                    <th style="width: 18%;">Təyin olunanlar</th>
                    <th style="width: 12%;">Fayllar</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            `
            : `<div class="empty">Çap üçün tapşırıq yoxdur.</div>`
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

  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function TasksHeader({
  t,
  viewMode,
  setViewMode,
  can,
  filteredFlat,
}: {
  t: any;
  viewMode: "board" | "list" | "calendar";
  setViewMode: (v: "board" | "list" | "calendar") => void;
  can: (key: string) => boolean;
  filteredFlat: Task[];
}) {
  const viewBtn = (
    key: "board" | "list" | "calendar",
    label: string,
    Icon: any
  ) => (
    <button
      type="button"
      onClick={() => setViewMode(key)}
      className={[
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition",
        viewMode === key
          ? "bg-white text-[#e42526] shadow-sm"
          : "text-slate-500 hover:text-slate-900",
      ].join(" ")}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e42526]/10 blur-3xl" />
      <div className="absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff1f1] px-3 py-1.5 text-xs font-black text-[#c91f20]">
            <Sparkles size={14} />
            Task Flow
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {t.tasks}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Tapşırıqları board, siyahı və calendar görünüşündə idarə edin.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {viewBtn("board", t.board, Columns3)}
            {viewBtn("list", t.list, List)}
            {viewBtn("calendar", t.calendar, CalendarDays)}
          </div>

          <div className="flex items-center gap-2">
            {can("tasks.export.list") && (
              <button
                type="button"
                onClick={async () => {
                  if (!filteredFlat.length) return;

                  const XLSX = await import("xlsx");

                  const data = filteredFlat.map((task) => ({
                    Title: task.title,
                    Description: stripHtml(task.description),
                    Status: String(task.status).replace("_", " "),
                    Priority: task.priority,
                    StartDate: formatDMY(task.start_date),
                    EndDate: formatDMY(task.due_date),
                    Assignees: (task.assigned_to ?? []).join(", "),
                    Files: (task.files ?? []).map((f) => f.name).join(", "),
                    CreatedAt: formatDMY(task.created_at, true),
                    UpdatedAt: formatDMY(task.updated_at, true),
                  }));

                  const worksheet = XLSX.utils.json_to_sheet(data);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    "Tapşırıqlar"
                  );
                  XLSX.writeFile(workbook, "tapshiriqlar.xlsx");
                }}
                className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <Download size={16} />
                {t.export}
              </button>
            )}

            {can("tasks.print.list") && (
              <button
                type="button"
                onClick={() => openTasksPrintWindow(filteredFlat, t)}
                className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <Printer size={16} />
                {t.print}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}