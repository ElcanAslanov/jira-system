"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensors,
  useSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { Select } from "antd";

const { RangePicker } = DatePicker;

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

type TaskFile = {
  name: string;
  path: string;
  size?: number;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: Status | string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  start_date?: string | null;   // ✅ BURANI ƏLAVƏ ET
  due_date?: string | null;
  sort_index: number;
  assigned_to?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  files?: TaskFile[]; // 🔥 əlavə olundu
};

type TasksByStatus = Record<Status, Task[]>;

function isStatus(x: any): x is Status {
  return STATUSES.includes(x);
}

function groupByStatus(tasks: Task[]): TasksByStatus {
  const init: TasksByStatus = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
    CANCELLED: [],
  };
  for (const t of tasks) {
    const st = isStatus(t.status) ? t.status : "TODO";
    init[st].push({ ...t, status: st });
  }
  for (const st of STATUSES) {
    init[st].sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0));
  }
  return init;
}

function findTask(tasksBy: TasksByStatus, id: string) {
  for (const st of STATUSES) {
    const idx = tasksBy[st].findIndex((t) => t.id === id);
    if (idx !== -1) return { status: st, index: idx, task: tasksBy[st][idx] };
  }
  return null;
}

function getNewSortIndex(list: Task[], targetIndex: number) {
  // list already in desired order EXCEPT moved item inserted at targetIndex.
  const prev = list[targetIndex - 1];
  const next = list[targetIndex + 1];

  const prevVal = prev?.sort_index;
  const nextVal = next?.sort_index;

  // place between neighbors if possible
  if (typeof prevVal === "number" && typeof nextVal === "number") {
    if (prevVal === nextVal) return prevVal + 1;
    return prevVal + (nextVal - prevVal) / 2;
  }
  // to the top
  if (typeof nextVal === "number" && prevVal == null) {
    return nextVal - 1000;
  }
  // to the end
  if (typeof prevVal === "number" && nextVal == null) {
    return prevVal + 1000;
  }
  // fallback
  return Date.now();
}

