"use client";

import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { STATUSES, Status, Task, TasksByStatus, UserInfo } from "./taskTypes";
import { findTask, formatDMY } from "./taskUtils";
import MultiSelectDropdown from "./MultiSelectDropdown";
import UserBadge from "./UserBadge";
import { PriorityPill, StatusBadge } from "./TaskBadges";

const DateRangePicker = dynamic(() => import("./DateRangePicker"), {
  ssr: false,
  loading: () => (
    <div className="h-11 w-full animate-pulse rounded-2xl bg-slate-100" />
  ),
});

export default function ListView({
  t,
  lang,
  users,
  statusLabels,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  assignedFilter,
  setAssignedFilter,
  startRange,
  setStartRange,
  dueRange,
  setDueRange,
  setSearchInput,
  setQ,
  page,
  setPage,
  totalPages,
  filteredFlat,
  paginatedTasks,
  sortBy,
  sortDir,
  toggleSort,
  can,
  setViewTask,
  setDrawerOpen,
  setSelectedTask,
  tasksBy,
  setTasksBy,
  deleteTask,
  pushActivity,
}: {
  t: any;
  lang: string;
  users: UserInfo[];
  statusLabels: Record<Status, string>;
  statusFilter: Status[];
  setStatusFilter: (v: Status[]) => void;
  priorityFilter: string[];
  setPriorityFilter: (v: string[]) => void;
  assignedFilter: string[];
  setAssignedFilter: (v: string[]) => void;
  startRange: [string | null, string | null];
  setStartRange: (v: [string | null, string | null]) => void;
  dueRange: [string | null, string | null];
  setDueRange: (v: [string | null, string | null]) => void;
  setSearchInput: (v: string) => void;
  setQ: (v: string) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  filteredFlat: Task[];
  paginatedTasks: Task[];
  sortBy:
    | "title"
    | "status"
    | "priority"
    | "start_date"
    | "due_date"
    | "assigned_to";
  sortDir: "asc" | "desc";
  toggleSort: (col: any) => void;
  can: (key: string) => boolean;
  setViewTask: (t: Task) => void;
  setDrawerOpen: (v: boolean) => void;
  setSelectedTask: (t: Task) => void;
  tasksBy: TasksByStatus;
  setTasksBy: (v: TasksByStatus) => void;
  deleteTask: (taskId: string) => Promise<void>;
  pushActivity: (msg: string) => void;
}) {
  const sortIcon = (key: string) =>
    sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <>
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <MultiSelectDropdown
            label={t.status}
            placeholder={t.selectStatus}
            value={statusFilter}
            onChange={(vals) => {
              setStatusFilter(vals as Status[]);
              setPage(1);
            }}
            options={STATUSES.map((s) => ({
              value: s,
              label: statusLabels[s],
            }))}
          />

          <MultiSelectDropdown
            label={t.priority}
            placeholder={t.selectPriority}
            value={priorityFilter}
            onChange={(vals) => {
              setPriorityFilter(vals);
              setPage(1);
            }}
            options={[
              { value: "LOW", label: t.low },
              { value: "MEDIUM", label: t.medium },
              { value: "HIGH", label: t.high },
              { value: "URGENT", label: t.urgent },
            ]}
          />

          <MultiSelectDropdown
            label={t.assignees}
            placeholder={t.selectEmployee}
            value={assignedFilter}
            onChange={(vals) => {
              setAssignedFilter(vals);
              setPage(1);
            }}
            options={users.map((u) => ({
              value: u.id,
              label: u.name,
            }))}
          />

          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              {t.startDateRange}
            </div>

            <DateRangePicker
              value={startRange}
              placeholder={[t.start, t.end]}
              onChange={(value) => {
                setStartRange(value);
                setPage(1);
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              {t.endDateRange}
            </div>

            <DateRangePicker
              value={dueRange}
              placeholder={[t.start, t.end]}
              onChange={(value) => {
                setDueRange(value);
                setPage(1);
              }}
            />
          </div>

          <button
            onClick={() => {
              setStatusFilter([]);
              setPriorityFilter([]);
              setAssignedFilter([]);
              setStartRange([null, null]);
              setDueRange([null, null]);
              setSearchInput("");
              setQ("");
            }}
            className="self-end rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            {t.clear}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-black text-slate-950">{t.tasksTable}</div>
          <div className="text-sm font-bold text-slate-500">
            {t.page} <span className="text-slate-900">{page}</span> /{" "}
            <span className="text-slate-900">{totalPages}</span> —{" "}
            <span className="text-slate-900">{filteredFlat.length}</span>{" "}
            {t.items}
          </div>
        </div>

        <div className="hidden w-full overflow-x-auto lg:block">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-100">
              <tr>
                {[
                  ["title", t.taskName],
                  ["status", t.status],
                  ["priority", t.priority],
                  ["start_date", t.startDate],
                  ["due_date", t.endDate],
                  ["assigned_to", t.assignees],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="cursor-pointer px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-200"
                  >
                    {label}
                    {sortIcon(key)}
                  </th>
                ))}

                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                  {t.files}
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500">
                  {t.actions}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedTasks.map((task) => (
                <tr key={task.id} className="transition hover:bg-[#fff8f8]">
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-950">
                      {task.title}
                    </div>

                    {task.creator_name && (
                      <div className="text-[11px] font-bold text-slate-400">
                        {task.creator_name} {t.createdByUser}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge status={String(task.status)} />
                  </td>

                  <td className="px-4 py-3">
                    <PriorityPill p={String(task.priority)} />
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {formatDMY(task.start_date)}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {formatDMY(task.due_date)}
                  </td>

                  <td className="px-4 py-3">
                    {task.assigned_to?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {task.assigned_to.map((u, i) => (
                          <UserBadge key={i} userId={u} users={users} />
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {task.files?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {task.files.map((file, i) => (
                          <button
                            key={i}
                            onClick={async (e) => {
                              e.stopPropagation();

                              if (!file?.path) return;

                              const { data, error } = await supabase.storage
                                .from("task-files")
                                .createSignedUrl(file.path, 60);

                              if (error || !data?.signedUrl) return;

                              const link = document.createElement("a");
                              link.href = data.signedUrl;
                              link.setAttribute(
                                "download",
                                file.name || "file"
                              );
                              link.style.display = "none";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            <Download size={13} className="mr-1" />
                            {file.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <div className="relative">
                        <button
                          onClick={() => {
                            setViewTask(task);
                            setDrawerOpen(true);
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          {t.view}
                        </button>

                        {task.comment_count ? (
                          <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">
                            {task.comment_count}
                          </span>
                        ) : null}
                      </div>

                      {can("tasks.edit.list") && (
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                        >
                          {t.edit}
                        </button>
                      )}

                      {can("tasks.delete.list") && (
                        <button
                          onClick={async () => {
                            if (!confirm(t.confirmDeleteTask)) return;

                            const snapshot = tasksBy;
                            const f = findTask(tasksBy, task.id);

                            if (!f) return;

                            const next: TasksByStatus = {
                              TODO: [...tasksBy.TODO],
                              IN_PROGRESS: [...tasksBy.IN_PROGRESS],
                              DONE: [...tasksBy.DONE],
                              CANCELLED: [...tasksBy.CANCELLED],
                            };

                            next[f.status].splice(f.index, 1);
                            setTasksBy(next);

                            try {
                              await deleteTask(task.id);
                              pushActivity(`• Deleted "${task.title}"`);
                            } catch {
                              setTasksBy(snapshot);
                              pushActivity(`• Delete failed "${task.title}"`);
                            }
                          }}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                        >
                          {t.delete}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    {t.tasksNotFound}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 p-4 lg:hidden">
          {paginatedTasks.map((task) => (
            <div
              key={task.id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-black text-slate-950">
                    {task.title}
                  </div>

                  {task.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {task.description}
                    </div>
                  )}
                </div>

                <PriorityPill p={String(task.priority)} />
              </div>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>
                  {t.status}: {task.status}
                </div>

                <div>
                  {t.startDate}: {formatDMY(task.start_date)}
                </div>

                <div>
                  {t.endDate}: {formatDMY(task.due_date)}
                </div>

                <div>
                  {t.assignedTo}
                  {task.assigned_to?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {task.assigned_to.map((u, i) => (
                        <UserBadge key={i} userId={u} users={users} />
                      ))}
                    </div>
                  ) : (
                    " -"
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setViewTask(task);
                    setDrawerOpen(true);
                  }}
                  className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-black"
                >
                  {t.view}
                </button>

                {can("tasks.edit.list") && (
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="flex-1 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700"
                  >
                    {t.edit}
                  </button>
                )}
              </div>
            </div>
          ))}

          {paginatedTasks.length === 0 && (
            <div className="py-6 text-center text-slate-500">{t.noTasks}</div>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            disabled={page <= 1}
          >
            <ChevronLeft size={16} />
            {t.previous}
          </button>

          <div className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white">
            {page} / {totalPages}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            disabled={page >= totalPages}
          >
            {t.next}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}