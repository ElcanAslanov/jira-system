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
import { useAuth } from "@/context/AuthProvider";
// import { useRouter } from "next/navigation";

import DatePicker from "antd/es/date-picker";
import { Select } from "antd";
import dayjs from "dayjs";
import { message } from "antd";
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import { useSearchParams } from "next/navigation";
import Calendar from "antd/es/calendar";
import { createPortal } from "react-dom"
import Placeholder from "@tiptap/extension-placeholder"
import { useLang } from "@/context/LanguageContext"
import { translations } from "@/lib/translations"
import { useEmployees } from "@/hooks/useEmployees";



const { RangePicker } = DatePicker;

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

const STATUS_FLOW: Record<Status, Status[]> = {
  TODO: ["IN_PROGRESS", "DONE", "CANCELLED"],
  IN_PROGRESS: ["TODO", "DONE", "CANCELLED"],
  DONE: ["TODO"],
  CANCELLED: ["TODO", "IN_PROGRESS"]

};



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
  allow_comments?: boolean;
  sort_index: number;
  assigned_to?: string[] | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
  files?: TaskFile[]; // 🔥 əlavə olundu
  comment_count?: number; // 🔥 BUNU ƏLAVƏ ET
  creator_name?: string | null; // 🔥 BUNU ƏLAVƏ ET
};

type TasksByStatus = Record<Status, Task[]>;

function isStatus(x: any): x is Status {
  return STATUSES.includes(x);
}