function formatDMY(date?: string | null, withTime = false) {
  if (!date) return "-";

  // YYYY-MM-DD təhlükəsiz format
  if (!withTime && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  }

  const dt = new Date(date);
  if (isNaN(dt.getTime())) return date;

  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();

  if (!withTime) return `${day}/${month}/${year}`;

  const hours = String(dt.getHours()).padStart(2, "0");
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  const seconds = String(dt.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function PriorityPill({ p }: { p: string }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-xs border";
  const map: Record<string, string> = {
    LOW: "bg-gray-50 text-gray-700 border-gray-200",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
    HIGH: "bg-amber-50 text-amber-800 border-amber-200",
    URGENT: "bg-red-50 text-red-700 border-red-200",
  };
  const cls = map[p] ?? "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`${base} ${cls}`}>{p}</span>;
}

export default function TasksPage() {
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const { user, loading } = useUser();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [tasksBy, setTasksBy] = useState<TasksByStatus>(() => groupByStatus([]));

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isDraggingNow, setIsDraggingNow] = useState(false);
  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    const f = findTask(tasksBy, activeTaskId);
    return f?.task ?? null;
  }, [activeTaskId, tasksBy]);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [q, setQ] = useState("");

  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);

  const [startRange, setStartRange] = useState<[string | null, string | null]>([null, null]);
  const [dueRange, setDueRange] = useState<[string | null, string | null]>([null, null]);

  const filteredTasksBy = useMemo(() => {
    const out: TasksByStatus = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      CANCELLED: [],
    };

 for (const st of STATUSES) {
  out[st] = tasksBy[st].filter((t) => {

    // 🔍 search
    if (q.trim()) {
      const needle = q.toLowerCase();
      if (
        !(t.title ?? "").toLowerCase().includes(needle) &&
        !(t.description ?? "").toLowerCase().includes(needle)
      ) return false;
    }

    // STATUS
    if (statusFilter.length && !statusFilter.includes(t.status as Status)) {
      return false;
    }

    // PRIORITY
    if (priorityFilter.length && !priorityFilter.includes(t.priority)) {
      return false;
    }

    // ASSIGNED
    if (assignedFilter.length && !assignedFilter.includes(t.assigned_to ?? "")) {
      return false;
    }

    const [startFrom, startTo] = startRange;
    const [dueFrom, dueTo] = dueRange;

    if (startFrom && (!t.start_date || t.start_date < startFrom)) return false;
    if (startTo && (!t.start_date || t.start_date > startTo)) return false;

    if (dueFrom && (!t.due_date || t.due_date < dueFrom)) return false;
    if (dueTo && (!t.due_date || t.due_date > dueTo)) return false;

    return true;
  });
}

    return out;
  }, [
    tasksBy,
    q,
    statusFilter,
    priorityFilter,
    assignedFilter,
    startRange,
    dueRange
  ]);

  // table pagination (for ALL tasks, but filtered by search)
  const PAGE_SIZE = 6;
  const [page, setPage] = useState(1);

  const filteredFlat = useMemo(() => {
    const arr: Task[] = [];
    for (const st of STATUSES) arr.push(...filteredTasksBy[st]);
    // stable: status order + sort_index already sorted inside columns
    return arr;
  }, [filteredTasksBy]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredFlat.length / PAGE_SIZE));
  }, [filteredFlat.length]);

  useEffect(() => {
    // keep page valid
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredFlat.slice(start, start + PAGE_SIZE);
  }, [filteredFlat, page]);

  // activity log (lightweight)
  const [activity, setActivity] = useState<string[]>([]);
  const pushActivity = useCallback((msg: string) => {
    setActivity((p) => [msg, ...p].slice(0, 20));
  }, []);

  const getToken = useCallback(async () => {
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token ?? null;
  }, []);

  const loadTasks = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const res = await fetch("/api/tasks", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    console.log("API TASKS:", data.tasks); // debug üçün

    const tasks: Task[] = (data.tasks || []).map((t: any) => ({
      ...t,
      status: isStatus(t.status) ? t.status : "TODO",
      sort_index:
        typeof t.sort_index === "number"
          ? t.sort_index
          : Number(t.sort_index ?? 0),
      files: Array.isArray(t.files) ? t.files : [], // 🔥 BURASI VACİBDİR
    }));

    setRawTasks(tasks);
    setTasksBy(groupByStatus(tasks));
  }, [getToken]);

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {

      const token = await getToken();
      if (!token) throw new Error("No auth token");
      console.log("UPDATE TASK ID:", taskId);
      console.log("UPDATES:", updates);
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,   // 🔥 MÜTLƏQ OLMALIDIR
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok) {
        console.log("PUT ERROR:", data);
        throw new Error(data.error || "Update failed");
      }
    },
    [getToken]
  );

  const createTask = useCallback(
    async (payload: Partial<Task>) => {
      const token = await getToken();
      const res = await fetch(`/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-user-id": user?.id ?? "",
          "x-user-role": (user as any)?.role ?? "",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Create failed");
      }
      const data = await res.json();
      return data.task as Task | undefined;
    },
    [getToken, user?.id, user]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const token = await getToken();
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-user-id": user?.id ?? "",
          "x-user-role": (user as any)?.role ?? "",
        },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Delete failed");
      }
    },
    [getToken, user?.id, user]
  );

  useEffect(() => {
    if (!loading && user) loadTasks();
  }, [loading, user, loadTasks]);

  // realtime (only when user ready)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        // loadTasks();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, loadTasks]);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id);

    const found = findTask(tasksBy, id);

    // 🔒 DONE task drag olunmasın
    if (found?.task.status === "DONE") {
      return; // drag başlamır
    }

    setActiveTaskId(id);
    setIsDraggingNow(true);
  }, [tasksBy]);

  const prevSnapshotRef = useRef<TasksByStatus | null>(null);

  const handleDragEnd = useCallback(

    async (event: DragEndEvent) => {

      const { active, over } = event;
      setActiveTaskId(null);
      if (!over) return;


      const activeId = String(active.id);
      const overId = String(over.id);

      // We accept drop on:
      // 1) a column id (TODO, IN_PROGRESS...)
      // 2) a task id (meaning: same column reorder OR move into target column at that position)
      const activeFound = findTask(tasksBy, activeId);
      if (!activeFound) return;

      const overAsStatus = isStatus(overId) ? (overId as Status) : null;
      const overFoundTask = overAsStatus ? null : findTask(tasksBy, overId);

      // decide target status
      const targetStatus: Status = overAsStatus
        ? overAsStatus
        : (overFoundTask?.status ?? activeFound.status);

      // if search filter is on, dragging should still operate on FULL tasksBy,
      // but visually user drags within filtered columns; we apply to tasksBy anyway.

      const sourceStatus = activeFound.status;
      const sourceIndex = activeFound.index;

      // Build next state
      prevSnapshotRef.current = tasksBy;

      const next: TasksByStatus = {
        TODO: [...tasksBy.TODO],
        IN_PROGRESS: [...tasksBy.IN_PROGRESS],
        DONE: [...tasksBy.DONE],
        CANCELLED: [...tasksBy.CANCELLED],
      };

      // remove from source
      const [moved] = next[sourceStatus].splice(sourceIndex, 1);
      if (!moved) return;

      let targetIndex = next[targetStatus].length;

      if (overFoundTask && overFoundTask.status === targetStatus) {
        // drop on a task in target column -> insert at that index
        targetIndex = overFoundTask.index;
      }

      // insert into target
      const movedUpdated: Task = { ...moved, status: targetStatus };
      next[targetStatus].splice(targetIndex, 0, movedUpdated);

      // if same column and we inserted before/after, also ensure order with arrayMove semantics:
      // (already handled by remove+insert)
      // compute new sort_index for moved item in that target column
      const newSort = getNewSortIndex(next[targetStatus], targetIndex);
      next[targetStatus][targetIndex] = { ...next[targetStatus][targetIndex], sort_index: newSort };

      // optimistic
      setTasksBy(next);
      pushActivity(`• "${moved.title}" → ${targetStatus}`);

      try {
        await updateTask(activeId, { status: targetStatus, sort_index: newSort });
        // refresh in background (optional)
        // loadTasks();
      } catch (err: any) {
        // rollback
        if (prevSnapshotRef.current) setTasksBy(prevSnapshotRef.current);
        pushActivity(`• Update failed for "${moved.title}"`);
      }
    },

    [tasksBy, updateTask, loadTasks, pushActivity]
  );

  if (loading) return <div className="p-10">Loading...</div>;
  if (!user) return <div className="p-10">No user session</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold">🔥 Tapşırıqlar lövhəsi</h1>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search tasks..."
              className="w-[260px] md:w-[340px] border rounded-xl px-4 py-2 bg-white shadow-sm"
            />
          </div>

          <button
            onClick={() => router.push("/dashboard/tasks/new")}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-sm"
          >
            + New Task
          </button>



          <button
            onClick={() => {
              if (!filteredFlat.length) return;

              const data = filteredFlat.map((t) => ({
                "Başlıq": t.title,
                "Təsvir": t.description ?? "",
                "Status": t.status.replace("_", " "),
                "Prioritet": t.priority,
                "Başlama tarixi": formatDMY(t.start_date),   // ✅ BURANI ƏLAVƏ ET
                "Son tarix": formatDMY(t.due_date),
                "Təyin olunan": t.assigned_to ?? "",
                "Fayllar": (t.files ?? []).map(f => f.name).join(", "),
                "Yaradılma tarixi": formatDMY(t.created_at, true),
                "Yenilənmə tarixi": formatDMY(t.updated_at, true),
              }));

              const worksheet = XLSX.utils.json_to_sheet(data);
              const workbook = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(workbook, worksheet, "Tapşırıqlar");

              XLSX.writeFile(workbook, "tapshiriqlar.xlsx");
            }}
            className="border px-4 py-2 rounded-xl text-gray-700 hover:bg-white shadow-sm"
          >
            Export
          </button>

          <button
            onClick={() => window.print()}
            className="border px-4 py-2 rounded-xl text-gray-700 hover:bg-white shadow-sm"
          >
            Print
          </button>
        </div>
      </div>



      {/* BOARD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid md:grid-cols-4 gap-6">
          {STATUSES.map((st) => (
            <Column
              key={st}
              id={st}
              title={st}
              tasks={filteredTasksBy[st]}
              onSelect={setSelectedTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="bg-white p-4 rounded-xl shadow-2xl border w-[260px]">
              <div className="font-semibold">{activeTask.title}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{activeTask.status}</span>
                <PriorityPill p={String(activeTask.priority)} />
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="bg-white p-6 rounded-2xl shadow border grid md:grid-cols-3 lg:grid-cols-6 gap-6">

<MultiSelectDropdown
  label="Status"
  placeholder="Status seç"
  value={statusFilter}
  onChange={(vals) => {
    setStatusFilter(vals as Status[]);
    setPage(1);
  }}
  options={STATUSES.map((s) => ({
    value: s,
    label: s.replace("_", " "),
  }))}
/>

<MultiSelectDropdown
  label="Prioritet"
  placeholder="Prioritet seç"
  value={priorityFilter}
  onChange={(vals) => {
    setPriorityFilter(vals);
    setPage(1);
  }}
  options={[
    { value: "LOW", label: "LOW" },
    { value: "MEDIUM", label: "MEDIUM" },
    { value: "HIGH", label: "HIGH" },
    { value: "URGENT", label: "URGENT" },
  ]}
/>
     <MultiSelectDropdown
  label="Assigned"
  placeholder="User seç"
  value={assignedFilter}
  onChange={(vals) => {
    setAssignedFilter(vals);
    setPage(1);
  }}
  options={[
    ...new Set(
      rawTasks
        .map((t) => t.assigned_to)
        .filter((x): x is string => !!x)
    ),
  ].map((u) => ({
    value: u,
    label: u,
  }))}
/>

        {/* START RANGE */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600">Start Range</div>
          <RangePicker
            format="DD/MM/YYYY"
            value={[
              startRange[0] ? dayjs(startRange[0]) : null,
              startRange[1] ? dayjs(startRange[1]) : null,
            ]}
            onChange={(vals) => {
              setStartRange([
                vals?.[0] ? vals[0].format("YYYY-MM-DD") : null,
                vals?.[1] ? vals[1].format("YYYY-MM-DD") : null,
              ]);
              setPage(1);
            }}
            style={{ width: "100%" }}
          />
        </div>

        {/* DUE RANGE */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600">Due Range</div>
          <RangePicker
            format="DD/MM/YYYY"
            value={[
              dueRange[0] ? dayjs(dueRange[0]) : null,
              dueRange[1] ? dayjs(dueRange[1]) : null,
            ]}
            onChange={(vals) => {
              setDueRange([
                vals?.[0] ? vals[0].format("YYYY-MM-DD") : null,
                vals?.[1] ? vals[1].format("YYYY-MM-DD") : null,
              ]);
              setPage(1);
            }}
            style={{ width: "100%" }}
          />
        </div>

        {/* RESET */}
        <button
          onClick={() => {
            setStatusFilter([]);
            setPriorityFilter([]);
            setAssignedFilter([]);
            setStartRange([null, null]);
            setDueRange([null, null]);
            setQ("");
          }}
          className="bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 font-medium"
        >
          Sıfırla
        </button>

      </div>

      {/* TABLE + PAGINATION */}
      <div className="bg-white rounded-2xl shadow border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="font-semibold">Tapşırıqlar Cədvəli</div>
          <div className="text-sm text-gray-600">
            Page <span className="font-medium">{page}</span> /{" "}
            <span className="font-medium">{totalPages}</span> —{" "}
            <span className="font-medium">{filteredFlat.length}</span> items
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Priority</th>
              <th className="p-3 text-left">Start</th>
              <th className="p-3 text-left">Due</th>
              <th className="p-3 text-left">Assigned</th>
              <th className="p-3 text-left">Files</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.map((t) => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium text-gray-900">{t.title}</div>
                  {t.description ? (
                    <div className="text-xs text-gray-500 line-clamp-1">
                      {t.description}
                    </div>
                  ) : null}
                </td>

                <td className="p-3">{t.status}</td>

                <td className="p-3">
                  <PriorityPill p={String(t.priority)} />
                </td>

                <td className="p-3">{formatDMY(t.start_date)}</td>
                {/* ✅ DUE */}
                <td className="p-3">{formatDMY(t.due_date)}</td>

                {/* ✅ ASSIGNED */}
                <td className="p-3">
                  {t.assigned_to ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                        {t.assigned_to.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-gray-700">{t.assigned_to}</span>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>

                {/* ✅ FILES */}
                <td className="p-3">
                  {t.files?.length ? (
                    <div className="flex flex-col gap-1">
                      {t.files.map((file, i) => (
                        <button
                          key={i}
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from("task-files")
                              .createSignedUrl(file.path, 60);

                            if (!data?.signedUrl) return;

                            const res = await fetch(data.signedUrl);
                            const blob = await res.blob();

                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = file.name;   // 🔥 BURASI ƏSASDIR
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                          }}
                          className="text-xs text-indigo-600 hover:underline text-left"
                        >
                          📎 {file.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">

                    <button
                      onClick={() => {
                        setViewTask(t);
                        setDrawerOpen(true);
                      }}
                      className="border px-3 py-1.5 rounded-lg hover:bg-white"
                    >
                      Bax
                    </button>

                    <button
                      onClick={() => setSelectedTask(t)}
                      className="border px-3 py-1.5 rounded-lg hover:bg-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm("Delete this task?")) return;
                        await deleteTask(t.id);
                        loadTasks();
                      }}
                      className="border px-3 py-1.5 rounded-lg hover:bg-white text-red-600 border-red-200"
                    >
                      Delete
                    </button>

                  </div>
                </td>
              </tr>
            ))}

            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No tasks found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="flex items-center justify-between p-4 border-t bg-white">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border px-4 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50"
            disabled={page <= 1}
          >
            Prev
          </button>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="border px-4 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50"
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* ACTIVITY PANEL
      <div className="bg-white p-6 rounded-2xl shadow border">
        <h2 className="font-semibold mb-4">Activity Log</h2>
        <div className="text-sm text-gray-600 space-y-2">
          {activity.length ? (
            activity.map((line, i) => <div key={i}>{line}</div>)
          ) : (
            <div className="text-gray-500">No activity yet.</div>
          )}
        </div>
      </div> */}


      {/* EDIT DRAWER */}
      {selectedTask ? (
        <EditDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={async (updates) => {
            const taskId = selectedTask.id;

            // optimistic patch in state
            const snapshot = tasksBy;
            const f = findTask(tasksBy, taskId);

            if (f) {
              const next: TasksByStatus = {
                TODO: [...tasksBy.TODO],
                IN_PROGRESS: [...tasksBy.IN_PROGRESS],
                DONE: [...tasksBy.DONE],
                CANCELLED: [...tasksBy.CANCELLED],
              };

              const old = next[f.status][f.index];
              const patched: Task = { ...old, ...(updates as any) };

              // if status changed inside drawer, move to new column end
              const nextStatus: Status = isStatus(patched.status) ? (patched.status as Status) : f.status;

              // remove old
              next[f.status].splice(f.index, 1);

              // insert into target end
              const targetIndex = next[nextStatus].length;
              next[nextStatus].push(patched);

              // ensure sort_index reasonable
              const newSort = getNewSortIndex(next[nextStatus], targetIndex);
              next[nextStatus][targetIndex] = { ...next[nextStatus][targetIndex], sort_index: newSort };

              setTasksBy(next);

              try {
                await updateTask(taskId, { ...updates, sort_index: newSort });
                pushActivity(`• Edited "${patched.title}"`);
                setSelectedTask(null);
                loadTasks();
              } catch {
                setTasksBy(snapshot);
                pushActivity(`• Edit failed "${patched.title}"`);
              }
            } else {
              // fallback
              try {
                await updateTask(taskId, updates);
                setSelectedTask(null);
                loadTasks();
              } catch {
                // ignore
              }
            }
          }}
        />
      ) : null}




      {/* USERS STYLE VIEW DRAWER */}
      {viewTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            zIndex: 100000,
            display: "flex",
            justifyContent: "flex-end",
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? "auto" : "none",
            transition: "opacity 0.22s ease",
          }}
          onClick={() => {
            setDrawerOpen(false);
            setTimeout(() => setViewTask(null), 220);
          }}
        >
          <div
            className="drawer-print"
            style={{
              width: 600,
              height: "100%",
              background: "#fff",
              padding: 24,
              overflowY: "auto",
              boxShadow: "-30px 0 90px rgba(15,23,42,0.40)",
              transform: drawerOpen ? "translateX(0)" : "translateX(110%)",
              transition: "transform 0.22s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 900 }}>
                👤 Tapşırıq məlumatları
              </h2>

              <div style={{ display: "flex", gap: 8 }}>
                {/* EXPORT */}
                <button
                  onClick={() => {
                    const data = [{
                      "Başlıq": viewTask.title,
                      "Təsvir": viewTask.description ?? "",
                      "Status": viewTask.status.replace("_", " "),
                      "Prioritet": viewTask.priority,
                      "Başlama tarixi": formatDMY(viewTask.start_date),
                      "Son tarix": formatDMY(viewTask.due_date),
                      "Təyin olunan": viewTask.assigned_to ?? "",
                      "Fayllar": (viewTask.files ?? []).map(f => f.name).join(", "),
                      "Yaradılma tarixi": formatDMY(viewTask.created_at, true),
                      "Yenilənmə tarixi": formatDMY(viewTask.updated_at, true),
                    }];

                    const worksheet = XLSX.utils.json_to_sheet(data);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Tapşırıq");

                    const safeName = (viewTask.title || "task")
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9\-]/g, "")
                      .slice(0, 50);

                    XLSX.writeFile(workbook, `${safeName}.xlsx`);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Export
                </button>

                {/* PRINT */}
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Print
                </button>

                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setTimeout(() => setViewTask(null), 220);
                  }}
                >
                  ✖
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div style={{ marginTop: 20, display: "grid", gap: 12 }}>

              <DrawerRow label="Başlıq" value={viewTask.title} />

              <DrawerRow
                label="Təsvir"
                value={
                  <div
                    style={{
                      background: "#f9fafb",
                      padding: 12,
                      borderRadius: 10,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {viewTask.description || "-"}
                  </div>
                }
              />

              <DrawerRow
                label="Status"
                value={viewTask.status.replace("_", " ")}
              />

              <DrawerRow
                label="Prioritet"
                value={<PriorityPill p={String(viewTask.priority)} />}
              />

              <DrawerRow
                label="Başlama tarixi"
                value={formatDMY(viewTask.start_date)}
              />

              <DrawerRow
                label="Son tarix"
                value={formatDMY(viewTask.due_date)}
              />

              <DrawerRow
                label="Təyin olunan"
                value={viewTask.assigned_to || "-"}
              />

              <DrawerRow
                label="Yaradılma tarixi"
                value={formatDMY(viewTask.created_at, true)}
              />

              <DrawerRow
                label="Yenilənmə tarixi"
                value={formatDMY(viewTask.updated_at, true)}
              />

              {viewTask.files?.length ? (
                <DrawerRow
                  label="Fayllar"
                  value={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {viewTask.files.map((f, i) => (
                        <button
                          key={i}
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from("task-files")
                              .createSignedUrl(f.path, 60);

                            if (data?.signedUrl) {
                              window.open(data.signedUrl, "_blank");
                            }
                          }}
                          style={{
                            padding: "6px 10px",
                            background: "#eff6ff",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          📎 {f.name}
                        </button>
                      ))}
                    </div>
                  }
                />
              ) : null}

            </div>

          </div>
        </div>
      )}



      {/* CREATE MODAL */}
      {createOpen ? (
        <CreateTaskModal
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            // optimistic add into TODO end
            const snapshot = tasksBy;
            const next: TasksByStatus = {
              TODO: [...tasksBy.TODO],
              IN_PROGRESS: [...tasksBy.IN_PROGRESS],
              DONE: [...tasksBy.DONE],
              CANCELLED: [...tasksBy.CANCELLED],
            };

            const st: Status = isStatus(payload.status) ? (payload.status as Status) : "TODO";
            const tempId = `temp-${Math.random().toString(16).slice(2)}`;
            const tempTask: Task = {
              id: tempId,
              title: payload.title ?? "Untitled",
              description: payload.description ?? "",
              status: st,
              priority: (payload.priority as any) ?? "MEDIUM",
              start_date: payload.start_date ?? null,   // ✅ DÜZGÜN
              due_date: payload.due_date ?? null,
              sort_index: Date.now(),
              assigned_to: payload.assigned_to ?? null,
              created_by: user.id,
            };

            next[st].push(tempTask);
            setTasksBy(next);
            pushActivity(`• Created "${tempTask.title}"`);

            try {
              await createTask({
                ...payload,
                status: st,
                sort_index: tempTask.sort_index,
              });
              setCreateOpen(false);
              loadTasks();
            } catch {
              setTasksBy(snapshot);
              pushActivity(`• Create failed "${tempTask.title}"`);
            }
          }}
        />
      ) : null}
    </div>
  );
}


function MultiSelectDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string[]>(value);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTemp(value);
  }, [value]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>

      <div
        onClick={() => setOpen((p) => !p)}
        className="border rounded-xl px-3 py-2 bg-gray-50 cursor-pointer flex justify-between items-center"
      >
        <span className="text-sm text-gray-700">
          {value.length ? `${value.length} seçildi` : placeholder}
        </span>
        <span className="text-indigo-600 text-sm">▲</span>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-2xl shadow-xl border overflow-hidden">
          <div className="p-3 border-b">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Axtar..."
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filtered.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={temp.includes(opt.value)}
                  onChange={() => {
                    if (temp.includes(opt.value)) {
                      setTemp(temp.filter((v) => v !== opt.value));
                    } else {
                      setTemp([...temp, opt.value]);
                    }
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-between p-3 border-t bg-gray-50">
            <button
              onClick={() => setTemp([])}
              className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
            >
              Clear
            </button>

            <button
              onClick={() => {
                onChange(temp);
                setOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-50 border rounded-lg p-3">
      <div className="text-xs text-gray-400 uppercase mb-1">{label}</div>
      <div className="text-sm font-medium">{value ?? "-"}</div>
    </div>
  );
}

function DrawerRow({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 13 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>
        {value ?? "-"}
      </div>
    </div>
  );
}

/* COLUMN */
function Column({
  id,
  title,
  tasks,
  onSelect,
}: {
  id: Status;
  title: string;
  tasks: Task[];
  onSelect: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-2xl p-4 shadow border min-h-[220px] transition ${isOver ? "ring-2 ring-indigo-300" : ""
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{tasks.length}</span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onSelect={onSelect} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}



/* CARD */
function TaskCard({ task, onSelect }: { task: Task; onSelect: (t: Task) => void }) {

  const isDone = task.status === "DONE"; // 🔒 DONE check

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isDone, // 🔥 ƏSAS HİSSƏ — DONE drag disabled
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : isDone ? 0.7 : 1,
      }}
      {...attributes}
      {...(!isDone ? listeners : {})} // 🔒 DONE üçün drag deaktiv
      className={`bg-white p-4 rounded-xl shadow-sm border select-none ${isDone
        ? "cursor-default opacity-70"
        : "hover:shadow-md cursor-grab active:cursor-grabbing"
        }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(task);
      }}
    >
      <div className="font-semibold text-gray-900">
        {task.title}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-600">
        <PriorityPill p={String(task.priority)} />
        {task.files?.length ? (
          <div className="mt-2 text-xs">
            <button
              onClick={async () => {
                for (const file of task.files ?? []) {

                  const { data } = await supabase.storage
                    .from("task-files")
                    .createSignedUrl(file.path, 60);

                  if (!data?.signedUrl) continue;

                  const res = await fetch(data.signedUrl);
                  const blob = await res.blob();

                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = file.name;   // ✅ ƏSAS HİSSƏ — real fayl adı
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                }
              }}
              className="text-indigo-600 hover:underline"
            >
              📎 {task.files.length} file
            </button>
          </div>
        ) : null}
        <span className="text-gray-500">
          {task.due_date ? `Due: ${task.due_date}` : ""}
        </span>
      </div>
    </div>
  );
}



/* EDIT DRAWER */
type EditDrawerProps = {
  task: Task;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => Promise<void> | void;
};



function EditDrawer({ task, onClose, onSave }: EditDrawerProps) {
  const [form, setForm] = useState<Partial<Task>>({
    title: task.title,
    description: task.description ?? "",
    status: (task.status as any) ?? "TODO",
    priority: (task.priority as any) ?? "MEDIUM",
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    assigned_to: task.assigned_to ?? null,
  });

  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: (task.status as any) ?? "TODO",
      priority: (task.priority as any) ?? "MEDIUM",
      start_date: task.start_date ?? null,
      due_date: task.due_date ?? null,
      assigned_to: task.assigned_to ?? null,
    });
  }, [task]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-end z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full md:w-[600px] h-full p-6 overflow-y-auto shadow-2xl">
        <div className="flex justify-between mb-6">
          <h2 className="text-xl font-bold">Edit Task</h2>
          <button onClick={onClose}>Close</button>
        </div>

        {/* TITLE */}
        <input
          className="w-full border rounded-lg px-3 py-2 mb-4"
          value={form.title ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />

        {/* DESCRIPTION */}
        <textarea
          className="w-full border rounded-lg px-3 py-2 mb-4 min-h-[120px]"
          value={form.description ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />

        {/* START DATE */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">
            Start date
          </label>
          <input
            type="date"
            className="w-full border rounded-lg px-3 py-2"
            value={(form.start_date ?? "") as string}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                start_date: e.target.value || null,
              }))
            }
          />
        </div>

        {/* FILES */}
        <div className="mb-6">
          <div className="font-medium mb-2">Files</div>

          {task.files?.length ? (
            <div className="space-y-2 mb-4">
              {task.files.map((file, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-gray-50 p-2 rounded-lg"
                >
                  <span className="text-sm">{file.name}</span>

                  <button
                    onClick={async () => {
                      const { data } = await supabase.storage
                        .from("task-files")
                        .createSignedUrl(file.path, 60);

                      if (data?.signedUrl) {
                        window.open(data.signedUrl, "_blank");
                      }
                    }}
                    className="text-indigo-600 text-sm"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 mb-4">No files</div>
          )}

          <input
            type="file"
            multiple
            className="w-full border rounded-lg px-3 py-2"
            onChange={(e) =>
              setNewFiles(Array.from(e.target.files || []))
            }
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={async () => {
              let uploadedFiles = task.files ?? [];

              if (newFiles.length > 0) {
                for (const file of newFiles) {
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
              }

              await onSave({
                ...form,
                files: uploadedFiles,
              });
            }}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg"
          >
            Save
          </button>

          <button onClick={onClose} className="border px-5 py-2 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* CREATE MODAL */
function CreateTaskModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: Partial<Task>) => Promise<void> | void;
}) {
  const [form, setForm] = useState<Partial<Task>>({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    start_date: null,   // ✅ BURANI ƏLAVƏ ET
    due_date: null,
    assigned_to: null,
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-[560px] rounded-2xl shadow-2xl border overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="font-bold text-lg">New Task</div>
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800">
            Close
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Title</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.title ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Task title..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 min-h-[110px]"
              value={form.description ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={(form.status ?? "TODO") as string}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Priority</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={(form.priority ?? "MEDIUM") as string}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as any }))}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Start date
            </label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2"
              value={(form.start_date ?? "") as string}
              onChange={(e) =>
                setForm((p) => ({ ...p, start_date: e.target.value || null }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Due date</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2"
                value={(form.due_date ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value || null }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Assigned to</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={(form.assigned_to ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value || null }))}
                placeholder="optional user_id"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={async () => {
                if (!form.title?.trim()) {
                  alert("Title is required");
                  return;
                }
                await onCreate({
                  ...form,
                  title: form.title.trim(),
                });
              }}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700"
            >
              Create
            </button>

            <button onClick={onClose} className="border px-5 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

<style jsx global>{`
  @media print {
    body * {
      visibility: hidden;
    }

    .drawer-print,
    .drawer-print * {
      visibility: visible;
    }

    .drawer-print {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      box-shadow: none !important;
    }

    .no-print {
      display: none !important;
    }

    @page {
      size: A4;
      margin: 20mm;
    }
  }
`}</style>