function canTransition(from: Status, to: Status) {
  return STATUS_FLOW[from]?.includes(to);
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

  const { lang } = useLang()
  const t = translations[lang]

  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-xs border";

  const map: Record<string, string> = {
    LOW: "bg-gray-50 text-gray-700 border-gray-200",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
    HIGH: "bg-amber-50 text-amber-800 border-amber-200",
    URGENT: "bg-red-50 text-red-700 border-red-200",
  };

  const labels: Record<string, string> = {
    LOW: t.low,
    MEDIUM: t.medium,
    HIGH: t.high,
    URGENT: t.urgent
  }

  return (
    <span className={`${base} ${map[p] ?? ""}`}>
      {labels[p] ?? p}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {

  const { lang } = useLang()
  const t = translations[lang]

  const base =
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border";

  const map: Record<string, string> = {
    TODO: "bg-gray-100 text-gray-700 border-gray-200",
    IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
    DONE: "bg-green-100 text-green-700 border-green-200",
    CANCELLED: "bg-red-100 text-red-700 border-red-200",
  };

  const labels: Record<string, string> = {
    TODO: t.todo,
    IN_PROGRESS: t.inProgress,
    DONE: t.taskDone,
    CANCELLED: t.cancelled
  }

  return (
    <span className={`${base} ${map[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function UserBadge({
  userId,
  users,
}: {
  userId: string;
  users: UserInfo[];
}) {
  const user =
    users.find((u) => u.id === userId) ||
    users.find((u) => u.name === userId);

  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    message.config({
      top: 80,
      duration: 3,
      maxCount: 3,
    });
  }, []);

  useEffect(() => {
    if (!hovered || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    setPos({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
  }, [hovered]);

  if (!user) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 border">
        👤 {userId}
      </span>
    );
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer"
      >
        👤 {user.name}
      </span>

      {hovered &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 999999,
            }}
            className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl min-w-[200px]"
          >
            <div className="space-y-1">
              <div className="font-semibold">{user.name}</div>
              <div className="text-gray-300">{user.email}</div>
              <div className="border-t border-gray-700 my-1" />
              <div className="text-gray-300">{user.company}</div>
              <div className="text-gray-300">{user.department}</div>
              <div className="text-indigo-300 font-semibold">
                {user.role}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
type UserInfo = {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  company?: string | null;
  department?: string | null;
};

const BoardView = React.memo(function BoardView(props: any) {
  return props.children;
});

const ListView = React.memo(function ListView(props: any) {
  return props.children;
});

const CalendarLazy = React.memo(function CalendarLazy(props: any) {
  return props.children;
});

export default function TasksPage() {

  const { lang } = useLang()
  const t = translations[lang]

  const downloadFile = async (bucket: string, path: string, fileName?: string) => {
    if (!path) return;

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60);

      if (error || !data?.signedUrl) {
        console.error("Signed URL error:", error);
        return;
      }

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.setAttribute("download", fileName || "file");
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("Download error:", err);
    }
  };
  const [roleName, setRoleName] = useState<string | null>(null)
  const searchParams = useSearchParams();
  const openTaskId = searchParams.get("open");
  const [viewMode, setViewMode] = useState<"board" | "list" | "calendar">("board");
  // const [users, setUsers] = useState<UserInfo[]>([]);
  const { data: employees, isLoading } = useEmployees();

  const users: UserInfo[] = useMemo(() => {
    return (employees || []).map((u: any) => ({
      id: u.id,
      name: `${u.ad ?? ""} ${u.soyad ?? ""}`.trim(),
      email: u.email ?? null,
      role: u.positions?.name ?? null,
      company: u.companies?.name ?? null,
      department: u.departments?.name ?? null,
    }));
  }, [employees]);

  const STATUS_LABELS: Record<Status, string> = {
    TODO: t.todo,
    IN_PROGRESS: t.inProgress,
    DONE: t.taskDone,
    CANCELLED: t.cancelled,
  };

  const PRIORITY_LABELS: Record<string, string> = {
    LOW: t.low,
    MEDIUM: t.medium,
    HIGH: t.high,
    URGENT: t.urgent,
  };


  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  // COMMENTS STATE
  const [comments, setComments] = useState<any[]>([]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: t.writeComment
        })
      ],
      immediatelyRender: false
    },
    [lang]
  )

  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    console.log("TASKS PAGE AUTH:", {
      loading,
      userId: user?.id ?? null,
      role: (user as any)?.role ?? null,
    });
  }, [loading, user]);
  const [permissions, setPermissions] = useState<string[]>([]);

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
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);

  const [startRange, setStartRange] = useState<[string | null, string | null]>([null, null]);
  const [dueRange, setDueRange] = useState<[string | null, string | null]>([null, null]);

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

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
        if (
          assignedFilter.length &&
          !assignedFilter.some(name =>
            (t.assigned_to ?? []).includes(name)
          )
        ) {
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

  const [sortBy, setSortBy] = useState<
    "title" | "status" | "priority" | "start_date" | "due_date" | "assigned_to"
  >("title");

  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }
  // table pagination (for ALL tasks, but filtered by search)
  const PAGE_SIZE = 6;
  const [page, setPage] = useState(1);

  const filteredFlat = useMemo(() => {
    const arr: Task[] = [];
    for (const st of STATUSES) arr.push(...filteredTasksBy[st]);

    const getVal = (t: Task) => {
      if (sortBy === "title") return t.title ?? "";
      if (sortBy === "status") return t.status ?? "";
      if (sortBy === "priority") return t.priority ?? "";
      if (sortBy === "start_date") return t.start_date ?? "";
      if (sortBy === "due_date") return t.due_date ?? "";
      if (sortBy === "assigned_to")
        return (t.assigned_to ?? []).join(", ");
    };

    arr.sort((a, b) => {
      const A = getVal(a);
      const B = getVal(b);

      // DATE SORT
      if (sortBy === "start_date" || sortBy === "due_date") {
        const tA = A ? new Date(A).getTime() : 0;
        const tB = B ? new Date(B).getTime() : 0;
        return sortDir === "asc" ? tA - tB : tB - tA;
      }

      // STRING SORT
      const sA = String(A).toLowerCase();
      const sB = String(B).toLowerCase();

      return sortDir === "asc"
        ? sA.localeCompare(sB)
        : sB.localeCompare(sA);
    });

    return arr;
  }, [filteredTasksBy, sortBy, sortDir]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredFlat.length / PAGE_SIZE));
  }, [filteredFlat.length]);

  useEffect(() => {
    // keep page valid
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput);
    }, 300);

    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!user?.id) return;

    async function loadPermissions() {

      // 🔹 ROLE NAME FETCH
      const { data: roleData } = await supabase
        .from("roles")
        .select("name")
        .eq("id", (user as any)?.role_id)
        .single();

      if (roleData?.name) {
        setRoleName(roleData.name);
      }

      // 🔹 ROLE PERMISSIONS
      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", (user as any)?.role_id);

      // 🔹 USER OVERRIDE PERMISSIONS
      const { data: userPerms } = await supabase
        .from("user_permissions")
        .select("permission_key, allowed")
        .eq("user_id", user.id);

      let finalPerms =
        rolePerms?.map((p: any) => p.permission_key) || [];

      // 🔹 OVERRIDE LOGIC
      if (userPerms) {
        userPerms.forEach((p: any) => {
          if (p.allowed === true && !finalPerms.includes(p.permission_key)) {
            finalPerms.push(p.permission_key);
          }

          if (p.allowed === false) {
            finalPerms = finalPerms.filter(
              (k) => k !== p.permission_key
            );
          }
        });
      }

      setPermissions(finalPerms);
    }

    loadPermissions();
  }, [user?.id]);

  const can = (key: string) => permissions.includes(key);


  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredFlat.slice(start, start + PAGE_SIZE);
  }, [filteredFlat, page]);
  const memoizedColumns = useMemo(() => {
    return STATUSES.map((st) => ({
      id: st,
      tasks: filteredTasksBy[st],
    }));
  }, [filteredTasksBy]);
  // activity log (lightweight)
  const [activity, setActivity] = useState<string[]>([]);
  const pushActivity = useCallback((msg: string) => {
    setActivity((p) => [msg, ...p].slice(0, 20));
  }, []);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadTasks = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const res = await fetch("/api/tasks", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("API ERROR:", text);
      return;
    }

    const data = await res.json();



    const tasks: Task[] = (data.tasks || []).map((t: any) => ({
      ...t,
      status: isStatus(t.status) ? t.status : "TODO",
      sort_index:
        typeof t.sort_index === "number"
          ? t.sort_index
          : Number(t.sort_index ?? 0),
      files: Array.isArray(t.files) ? t.files : [],
      comment_count: t.comment_count ?? 0,
      creator_name: t.creator_name ?? null, // 🔥 BUNU ƏLAVƏ ET
      allow_comments: t.allow_comments ?? true,
    }));


    setRawTasks(tasks);
    setTasksBy(groupByStatus(tasks));
  }, [getToken]);





  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {

      const token = await getToken();
      if (!token) throw new Error("No auth token");

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

        message.error(data.error || "Tapşırıq yenilənmədi");

        return;
      }
    },
    [getToken]
  );

  const moveTask = useCallback((taskId: string, nextStatus: Status) => {
    setTasksBy((prev) => {
      const next: TasksByStatus = {
        TODO: [...prev.TODO],
        IN_PROGRESS: [...prev.IN_PROGRESS],
        DONE: [...prev.DONE],
        CANCELLED: [...prev.CANCELLED],
      };

      const found = findTask(prev, taskId);
      if (!found) return prev;

      const [task] = next[found.status].splice(found.index, 1);

      const moved = { ...task, status: nextStatus };

      next[nextStatus].push(moved);

      return next;
    });
  }, []);

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
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Delete failed");
      }
    },
    [getToken, user?.id, user]
  );

  useEffect(() => {
    if (loading) return;
    if (!user?.id) return;

    loadTasks();
  }, [loading, user?.id, loadTasks]);

  useEffect(() => {
    if (openTaskId && rawTasks.length > 0) {
      const found = rawTasks.find(t => t.id === openTaskId);
      if (found) {
        setViewTask(found);      // bax drawer üçün
        setDrawerOpen(true);
      }
    }
  }, [openTaskId, rawTasks]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
        },
        async (payload) => {

          // 🔥 yeni task gəldi
          await loadTasks();

          message.success("Yeni tapşırıq əlavə edildi");

        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadTasks]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("comments-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_comments" },
        (payload) => {

          const taskId = payload.new.task_id;

          setTasksBy(prev => {

            const next = { ...prev };

            for (const st of STATUSES) {
              next[st] = next[st].map(t =>
                t.id === taskId
                  ? { ...t, comment_count: (t.comment_count ?? 0) + 1 }
                  : t
              );
            }

            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // ✅ düzəldi
    };

  }, [user?.id]);

  // LOAD COMMENTS WHEN VIEW DRAWER OPENS
  useEffect(() => {
    if (!viewTask) return;

    const loadComments = async () => {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/tasks/${viewTask.id}/comments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },


      });

      // 🔥 MARK COMMENTS AS READ
      await fetch(`/api/tasks/${viewTask.id}/comments/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // 🔥 BADGE RESET
      setTasksBy((prev) => {
        const next = { ...prev };

        for (const st of STATUSES) {
          next[st] = next[st].map((t) =>
            t.id === viewTask.id
              ? { ...t, comment_count: 0 }
              : t
          );
        }

        return next;
      });


      if (!res.ok) {
        console.error("COMMENT LOAD ERROR:", await res.text());
        return;
      }

      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    };

    loadComments();
  }, [viewTask, getToken]);


  const handleAddComment = async () => {
    if (!viewTask) return;

    const token = await getToken();
    if (!token) {
      console.error("No auth token");
      return;
    }

    const html = editor?.getHTML() || ""

    if (!html.replace(/<[^>]+>/g, "").trim() && commentFiles.length === 0) {
      return;
    }

    let uploaded: {
      name: string;
      path: string;
      size?: number;
      type?: string;
    }[] = [];

    try {

      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

      // 🔥 FILE UPLOAD
      for (const file of commentFiles) {

        // 🔴 SIZE CHECK (UPLOADDAN ƏVVƏL)
        if (file.size > MAX_FILE_SIZE) {
          message.error(`"${file.name}" faylı 20MB-dan böyükdür`);
          return;
        }

        const fileName = `${viewTask.id}/${Date.now()}-${file.name}`;

        const { error } = await supabase.storage
          .from("task-comment-files")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) {
          console.error("Upload error:", error);
          message.error(`${file.name} yüklənmədi`);
          continue;
        }

        uploaded.push({
          name: file.name,
          path: fileName,
          size: file.size,
          type: file.type,
        });
      }

      // 🔥 COMMENT INSERT
      const res = await fetch(`/api/tasks/${viewTask.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          comment: html,
          files: uploaded,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);

        const errorMessage =
          data?.error || t.commentError;

        message.error(errorMessage);

        return;
      }

      const text = await res.text()

      let data = null
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error("JSON parse error:", e)
      }

      // 🔥 UI UPDATE
      setComments((prev) => [
        {
          ...data.comment,
          files: Array.isArray(data.comment.files)
            ? data.comment.files
            : [],
        },
        ...prev,
      ]);

      // 🔥 COMMENT COUNT INCREMENT
      setTasksBy((prev) => {
        const next = { ...prev };

        for (const st of STATUSES) {
          next[st] = next[st].map((t) =>
            t.id === viewTask.id
              ? { ...t, comment_count: (t.comment_count ?? 0) + 1 }
              : t
          );
        }

        return next;
      });

      // 🔥 RESET
      editor?.commands.clearContent();
      setCommentFiles([]);

      message.success(t.commentAdded);

    } catch (err) {
      console.error("Add comment failed:", err);
      message.error(t.error);
    }
  };

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);

  const handleDragStart = useCallback((e: DragStartEvent) => {

    if (isMobile) return // 📱 mobil drag disable

    const id = String(e.active.id);

    const found = findTask(tasksBy, id);

    // 🔒 DONE task drag olunmasın
    if (
      (user as any)?.role === "EMPLOYEE" &&
      (found?.task.status === "DONE" || found?.task.status === "CANCELLED")
    ) {
      return;
    }

    setActiveTaskId(id);
    setIsDraggingNow(true);
  }, [tasksBy, user, isMobile])

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

      // 🔒 EMPLOYEE CANCELLED column-a ata bilməz
      const role = (roleName || "").toUpperCase()

      if (targetStatus === "CANCELLED" && role === "EMPLOYEE") {
        return
      }

      // 🔒 Status transition rule
      if (!canTransition(activeFound.status, targetStatus) && activeFound.status !== targetStatus) {
        return;
      }

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
  if (loading) {
    return (
      <div className="p-10">
        {t.loading}
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="p-10">
        {t.noSession}
      </div>
    );
  }

  const isCreator = viewTask?.created_by === user.id
  const isAssigned = viewTask?.assigned_to?.includes(user.id)
  const role = ((user as any)?.role || "").toUpperCase()

  const isRehber = role === "REHBER"
  const isAdmin = role === "ADMIN"
  const isEmployee = role === "EMPLOYEE"

  const canReopen =
    isRehber ||
    (isCreator && !isAssigned)

  return (
    <div className="min-h-screen bg-slate-50 px-4 sm:px-6 lg:px-10 pt-0 pb-6 lg:pb-10 space-y-8 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold">🔥 {t.tasks}</h1>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("board")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === "board"
              ? "bg-white shadow text-indigo-600"
              : "text-gray-600"
              }`}
          >
            {t.board}
          </button>

          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === "list"
              ? "bg-white shadow text-indigo-600"
              : "text-gray-600"
              }`}
          >
            {t.list}
          </button>

          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${viewMode === "calendar"
              ? "bg-white shadow text-indigo-600"
              : "text-gray-600"
              }`}
          >
            {t.calendar}
          </button>
        </div>



        <div className="flex items-center gap-3">
          {can("tasks.export.list") && (
            <button
              onClick={async () => {
                if (!filteredFlat.length) return;

                try {
                  // 🚀 XLSX yalnız klik zamanı yüklənəcək
                  const XLSX = await import("xlsx");

                  const data = filteredFlat.map((task) => ({
                    Title: task.title,
                    Description: task.description ?? "",
                    Status: task.status.replace("_", " "),
                    Priority: task.priority,
                    StartDate: formatDMY(task.start_date),
                    EndDate: formatDMY(task.due_date),
                    Assignees: (task.assigned_to ?? []).join(", "),
                    Files: (task.files ?? []).map(f => f.name).join(", "),
                    CreatedAt: formatDMY(task.created_at, true),
                    UpdatedAt: formatDMY(task.updated_at, true),
                  }));
                  const worksheet = XLSX.utils.json_to_sheet(data);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "Tapşırıqlar");

                  XLSX.writeFile(workbook, "tapshiriqlar.xlsx");

                } catch (err) {
                  console.error("Export error:", err);
                }
              }}
              className="border px-4 py-2 rounded-xl text-gray-700 hover:bg-white shadow-sm"
            >
              {t.export}
            </button>
          )}
          {can("tasks.print.list") && (
            <button
              onClick={() => window.print()}
              className="border px-4 py-2 rounded-xl text-gray-700 hover:bg-white shadow-sm"
            >
              {t.print}
            </button>
          )}
        </div>
      </div>



      {/* ===================== MODERN BOARD ===================== */}
      {viewMode === "board" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className="
    flex
    flex-col
    md:flex-col
    lg:flex-row
    gap-6
    lg:overflow-x-auto
    pb-6
    pt-2
  "
          >
            {memoizedColumns.map((col) => (
              <div
                key={col.id}
                className="
    w-full
    md:w-full
    lg:min-w-[340px]
    lg:max-w-[340px]
    flex-shrink-0
  "
              >
                <Column
                  id={col.id}
                  title={col.id}
                  tasks={col.tasks}
                  statusLabels={STATUS_LABELS}
                  can={can}
                  currentUserId={user.id}
                  userRole={roleName ?? ""}
                  users={users}   // BUNU ƏLAVƏ ET
                  updateTask={updateTask}
                  loadTasks={loadTasks}
                  isMobile={isMobile}
                  moveTask={moveTask}
                  onSelect={(task) => {
                    setViewTask(task);
                    setDrawerOpen(true);
                  }}
                />
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-white p-5 rounded-3xl shadow-2xl border w-[300px]">
                <div className="font-semibold text-gray-900">
                  {activeTask.title}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{activeTask.status.replace("_", " ")}</span>
                  <PriorityPill p={String(activeTask.priority)} />
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {viewMode === "list" && (
        <>
          <div className="
  bg-white p-6 rounded-2xl shadow border
  grid grid-cols-1
  sm:grid-cols-2
  md:grid-cols-3
  lg:grid-cols-6
  gap-6
">
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
                label: STATUS_LABELS[s],
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

            {/* START RANGE */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-600">{t.startDateRange}</div>
              <RangePicker
                format="DD/MM/YYYY"
                placeholder={[t.start, t.end]}
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
              <div className="text-xs font-medium text-gray-600">{t.endDateRange}</div>
              <RangePicker
                format="DD/MM/YYYY"
                placeholder={[t.start, t.end]}
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
                setSearchInput("");
                setQ("");
              }}
              className="bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 font-medium"
            >
              {t.clear}
            </button>

          </div>

          {/* TABLE + PAGINATION */}
          {/* TABLE + PAGINATION */}
          <div className="bg-white rounded-2xl shadow border">

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b bg-gray-50 gap-2">
              <div className="font-semibold">{t.tasksTable}</div>
              <div className="text-sm text-gray-600">
                {t.page} <span className="font-medium">{page}</span> /{" "}
                <span className="font-medium">{totalPages}</span> —{" "}
                <span className="font-medium">{filteredFlat.length}</span> {t.items}
              </div>
            </div>

            {/* ========================= */}
            {/* DESKTOP TABLE (lg+) */}
            {/* ========================= */}
            <div className="hidden lg:block w-full overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th onClick={() => toggleSort("title")} className="p-3 text-left cursor-pointer hover:bg-gray-200">
                      {t.taskName} {sortBy === "title" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th onClick={() => toggleSort("status")} className="p-3 text-left cursor-pointer hover:bg-gray-200">
                      {t.status} {sortBy === "status" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th onClick={() => toggleSort("priority")} className="p-3 text-left cursor-pointer hover:bg-gray-200">
                      {t.priority} {sortBy === "priority" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th onClick={() => toggleSort("start_date")} className="p-3 text-left cursor-pointer hover:bg-gray-200">
                      {t.startDate}
                    </th>
                    <th onClick={() => toggleSort("due_date")} className="p-3 text-left cursor-pointer hover:bg-gray-200">
                      {t.endDate}
                    </th>
                    <th onClick={() => toggleSort("assigned_to")} className="p-3 text-left cursor-pointer hover:bg-gray-200">
                      {t.assignees}
                    </th>
                    <th className="p-3 text-left">
                      {t.files}
                    </th>
                    <th className="p-3 text-right">{t.actions}</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedTasks.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{t.title}</div>
                        {t.creator_name && (
                          <div className="text-[11px] text-gray-400">
                            {t.creator_name} {translations[lang].createdByUser}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={String(t.status)} />
                      </td>
                      <td className="p-3"><PriorityPill p={String(t.priority)} /></td>
                      <td className="p-3">{formatDMY(t.start_date)}</td>
                      <td className="p-3">{formatDMY(t.due_date)}</td>
                      <td className="p-3">
                        {t.assigned_to?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {t.assigned_to.map((u, i) => (
                              <UserBadge key={i} userId={u} users={users} />
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3">
                        {t.files?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {t.files.map((file, i) => (
                              <span
                                key={i}
                                onClick={async (e) => {
                                  e.stopPropagation(); // row click bloklamasın

                                  if (!file?.path) return;

                                  try {
                                    const { data, error } = await supabase.storage
                                      .from("task-files")
                                      .createSignedUrl(file.path, 60);

                                    if (error || !data?.signedUrl) {
                                      console.error("Signed URL error:", error);
                                      return;
                                    }

                                    // ✅ Pure download (no preview, no new tab)
                                    const link = document.createElement("a");
                                    link.href = data.signedUrl;
                                    link.setAttribute("download", file.name || "file");
                                    link.style.display = "none";

                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);

                                  } catch (err) {
                                    console.error("Download error:", err);
                                  }
                                }}
                                className="
  inline-flex
  items-center
  px-2.5
  py-1
  rounded-full
  text-xs
  font-medium
  bg-indigo-50
  text-indigo-700
  border
  border-indigo-200
  hover:bg-indigo-100
  cursor-pointer
  transition
"
                              >
                                📎 {file.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <div className="relative inline-block">
                          <button
                            onClick={() => {
                              setViewTask(t);
                              setDrawerOpen(true);
                            }}
                            className="border px-3 py-1.5 rounded-lg relative"
                          >
                            {translations[lang].view}
                          </button>

                          {t.comment_count ? (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                              {t.comment_count}
                            </span>
                          ) : null}
                        </div>
                        {can("tasks.edit.list") && (
                          <button
                            onClick={() => setSelectedTask(t)}
                            className="border px-3 py-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
                          >
                            {translations[lang].edit}
                          </button>
                        )}
                        {can("tasks.delete.list") && (
                          <button
                            onClick={async () => {
                              if (!confirm(translations[lang].confirmDeleteTask)) return;

                              const snapshot = tasksBy;

                              // optimistic remove
                              const f = findTask(tasksBy, t.id);
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
                                await deleteTask(t.id);
                                pushActivity(`• Deleted "${t.title}"`);
                              } catch {
                                setTasksBy(snapshot);
                                pushActivity(`• Delete failed "${t.title}"`);
                              }
                            }}
                            className="border px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          >
                            {translations[lang].delete}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {paginatedTasks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-500">
                        {t.tasksNotFound}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ========================= */}
            {/* MOBILE + TABLET CARDS (< lg) */}
            {/* ========================= */}
            <div className="lg:hidden p-4 space-y-4">
              {paginatedTasks.map((t) => (
                <div key={t.id} className="border rounded-xl p-4 shadow-sm bg-white">

                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{t.title}</div>
                      {t.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {t.description}
                        </div>
                      )}
                    </div>

                    <PriorityPill p={String(t.priority)} />
                  </div>

                  <div className="mt-3 text-sm text-gray-600 space-y-1">
                    <div>{translations[lang].status}: {t.status}</div>
                    <div>{translations[lang].startDate}: {formatDMY(t.start_date)}</div>
                    <div>{translations[lang].endDate}: {formatDMY(t.due_date)}</div>
                    <div>
                      {translations[lang].assignedTo}
                      {t.assigned_to?.length ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.assigned_to.map((u, i) => (
                            <UserBadge key={i} userId={u} users={users} />
                          ))}
                        </div>
                      ) : (
                        " -"
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <div className="relative flex-1">
                      <button
                        onClick={() => {
                          setViewTask(t);
                          setDrawerOpen(true);
                        }}
                        className="w-full border px-3 py-2 rounded-lg text-sm"
                      >
                        {translations[lang].view}
                      </button>

                      {t.comment_count ? (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                          {t.comment_count}
                        </span>
                      ) : null}
                    </div>
                    {can("tasks.edit.list") && (
                      <button
                        onClick={() => setSelectedTask(t)}
                        className="flex-1 border px-3 py-2 rounded-lg text-sm"
                      >
                        {translations[lang].edit}
                      </button>
                    )}
                    {can("tasks.delete.list") && (
                      <button
                        onClick={async () => {
                          if (!confirm(translations[lang].confirmDeleteTask)) return;

                          const snapshot = tasksBy;
                          const f = findTask(tasksBy, t.id);
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
                            await deleteTask(t.id);
                            pushActivity(`• Deleted "${t.title}"`);
                          } catch {
                            setTasksBy(snapshot);
                            pushActivity(`• Delete failed "${t.title}"`);
                          }
                        }}
                        className="flex-1 border px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                      >
                        {translations[lang].delete}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {paginatedTasks.length === 0 && (
                <div className="text-center text-gray-500 py-6">
                  {t.noTasks}
                </div>
              )}
            </div>

            {/* ========================= */}
            {/* PAGINATION */}
            {/* ========================= */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t bg-white">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border px-4 py-2 rounded-xl w-full sm:w-auto"
                disabled={page <= 1}
              >
                {t.previous}
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border px-4 py-2 rounded-xl w-full sm:w-auto"
                disabled={page >= totalPages}
              >
                {t.next}
              </button>
            </div>

          </div>
        </>
      )}

      {viewMode === "calendar" && (
        <CalendarView tasks={filteredFlat} onSelectTask={(t) => {
          setViewTask(t);
          setDrawerOpen(true);
        }} />
      )}


      {/* EDIT DRAWER */}
      {selectedTask ? (
        <EditDrawer
          task={selectedTask}
          users={users}
          currentUserId={user.id}   // 🔥 bunu əlavə et
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
            className="
  drawer-print
  bg-white
  w-full
  sm:w-[90%]
  md:w-[650px]
  lg:w-[700px]
  h-full
  ml-auto
  p-4 sm:p-6
  overflow-y-auto
  shadow-2xl
  transition-transform duration-200
"
            style={{
              transform: drawerOpen ? "translateX(0)" : "translateX(110%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 900 }}>
                👤 {t.taskDetails}
              </h2>

              <div style={{ display: "flex", gap: 8 }}>
                {/* EXPORT */}
                {can("tasks.export.drawer") && (
                  <button
                    onClick={async () => {
                      try {
                        // 🚀 XLSX only when clicked
                        const XLSX = await import("xlsx");

                        const data = [{
                          "Başlıq": viewTask.title,
                          "Təsvir": viewTask.description ?? "",
                          "Status": viewTask.status.replace("_", " "),
                          "Prioritet": viewTask.priority,
                          "Başlama tarixi": formatDMY(viewTask.start_date),
                          "Son tarix": formatDMY(viewTask.due_date),
                          "Təyin olunan": (viewTask.assigned_to ?? []).join(", "),
                          "Fayllar": (viewTask.files ?? []).map(f => f.name).join(", "),
                          "Yaradılma tarixi": formatDMY(viewTask.created_at, true),
                          "Yenilənmə tarixi": formatDMY(viewTask.updated_at, true),
                        }];

                        const worksheet = XLSX.utils.json_to_sheet(data);
                        const workbook = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(workbook, worksheet, "Tapşırıq");

                        // təhlükəsiz file adı
                        const safeName = (viewTask.title || "task")
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9\-]/g, "")
                          .slice(0, 50);

                        XLSX.writeFile(workbook, `${safeName}.xlsx`);

                      } catch (err) {
                        console.error("Drawer export error:", err);
                      }
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {t.export}
                  </button>
                )}

                {/* PRINT */}
                {can("tasks.print.drawer") && (
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
                    {t.print}
                  </button>
                )}
                {can("tasks.edit.drawer") && (
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      setTimeout(() => {
                        setSelectedTask(viewTask);
                      }, 200);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #c7d2fe",
                      background: "#eef2ff",
                      fontWeight: 700,
                      fontSize: 12,
                      color: "#4338ca",
                    }}
                  >
                    {translations[lang].edit}
                  </button>
                )}
                {can("tasks.delete.drawer") && (
                  <button
                    onClick={async () => {
                      if (!confirm(t.confirmDeleteTask)) return;

                      const snapshot = tasksBy;
                      const f = findTask(tasksBy, viewTask.id);
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
                        await deleteTask(viewTask.id);
                        pushActivity(`• Deleted "${viewTask.title}"`);
                        setDrawerOpen(false);
                        setTimeout(() => setViewTask(null), 200);
                      } catch {
                        setTasksBy(snapshot);
                        pushActivity(`• Delete failed "${viewTask.title}"`);
                      }
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #fecaca",
                      background: "#fee2e2",
                      fontWeight: 700,
                      fontSize: 12,
                      color: "#b91c1c",
                    }}
                  >
                    {t.delete}
                  </button>
                )}

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

              <DrawerRow label={t.taskName} value={viewTask.title} />

              <DrawerRow
                label={t.description}
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
                label={t.status}
                value={
                  <div className="cursor-pointer inline-block hover:opacity-80 transition">
                    <StatusBadge status={viewTask.status} />
                  </div>
                }
              />

              {/* STATUS ACTIONS */}
              <div className="mt-3 flex gap-2">

                {viewTask.status !== "DONE" && (
                  <button
                    onClick={async () => {
                      let nextStatus: Status | null = null;

                      if (viewTask.status === "TODO") {
                        nextStatus = "IN_PROGRESS";
                      }

                      if (viewTask.status === "IN_PROGRESS") {
                        nextStatus = "DONE";
                      }

                      if (!nextStatus) return;


                      moveTask(viewTask.id, nextStatus); // 🔥 instant UI

                      await updateTask(viewTask.id, { status: nextStatus });

                      // optional:
                      setViewTask(prev => prev ? { ...prev, status: nextStatus } : prev)

                      setViewTask((prev: any) => prev ? { ...prev, status: nextStatus } : prev)
                    }}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700"
                  >
                    {viewTask.status === "TODO" && t.startTask}
                    {viewTask.status === "IN_PROGRESS" && t.completeTask}
                  </button>
                )}

                {viewTask.status === "CANCELLED" && isCreator && (
                  <button
                    onClick={async () => {
                      moveTask(viewTask.id, "TODO");

                      await updateTask(viewTask.id, { status: "TODO" });

                      setViewTask(prev => prev ? { ...prev, status: "TODO" } : prev)

                      setViewTask((prev: any) =>
                        prev ? { ...prev, status: "TODO" } : prev
                      )
                    }}
                    className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-300"
                  >
                    {t.reopenTask}
                  </button>
                )}

              </div>

              <DrawerRow
                label={t.priority}
                value={
                  <div className="cursor-pointer inline-block hover:opacity-80 transition">
                    <PriorityPill p={String(viewTask.priority)} />
                  </div>
                }
              />

              <DrawerRow
                label={t.startDate}
                value={formatDMY(viewTask.start_date)}
              />

              <DrawerRow
                label={t.endDate}
                value={formatDMY(viewTask.due_date)}
              />

              <DrawerRow
                label={t.assignees}
                value={
                  viewTask.assigned_to?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {viewTask.assigned_to.map((u, i) => (
                        <UserBadge key={i} userId={u} users={users} />
                      ))}
                    </div>
                  ) : "-"
                }
              />

              <DrawerRow
                label={t.createdBy}
                value={
                  viewTask.created_by ? (
                    <UserBadge userId={viewTask.created_by} users={users} />
                  ) : viewTask.creator_name ? (
                    <span>{viewTask.creator_name}</span>
                  ) : "-"
                }
              />

              <DrawerRow
                label={t.createdAt}
                value={formatDMY(viewTask.created_at, true)}
              />

              <DrawerRow
                label={t.updatedAt}
                value={formatDMY(viewTask.updated_at, true)}
              />

              <DrawerRow
                label={t.updatedBy}
                value={viewTask.updated_by_name ?? "-"}
              />



              {viewTask.files?.length ? (
                <DrawerRow
                  label={t.files}
                  value={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {viewTask.files.map((f, i) => (
                        <button
                          key={i}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!f?.path) return;

                            try {
                              const { data, error } = await supabase.storage
                                .from("task-files")
                                .createSignedUrl(f.path, 60);

                              if (error || !data?.signedUrl) {
                                console.error("Signed URL error:", error);
                                return;
                              }

                              // 🔥 SAFEST & UNLIMITED DOWNLOAD
                              window.location.href = data.signedUrl;

                            } catch (err) {
                              console.error("Download error:", err);
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

              {/* COMMENTS SECTION */}
              {viewTask.allow_comments !== false && (
                <div style={{ marginTop: 30 }}>
                  <h3 style={{ fontWeight: 900, marginBottom: 10 }}>
                    💬 {t.comments}
                  </h3>

                  {comments.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {comments.map((c) => {
                        // 🔥 müəllifdən başqa oxuyanlar
                        const seenBy =
                          Array.isArray(c.reads)
                            ? c.reads.filter(
                              (r: any) => r.employee_id !== c.author_id
                            )
                            : [];

                        return (
                          <div
                            key={c.id}
                            style={{
                              background: "#f3f4f6",
                              padding: 12,
                              borderRadius: 10,
                            }}
                          >
                            {/* HEADER */}
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              {c.author_name} • {formatDMY(c.created_at, true)}
                            </div>

                            {/* 🔥 SEEN INFO */}
                            {seenBy.length > 0 && (
                              <div className="text-xs text-green-600 mt-1">
                                {seenBy
                                  .map(
                                    (r: any) =>
                                      `${r.employees?.ad ?? ""} ${r.employees?.soyad ?? ""
                                        }`.trim()
                                  )
                                  .join(", ")} {t.seenBy}
                              </div>
                            )}

                            {/* MESSAGE */}
                            {c.message && (
                              <div style={{ marginTop: 6, fontWeight: 600 }}>
                                <div
                                  dangerouslySetInnerHTML={{ __html: c.message }}
                                  style={{ marginTop: 6 }}
                                />
                              </div>
                            )}

                            {/* FILES */}
                            {Array.isArray(c.files) && c.files.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {c.files.map((f: any, i: number) => {
                                  const ext = f.name?.split(".").pop()?.toLowerCase();

                                  const getIcon = () => {
                                    if (["png", "jpg", "jpeg", "webp"].includes(ext))
                                      return "🖼️";
                                    if (["pdf"].includes(ext)) return "📄";
                                    if (["doc", "docx"].includes(ext)) return "📝";
                                    if (["xls", "xlsx"].includes(ext)) return "📊";
                                    return "📎";
                                  };

                                  return (
                                    <div
                                      key={i}
                                      onClick={async () => {
                                        if (!f?.path) return;

                                        const { data, error } = await supabase.storage
                                          .from("task-comment-files")
                                          .createSignedUrl(f.path, 60);

                                        if (error || !data?.signedUrl) {
                                          console.error("Signed URL error:", error);
                                          return;
                                        }

                                        window.location.href = data.signedUrl;
                                      }}
                                      className="flex items-center gap-2 bg-white border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all px-3 py-2 rounded-xl cursor-pointer text-sm"
                                    >
                                      <span className="text-lg">{getIcon()}</span>

                                      <div className="flex flex-col">
                                        <span className="font-medium text-gray-800 truncate max-w-[160px]">
                                          {f.name}
                                        </span>
                                        {f.size && (
                                          <span className="text-xs text-gray-400">
                                            {(f.size / 1024).toFixed(1)} KB
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: "#9ca3af", marginBottom: 10 }}>
                      {t.noComments}
                    </div>
                  )}



                  {/* ADD COMMENT */}
                  {/* ADD COMMENT */}
                  <div className="mt-5 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                    {/* TOOLBAR */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">

                      <button
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className="
        px-2.5 py-1
        text-sm
        rounded-md
        hover:bg-gray-200
        transition
        font-bold
      "
                      >
                        B
                      </button>

                      <button
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        className="
        px-2.5 py-1
        text-sm
        rounded-md
        hover:bg-gray-200
        transition
        italic
      "
                      >
                        I
                      </button>

                      <div className="flex-1" />

                      <label className="
      flex items-center gap-1
      px-3 py-1
      text-sm
      rounded-md
      hover:bg-gray-200
      cursor-pointer
      transition
    ">
                        📎 {t.file}
                        <input
                          type="file"
                          hidden
                          multiple
                          onChange={(e) => {

                            const files = Array.from(e.target.files || []);
                            const MAX = 20 * 1024 * 1024;

                            const valid: File[] = [];

                            for (const file of files) {

                              if (file.size > MAX) {
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

                    {/* EDITOR */}
                    <div
                      className="
      px-4 py-3
      min-h-[120px]
      max-h-[260px]
      overflow-y-auto
      focus-within:ring-2
      focus-within:ring-indigo-500
      transition      
    "
                    >
                      {editor && <EditorContent editor={editor} />}
                    </div>

                    {/* FILE PREVIEW */}
                    {commentFiles.length > 0 && (
                      <div className="px-4 pb-3 space-y-2 border-t bg-gray-50">

                        {commentFiles.map((file, i) => (
                          <div
                            key={i}
                            className="
            flex
            items-center
            justify-between
            bg-white
            border
            rounded-lg
            px-3
            py-2
            text-sm
            shadow-sm
          "
                          >
                            <div className="flex items-center gap-2">
                              <span>📎</span>
                              <span className="font-medium text-gray-700">
                                {file.name}
                              </span>
                            </div>

                            <button
                              onClick={() =>
                                setCommentFiles((prev) =>
                                  prev.filter((_, index) => index !== i)
                                )
                              }
                              className="
              text-red-500
              hover:text-red-700
              font-semibold
            "
                            >
                              ✖
                            </button>
                          </div>
                        ))}

                      </div>
                    )}

                    {/* SUBMIT */}
                    <div className="px-4 pb-4 pt-2 flex justify-end border-t bg-white">

                      <button
                        onClick={async () => {
                          const html = editor?.getHTML() || ""

                          if (!html.replace(/<[^>]+>/g, "").trim() && commentFiles.length === 0) return;

                          await handleAddComment();
                        }}
                        className="
        bg-indigo-600
        hover:bg-indigo-700
        text-white
        px-5
        py-2
        rounded-lg
        font-medium
        shadow-sm
        transition
      "
                      >
                        {t.send}
                      </button>

                    </div>

                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}



      {/* CREATE MODAL */}
      {createOpen ? (
        <CreateTaskModal
          users={users}   // 👈 BUNU ƏLAVƏ ET
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
              allow_comments: true,
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

  const { lang } = useLang()
  const t = translations[lang]
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
          {value.length ? `${value.length} ${t.selected}` : placeholder}
        </span>
        <span className="text-indigo-600 text-sm">▲</span>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-2xl shadow-xl border overflow-hidden">
          <div className="p-3 border-b">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
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
              {t.clear}
            </button>

            <button
              onClick={() => {
                onChange(temp);
                setOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
            >
              {t.done}
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


function DrawerRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-50 border rounded-xl p-3 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
      <div className="font-bold text-sm">{label}</div>
      <div className="text-sm">{value ?? "-"}</div>
    </div>
  );
}

/* COLUMN */
/* COLUMN */
function Column({
  id,
  title,
  tasks,
  onSelect,
  can,
  currentUserId,
  userRole,
  updateTask,
  loadTasks,
  moveTask,
  users,
  statusLabels,
  isMobile
}: {
  id: Status;
  title: string;
  tasks: Task[];
  onSelect: (t: Task) => void;
  can: (key: string) => boolean;
  currentUserId: string;
  userRole: string;
  updateTask: (id: string, updates: any) => Promise<void>;
  loadTasks: () => void;
  moveTask: (taskId: string, nextStatus: Status) => void;
  users: UserInfo[];
  statusLabels: Record<Status, string>;
  isMobile: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isCancelledLocked =
    id === "CANCELLED" && userRole === "EMPLOYEE";

  return (
    <div
      ref={setNodeRef}
      className={`
        bg-gradient-to-b from-slate-50 to-white
        rounded-3xl
        p-5
        shadow-lg
        border border-slate-200
        flex flex-col
        max-h-none lg:max-h-[75vh]
        transition
        ${isOver ? "ring-2 ring-indigo-400" : ""}
      `}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 tracking-wide flex items-center gap-2">
          {statusLabels[id]}

          {isCancelledLocked && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              🔒 locked
            </span>
          )}
        </h3>

        <span
          className="
            text-xs
            px-3
            py-1
            rounded-full
            bg-indigo-100
            text-indigo-700
            font-semibold
          "
        >
          {tasks.length}
        </span>
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={onSelect}
              can={can}
              currentUserId={currentUserId}
              userRole={userRole}
              updateTask={updateTask}
              // loadTasks={loadTasks}
              moveTask={moveTask}   // 👈 əlavə et
              users={users}
              isMobile={isMobile}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

function getTaskProgress(task: Task) {
  if (!task.start_date || !task.due_date) return 0;

  const start = new Date(task.start_date).getTime();
  const end = new Date(task.due_date).getTime();
  const now = Date.now();

  if (now <= start) return 0;
  if (now >= end) return 100;

  const total = end - start;
  const passed = now - start;

  return Math.round((passed / total) * 100);
}


/* CARD */
const TaskCard = React.memo(function TaskCard({
  task,
  onSelect,
  can,
  currentUserId,
  userRole,
  updateTask,
  moveTask,
  users,
  isMobile
}: {
  task: Task;
  onSelect: (t: Task) => void;
  can: (key: string) => boolean;
  currentUserId: string;
  userRole: string;
  users: UserInfo[];
  updateTask: (id: string, updates: any) => Promise<void>;
  moveTask: (taskId: string, nextStatus: Status) => void;
  isMobile: boolean;
}) {

  const { lang } = useLang()
  const t = translations[lang]

  const isDone =
    (task.status === "DONE" || task.status === "CANCELLED") &&
    userRole === "EMPLOYEE";
  const progress = getTaskProgress(task);


  const isCreator = task.created_by === currentUserId

  /* DUE STATUS */
  const now = new Date();
  let dueStatus: "normal" | "soon" | "overdue" = "normal";

  if (task.due_date) {
    const due = new Date(task.due_date);
    const diff = due.getTime() - now.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 0 && !isDone) {
      dueStatus = "overdue";
    } else if (hours <= 48 && hours >= 0 && !isDone) {
      dueStatus = "soon";
    }
  }

  const bgColor =
    dueStatus === "overdue"
      ? "bg-red-50 border-red-300"
      : dueStatus === "soon"
        ? "bg-yellow-50 border-yellow-300"
        : task.status === "TODO"
          ? "bg-white border-slate-200"
          : task.status === "IN_PROGRESS"
            ? "bg-blue-50 border-blue-200"
            : task.status === "DONE"
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: (!can("tasks.edit.list")) || isDone || isMobile,
  });

  const isAssignedUser =
    task.assigned_to?.includes(currentUserId);

  const role = (userRole || "").toUpperCase()

  const isAdmin = role === "ADMIN"
  const isRehber = role === "REHBER"
  const isEmployee = role === "EMPLOYEE"


  const isAssigned = task.assigned_to?.includes(currentUserId)


  const isCancelledLocked =
    task.status === "CANCELLED" &&
    userRole === "EMPLOYEE" &&
    task.created_by !== currentUserId;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : isDone ? 0.7 : 1,
      }}
      {...attributes}
      {...(!isDone && !isMobile ? listeners : {})}
      className={`
      ${bgColor}
      p-4
      rounded-2xl
      shadow-md
      hover:shadow-xl
      transition-all
      border
      select-none
      relative
     ${isDone
          ? "cursor-default opacity-70"
          : isMobile
            ? "cursor-pointer"
            : "hover:shadow-md cursor-grab active:cursor-grabbing"}
    `}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(task);
      }}
    >

      {task.creator_name && (
        <div className="text-[11px] text-gray-400 mt-1">
          {task.creator_name} {t.createdByUser}
        </div>
      )}

      <div className="font-semibold text-gray-900 flex items-center gap-2">
        {task.title}

        {(task.status === "DONE" || task.status === "CANCELLED") &&
          userRole === "EMPLOYEE" && (
            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-700">
              🔒
            </span>
          )}
      </div>

      <div className="absolute top-3 right-3 text-[10px] text-gray-400 font-semibold">
        #{task.id?.slice(0, 4)}
      </div>



      <div className="
  mt-2
  flex
  flex-col
  sm:flex-row
  sm:items-center
  sm:justify-between
  gap-2
  text-xs
  text-gray-600
">

        <PriorityPill p={String(task.priority)} />

        {/* ACTION BUTTON */}
        {task.status !== "DONE" && task.status !== "CANCELLED" && (
          <button
            onClick={async (e) => {
              e.stopPropagation();

              let nextStatus: Status | null = null

              if (task.status === "TODO") {
                nextStatus = "IN_PROGRESS"
              }

              if (task.status === "IN_PROGRESS") {
                nextStatus = "DONE"
              }

              if (!nextStatus) return
              if (!nextStatus) return;

              moveTask(task.id, nextStatus);   // 🔥 instant UI move
              await updateTask(task.id, { status: nextStatus });
              // loadTasks();
            }}
            className="mt-3 w-full bg-indigo-600 text-white py-1.5 rounded-lg text-xs hover:bg-indigo-700"
          >
            {task.status === "TODO" && t.startTask}
            {task.status === "IN_PROGRESS" && t.completeTask}
          </button>
        )}
        {task.status === "DONE" && isCreator && (
          <button
            onClick={async (e) => {
              e.stopPropagation()

              moveTask(task.id, "TODO")
              await updateTask(task.id, { status: "TODO" })
            }}
            className="mt-3 w-full bg-gray-200 text-gray-800 py-1.5 rounded-lg text-xs hover:bg-gray-300"
          >
            {t.reopenTask}
          </button>
        )}

        {task.status === "CANCELLED" && isCreator && (
          <button
            onClick={async (e) => {
              e.stopPropagation()

              moveTask(task.id, "TODO")
              await updateTask(task.id, { status: "TODO" })
            }}
            className="mt-3 w-full bg-gray-200 text-gray-800 py-1.5 rounded-lg text-xs hover:bg-gray-300"
          >
            Tapşırığı yenidən açın
          </button>
        )}

      </div>


      {/* PROGRESS LABEL */}
      {!isDone && task.start_date && task.due_date && (
        <div className="w-full h-1.5 bg-gray-200 rounded mt-1">
          <div
            className="h-full bg-indigo-500 rounded"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
});

//bura kimi

/* EDIT DRAWER */
type EditDrawerProps = {
  task: Task;
  users: UserInfo[];
  currentUserId: string;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => Promise<void> | void;
};



function EditDrawer({ task, users, currentUserId, onClose, onSave }: EditDrawerProps) {

  const { lang } = useLang()
  const t = translations[lang]

  const isAssignedUser =
    task.assigned_to?.includes(currentUserId);


  const [form, setForm] = useState<Partial<Task>>({
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    assigned_to: task.assigned_to ?? [],
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
      assigned_to: task.assigned_to ?? [],
    });
  }, [task]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-[720px] rounded-2xl shadow-2xl border overflow-hidden">

        {/* HEADER */}
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-bold">{t.editTask}</h2>
          <button onClick={onClose}>✖</button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">


          <>
            {/* TITLE */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t.title}</label>
              <input

                className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100"
                value={form.title ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t.description}</label>
              <textarea

                className="w-full border rounded-lg px-3 py-2 mt-1 min-h-[120px] disabled:bg-gray-100"
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
          </>


          {/* STATUS */}
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={form.status as string}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as any }))
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* GRID SECTION */}

          <div className="grid grid-cols-2 gap-4">



            {/* PRIORITY */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t.priority}</label>
              <select

                className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100"
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
            </div>

            {/* START DATE */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t.startDate}</label>
              <input

                type="date"
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={(form.start_date ?? "") as string}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    start_date: e.target.value || null,
                  }))
                }
              />
            </div>

            {/* DUE DATE */}
            <div>
              <label className="text-sm font-medium text-gray-700">{t.dueDate}</label>
              <input

                type="date"
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={(form.due_date ?? "") as string}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    due_date: e.target.value || null,
                  }))
                }
              />
            </div>

            {/* ASSIGNED */}
            {/* ASSIGNED */}
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">
                {t.assignedTo}
              </label>

              <Select

                mode="multiple"
                allowClear
                placeholder={t.selectUser}
                className="w-full mt-1"
                value={(form.assigned_to ?? []) as string[]}
                onChange={(vals) =>
                  setForm((p) => ({
                    ...p,
                    assigned_to: vals,
                  }))
                }
                options={users.map((u) => ({
                  value: u.id,
                  label: u.name,
                }))}
              />
            </div>
          </div>


          {/* FILES */}

          <div>
            <label className="text-sm font-medium text-gray-700">{t.addFiles}</label>
            <input
              type="file"
              multiple
              className="w-full border rounded-lg px-3 py-2 mt-1"
              onChange={(e) =>
                setNewFiles(Array.from(e.target.files || []))
              }
            />
          </div>


        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="border px-5 py-2 rounded-lg"
          >
            {t.cancel}
          </button>

          <button
            onClick={async () => {

              const payload = isAssignedUser
                ? { status: form.status }
                : form;

              await onSave(payload);

            }}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700"
          >
            {t.saveChanges}
          </button>
        </div>

      </div>
    </div>
  );
}

function CalendarView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[];
  onSelectTask: (t: Task) => void;
}) {

  const { lang } = useLang()
  const t = translations[lang]

  const dateCellRender = (value: dayjs.Dayjs) => {
    const dayStr = value.format("YYYY-MM-DD");

    const dayTasks = tasks.filter(
      (t) =>
        t.start_date === dayStr ||
        t.due_date === dayStr
    );

    if (!dayTasks.length) return null;

    return (
      <div className="space-y-1">
        {dayTasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            onClick={() => onSelectTask(task)}
            className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-indigo-100 truncate"
          >
            {task.title}
          </div>
        ))}

        {dayTasks.length > 3 && (
          <div className="text-[10px] text-gray-500">
            + {dayTasks.length - 3} {t.more}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow border">
      <Calendar
        fullscreen
        cellRender={(value, info) => {
          if (info.type === "date") {
            return dateCellRender(value);
          }
          return info.originNode;
        }}
      />
    </div>
  );
}



/* CREATE MODAL */
function CreateTaskModal({
  users,
  onClose,
  onCreate,
}: {
  users: UserInfo[];
  onClose: () => void;
  onCreate: (payload: Partial<Task>) => Promise<void> | void;
}) {

  const { lang } = useLang()
  const t = translations[lang]
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
      <div className="
  bg-white
  w-full
  max-w-[560px]
  sm:rounded-2xl
  rounded-xl
  shadow-2xl
  border
  overflow-hidden
">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="font-bold text-lg">{t.newTask}</div>
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800">
            Close
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">{t.taskName}</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.title ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Task title..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">{t.description}
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 min-h-[110px]"
              value={form.description ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">{t.status}</label>
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
              <label className="text-sm font-medium text-gray-700">{t.priority}</label>
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
              {t.startDate}
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
              <label className="text-sm font-medium text-gray-700">{t.dueDate}</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2"
                value={(form.due_date ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value || null }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {t.assignedTo}
              </label>

              <Select
                mode="multiple"
                allowClear
                placeholder={t.selectUser}
                className="w-full"
                value={(form.assigned_to ?? []) as string[]}
                onChange={(vals) =>
                  setForm((p) => ({
                    ...p,
                    assigned_to: vals,
                  }))
                }
                options={users.map((u) => ({
                  value: u.id,
                  label: u.name,
                }))}
              />
            </div>
          </div>

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
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700"
            >
              {t.createTask}
            </button>

            <button onClick={onClose} className="border px-5 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
              {t.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

//bura kimi geldik