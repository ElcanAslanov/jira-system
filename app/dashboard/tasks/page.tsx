"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { message } from "antd";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthProvider";
import { useEmployees } from "@/hooks/useEmployees";
import { useTasks } from "@/hooks/useTasks";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

import TasksHeader from "./_components/TasksHeader";
import TasksSkeleton from "./_components/TasksSkeleton";
import BoardView from "./_components/BoardView";
import ListView from "./_components/ListView";
import ViewTaskDrawer from "./_components/ViewTaskDrawer";
import EditDrawer from "./_components/EditDrawer";
import CreateTaskModal from "./_components/CreateTaskModal";

import {
  STATUSES,
  Status,
  Task,
  TasksByStatus,
  UserInfo,
} from "./_components/taskTypes";

import {
  findTask,
  getNewSortIndex,
  groupByStatus,
  isStatus,
} from "./_components/taskUtils";

const CalendarView = dynamic(() => import("./_components/CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-[28px] border border-slate-200 bg-white" />
  ),
});

const PAGE_SIZE = 6;

export default function TasksPage() {
  const { lang } = useLang();
  const t = translations[lang];

  const searchParams = useSearchParams();
  const openTaskId = searchParams.get("open");

  const { user, loading } = useAuth();

  const [roleName, setRoleName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"board" | "list" | "calendar">(
    "board"
  );

  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [tasksBy, setTasksByState] = useState<TasksByStatus>(() =>
    groupByStatus([])
  );
  const tasksByRef = useRef<TasksByStatus>(tasksBy);

  const setTasksBy = useCallback(
    (next: TasksByStatus | ((p: TasksByStatus) => TasksByStatus)) => {
      setTasksByState((prev) => {
        const resolved =
          typeof next === "function" ? (next as any)(prev) : next;

        tasksByRef.current = resolved;
        return resolved;
      });
    },
    []
  );

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);
  const [startRange, setStartRange] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [dueRange, setDueRange] = useState<[string | null, string | null]>([
    null,
    null,
  ]);

  const [sortBy, setSortBy] = useState<
    "title" | "status" | "priority" | "start_date" | "due_date" | "assigned_to"
  >("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [isMobile, setIsMobile] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const prevSnapshotRef = useRef<TasksByStatus | null>(null);
  const appliedTasksSignatureRef = useRef<string>("");

  const shouldLoadEmployees =
    viewMode !== "board" || createOpen || !!selectedTask || !!viewTask;

  const { data: employees = [] } = useEmployees({
    enabled: shouldLoadEmployees,
  } as any);

  const {
    data: queryTasks = [],
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useTasks(!loading && !!user?.id);

  const users: UserInfo[] = useMemo(() => {
    if (!shouldLoadEmployees || !employees?.length) return [];

    return [...employees]
      .sort((a: any, b: any) =>
        `${a.ad ?? ""} ${a.soyad ?? ""}`.localeCompare(
          `${b.ad ?? ""} ${b.soyad ?? ""}`,
          "az"
        )
      )
      .map((u: any) => ({
        id: u.id || u.user_id,
        name: `${u.ad ?? ""} ${u.soyad ?? ""}`.trim(),
        email: u.email ?? null,
        role: u.positions?.name ?? u.position_name ?? null,
        company: u.companies?.name ?? u.company_name ?? null,
        department: u.departments?.name ?? u.department_name ?? null,
      }));
  }, [employees, shouldLoadEmployees]);

  const STATUS_LABELS: Record<Status, string> = useMemo(
    () => ({
      TODO: t.todo,
      IN_PROGRESS: t.inProgress,
      DONE: t.taskDone,
      CANCELLED: t.cancelled,
    }),
    [t]
  );

  const can = useCallback(
    (key: string) => permissions.includes(key),
    [permissions]
  );

  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("SESSION ERROR:", error);
      return null;
    }

    const token = data?.session?.access_token ?? null;
    tokenRef.current = token;

    return token;
  }, []);

  const applyTasks = useCallback(
    (tasks: Task[]) => {
      const signature = tasks
        .map((task) => {
          return [
            task.id,
            task.status,
            task.sort_index,
            task.updated_at ?? "",
            task.comment_count ?? 0,
          ].join(":");
        })
        .join("|");

      if (appliedTasksSignatureRef.current === signature) {
        return;
      }

      appliedTasksSignatureRef.current = signature;

      setRawTasks(tasks);
      setTasksBy(groupByStatus(tasks));
    },
    [setTasksBy]
  );

  const reloadTasks = useCallback(async () => {
    const result = await refetchTasks();

    if (result.data) {
      applyTasks(result.data);
    }
  }, [applyTasks, refetchTasks]);

  useEffect(() => {
    if (!Array.isArray(queryTasks)) return;

    applyTasks(queryTasks);
  }, [applyTasks, queryTasks]);

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.log("PUT ERROR:", data);
        message.error(data?.error || "Tapşırıq yenilənmədi");
        throw new Error(data?.error || "Tapşırıq yenilənmədi");
      }
    },
    [getToken]
  );

  const moveTask = useCallback(
    (taskId: string, nextStatus: Status) => {
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
        next[nextStatus].push({ ...task, status: nextStatus });

        return next;
      });
    },
    [setTasksBy]
  );

  const createTask = useCallback(
    async (payload: Partial<Task>) => {
      const token = await getToken();

      const res = await fetch("/api/tasks", {
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
        const text = await res.text().catch(() => "");
        throw new Error(text || "Create failed");
      }

      const data = await res.json();
      return data.task as Task | undefined;
    },
    [getToken, user]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const token = await getToken();

      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-user-id": user?.id ?? "",
          "x-user-role": (user as any)?.role ?? "",
        },
        body: JSON.stringify({ id: taskId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Delete failed");
      }
    },
    [getToken, user]
  );

  const [activity, setActivity] = useState<string[]>([]);
  const pushActivity = useCallback((msg: string) => {
    setActivity((p) => [msg, ...p].slice(0, 20));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);

    check();

    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    message.config({
      top: 80,
      duration: 3,
      maxCount: 3,
    });
  }, []);

  useEffect(() => {
  if (!user?.id) return;

  let alive = true;

  async function loadCurrentEmployee() {
    const { data, error } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!alive) return;

    if (error) {
      console.error("CURRENT EMPLOYEE LOAD ERROR:", error);
      return;
    }

    if (data?.id) {
      setEmployeeId(data.id);
    }
  }

  loadCurrentEmployee();

  return () => {
    alive = false;
  };
}, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let alive = true;

    async function loadPermissions() {
      const cacheKey = `task_permissions_${user.id}`;

      try {
        const cached = sessionStorage.getItem(cacheKey);

       if (cached) {
  const parsed = JSON.parse(cached);

  if (Array.isArray(parsed.permissions)) {
    setPermissions(parsed.permissions);
  }

  if (typeof parsed.roleName === "string") {
    setRoleName(parsed.roleName);
  }

  if (typeof parsed.employeeId === "string") {
    setEmployeeId(parsed.employeeId);
  }

  if (parsed.employeeId) {
    return;
  }
}
      } catch {
        // ignore cache parse error
      }

      const { data: employee } = await supabase
  .from("employees")
  .select("id, role_id")
  .eq("user_id", user.id)
  .maybeSingle();

const roleId = employee?.role_id;

if (employee?.id) {
  setEmployeeId(employee.id);
}

      if (!roleId) {
        console.warn("ROLE_ID TAPILMADI");
        return;
      }

      const [{ data: rolePerms }, { data: userPerms }, { data: roleRow }] =
        await Promise.all([
          supabase
            .from("role_permissions")
            .select("permission_key")
            .eq("role_id", roleId),

          supabase
            .from("user_permissions")
            .select("permission_key, allowed")
            .eq("user_id", user.id),

          supabase.from("roles").select("name").eq("id", roleId).maybeSingle(),
        ]);

      let finalPerms = rolePerms?.map((p: any) => p.permission_key) || [];

      if (userPerms) {
        userPerms.forEach((p: any) => {
          if (p.allowed === true && !finalPerms.includes(p.permission_key)) {
            finalPerms.push(p.permission_key);
          }

          if (p.allowed === false) {
            finalPerms = finalPerms.filter((k) => k !== p.permission_key);
          }
        });
      }

      const nextRoleName = roleRow?.name ?? null;

      if (!alive) return;

      setRoleName(nextRoleName);
      setPermissions(finalPerms);

      try {
        sessionStorage.setItem(
  cacheKey,
  JSON.stringify({
    roleName: nextRoleName,
    permissions: finalPerms,
    employeeId: employee?.id ?? null,
  })
);
      } catch {
        // ignore storage error
      }
    }

    loadPermissions();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (openTaskId && rawTasks.length > 0) {
      const found = rawTasks.find((task) => task.id === openTaskId);

      if (found) {
        setViewTask(found);
        setDrawerOpen(true);
      }
    }
  }, [openTaskId, rawTasks]);

  useEffect(() => {
    if (!user?.id) return;

    const timer = window.setTimeout(() => {
      const tasksChannel = supabase
        .channel("tasks-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "tasks" },
          async () => {
            await reloadTasks();
            message.success("Yeni tapşırıq əlavə edildi");
          }
        )
        .subscribe();

      const filesChannel = supabase
        .channel("task-files-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "task_files" },
          () => reloadTasks()
        )
        .subscribe();

      const commentsChannel = supabase
        .channel("comments-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "task_comments" },
          (payload) => {
            const taskId = payload.new.task_id;

            setTasksBy((prev) => {
              const next: TasksByStatus = {
                TODO: [...prev.TODO],
                IN_PROGRESS: [...prev.IN_PROGRESS],
                DONE: [...prev.DONE],
                CANCELLED: [...prev.CANCELLED],
              };

              for (const st of STATUSES) {
                next[st] = next[st].map((task) =>
                  task.id === taskId
                    ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
                    : task
                );
              }

              return next;
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(tasksChannel);
        supabase.removeChannel(filesChannel);
        supabase.removeChannel(commentsChannel);
      };
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [user?.id, reloadTasks, setTasksBy]);

  useEffect(() => {
    if (!viewTask) return;

    const loadComments = async () => {
      const token = await getToken();

      if (!token) return;

      setComments([]);

      const [res] = await Promise.all([
        fetch(`/api/tasks/${viewTask.id}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/tasks/${viewTask.id}/comments/read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (!res.ok) {
        console.error("COMMENT LOAD ERROR:", await res.text());
        return;
      }

      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    };

    loadComments();
  }, [viewTask, getToken]);

  const handleAddComment = useCallback(
    async (editorApi: any) => {
      if (!viewTask) return;

      const token = await getToken();

      if (!token) {
        console.error("No auth token");
        return;
      }

      const html = editorApi?.getHTML?.() || "";

      if (!html.replace(/<[^>]+>/g, "").trim() && commentFiles.length === 0) {
        return;
      }

      const uploaded: {
        name: string;
        path: string;
        size?: number;
        type?: string;
      }[] = [];

      try {
        const maxFileSize = 20 * 1024 * 1024;

        for (const file of commentFiles) {
          if (file.size > maxFileSize) {
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
          message.error(data?.error || t.commentError);
          return;
        }

        const newComment = {
          id: Date.now(),
          message: html,
          created_at: new Date().toISOString(),
          author_id: user.id,
          author_name: user.user_metadata?.full_name || "You",
          files: uploaded,
          reads: [],
        };

        setComments((prev) => [newComment, ...prev]);

        setTasksBy((prev) => {
          const next: TasksByStatus = {
            TODO: [...prev.TODO],
            IN_PROGRESS: [...prev.IN_PROGRESS],
            DONE: [...prev.DONE],
            CANCELLED: [...prev.CANCELLED],
          };

          for (const st of STATUSES) {
            next[st] = next[st].map((task) =>
              task.id === viewTask.id
                ? { ...task, comment_count: (task.comment_count ?? 0) + 1 }
                : task
            );
          }

          return next;
        });

        editorApi?.clear?.();
        setCommentFiles([]);

        message.success(t.commentAdded);
      } catch (err) {
        console.error("Add comment failed:", err);
        message.error(t.error);
      }
    },
    [commentFiles, getToken, setTasksBy, t, user, viewTask]
  );

  const filteredTasksBy = useMemo(() => {
    const out: TasksByStatus = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      CANCELLED: [],
    };

    for (const st of STATUSES) {
      out[st] = tasksBy[st].filter((task) => {
        if (q.trim()) {
          const needle = q.toLowerCase();

          if (
            !(task.title ?? "").toLowerCase().includes(needle) &&
            !(task.description ?? "").toLowerCase().includes(needle)
          ) {
            return false;
          }
        }

        if (
          statusFilter.length &&
          !statusFilter.includes(task.status as Status)
        ) {
          return false;
        }

        if (priorityFilter.length && !priorityFilter.includes(task.priority)) {
          return false;
        }

        if (
          assignedFilter.length &&
          !assignedFilter.some((name) =>
            (task.assigned_to ?? []).includes(name)
          )
        ) {
          return false;
        }

        const [startFrom, startTo] = startRange;
        const [dueFrom, dueTo] = dueRange;

        if (startFrom && (!task.start_date || task.start_date < startFrom)) {
          return false;
        }

        if (startTo && (!task.start_date || task.start_date > startTo)) {
          return false;
        }

        if (dueFrom && (!task.due_date || task.due_date < dueFrom)) {
          return false;
        }

        if (dueTo && (!task.due_date || task.due_date > dueTo)) {
          return false;
        }

        return true;
      });
    }

    return out;
  }, [
    assignedFilter,
    dueRange,
    priorityFilter,
    q,
    startRange,
    statusFilter,
    tasksBy,
  ]);

  const filteredFlat = useMemo(() => {
    const arr: Task[] = [];

    for (const st of STATUSES) {
      arr.push(...filteredTasksBy[st]);
    }

    if (viewMode === "board") return arr;

    const getVal = (task: Task) => {
      if (sortBy === "title") return task.title ?? "";
      if (sortBy === "status") return task.status ?? "";
      if (sortBy === "priority") return task.priority ?? "";
      if (sortBy === "start_date") return task.start_date ?? "";
      if (sortBy === "due_date") return task.due_date ?? "";
      if (sortBy === "assigned_to") return (task.assigned_to ?? []).join(", ");
      return "";
    };

    arr.sort((a, b) => {
      const A = getVal(a);
      const B = getVal(b);

      if (sortBy === "start_date" || sortBy === "due_date") {
        const tA = A ? new Date(A).getTime() : 0;
        const tB = B ? new Date(B).getTime() : 0;

        return sortDir === "asc" ? tA - tB : tB - tA;
      }

      const sA = String(A).toLowerCase();
      const sB = String(B).toLowerCase();

      return sortDir === "asc" ? sA.localeCompare(sB) : sB.localeCompare(sA);
    });

    return arr;
  }, [filteredTasksBy, sortBy, sortDir, viewMode]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFlat.length / PAGE_SIZE)),
    [filteredFlat.length]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredFlat.slice(start, start + PAGE_SIZE);
  }, [filteredFlat, page]);

  const columns = useMemo(
    () =>
      STATUSES.map((st) => ({
        id: st,
        tasks: filteredTasksBy[st],
      })),
    [filteredTasksBy]
  );

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;

    const f = findTask(tasksBy, activeTaskId);

    return f?.task ?? null;
  }, [activeTaskId, tasksBy]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveTaskId(id);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveTaskId(null);

      if (!over || !user?.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const currentTasksBy = tasksByRef.current;
      const activeFound = findTask(currentTasksBy, activeId);

      if (!activeFound) return;

      const overAsStatus = isStatus(overId) ? (overId as Status) : null;
      const overFoundTask = overAsStatus ? null : findTask(currentTasksBy, overId);

      const sourceStatus = activeFound.status;
      const sourceIndex = activeFound.index;

      const targetStatus: Status = overAsStatus
        ? overAsStatus
        : overFoundTask?.status ?? sourceStatus;

      const task = activeFound.task;

     const currentEmployeeId = employeeId;

if (!currentEmployeeId) {
  message.warning("İşçi məlumatı yüklənməyib. Səhifəni yeniləyin.");
  return;
}

const role = (roleName || "").toUpperCase();

const isOwner = task.created_by === currentEmployeeId;

const isAssignee = Array.isArray(task.assigned_ids)
  ? task.assigned_ids.map(String).includes(String(currentEmployeeId))
  : false;

const isAdminLike = role === "ADMIN" || role === "BOSS" || role === "REHBER";

let allowed = false;

if (isAdminLike) {
  allowed = true;
} else if (isOwner) {
  allowed = true;
} else if (isAssignee) {
  if (sourceStatus === "TODO" && targetStatus === "IN_PROGRESS") {
    allowed = true;
  }

  if (sourceStatus === "IN_PROGRESS" && targetStatus === "DONE") {
    allowed = true;
  }
}

if (targetStatus === "CANCELLED" && role === "EMPLOYEE") {
  message.warning("Bu statusa keçirmək üçün icazəniz yoxdur.");
  return;
}

if (!allowed) {
  message.warning("Bu tapşırığı bu statusa keçirmək üçün icazəniz yoxdur.");
  return;
}

      prevSnapshotRef.current = currentTasksBy;

      const next: TasksByStatus = {
        TODO: [...currentTasksBy.TODO],
        IN_PROGRESS: [...currentTasksBy.IN_PROGRESS],
        DONE: [...currentTasksBy.DONE],
        CANCELLED: [...currentTasksBy.CANCELLED],
      };

      const [moved] = next[sourceStatus].splice(sourceIndex, 1);

      if (!moved) return;

      let targetIndex = next[targetStatus].length;

      if (overFoundTask && overFoundTask.status === targetStatus) {
        targetIndex = overFoundTask.index;
      }

      const movedUpdated: Task = { ...moved, status: targetStatus };
      next[targetStatus].splice(targetIndex, 0, movedUpdated);

      const newSort = getNewSortIndex(next[targetStatus], targetIndex);

      next[targetStatus][targetIndex] = {
        ...next[targetStatus][targetIndex],
        sort_index: newSort,
      };

      setTasksBy(next);
      pushActivity(`• "${moved.title}" → ${targetStatus}`);

      try {
        await updateTask(activeId, {
          status: targetStatus,
          sort_index: Math.floor(newSort),
        });
      } catch {
        if (prevSnapshotRef.current) setTasksBy(prevSnapshotRef.current);
        pushActivity(`• Update failed for "${moved.title}"`);
      }
    },
    [employeeId, pushActivity, roleName, setTasksBy, updateTask, user]
  );

  if (loading && rawTasks.length === 0) {
    return null;
  }

  if (tasksLoading && rawTasks.length === 0) {
    return <TasksSkeleton label={t.loading} />;
  }

  if (!user?.id) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-sm">
        {t.noSession}
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 overflow-x-hidden bg-[#f7f8fb] pb-6 lg:pb-10">
      <TasksHeader
        t={t}
        viewMode={viewMode}
        setViewMode={setViewMode}
        can={can}
        filteredFlat={filteredFlat}
      />

      {viewMode === "board" && (
        <BoardView
          columns={columns}
          activeTask={activeTask}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          statusLabels={STATUS_LABELS}
          can={can}
          currentUserId={employeeId ?? user.id}
          userRole={roleName ?? ""}
          users={users}
          updateTask={updateTask}
          moveTask={moveTask}
          isMobile={isMobile}
          onSelect={(task) => {
            setViewTask(task);
            setDrawerOpen(true);
          }}
        />
      )}

      {viewMode === "list" && (
        <ListView
          t={t}
          lang={lang}
          users={users}
          statusLabels={STATUS_LABELS}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          assignedFilter={assignedFilter}
          setAssignedFilter={setAssignedFilter}
          startRange={startRange}
          setStartRange={setStartRange}
          dueRange={dueRange}
          setDueRange={setDueRange}
          setSearchInput={setSearchInput}
          setQ={setQ}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          filteredFlat={filteredFlat}
          paginatedTasks={paginatedTasks}
          sortBy={sortBy}
          sortDir={sortDir}
          toggleSort={toggleSort}
          can={can}
          setViewTask={setViewTask}
          setDrawerOpen={setDrawerOpen}
          setSelectedTask={setSelectedTask}
          tasksBy={tasksBy}
          setTasksBy={setTasksBy}
          deleteTask={deleteTask}
          pushActivity={pushActivity}
        />
      )}

      {viewMode === "calendar" && (
        <CalendarView
          tasks={filteredFlat}
          onSelectTask={(task) => {
            setViewTask(task);
            setDrawerOpen(true);
          }}
        />
      )}

      {selectedTask && (
        <EditDrawer
          task={selectedTask}
          users={users}
          currentUserId={employeeId ?? user.id}
          t={t}
          onClose={() => setSelectedTask(null)}
          onSave={async (updates) => {
            const taskId = selectedTask.id;

            const fixedUpdates = {
              ...updates,
              assigned_ids: updates.assigned_to,
            };

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

              const nextStatus: Status = isStatus(patched.status)
                ? (patched.status as Status)
                : f.status;

              next[f.status].splice(f.index, 1);

              const targetIndex = next[nextStatus].length;
              next[nextStatus].push(patched);

              const newSort = getNewSortIndex(next[nextStatus], targetIndex);

              next[nextStatus][targetIndex] = {
                ...next[nextStatus][targetIndex],
                sort_index: newSort,
              };

              setTasksBy(next);

              try {
                await updateTask(taskId, {
                  ...fixedUpdates,
                  sort_index: newSort,
                });

                pushActivity(`• Edited "${patched.title}"`);
                setSelectedTask(null);
                reloadTasks();
              } catch {
                setTasksBy(snapshot);
                pushActivity(`• Edit failed "${patched.title}"`);
              }
            } else {
              try {
                await updateTask(taskId, fixedUpdates);
                setSelectedTask(null);
                reloadTasks();
              } catch {
                // ignore
              }
            }
          }}
        />
      )}

      {viewTask && (
        <ViewTaskDrawer
          t={t}
          lang={lang}
          user={user}
          viewTask={viewTask}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          setViewTask={setViewTask as any}
          comments={comments}
          setComments={setComments}
          commentFiles={commentFiles}
          setCommentFiles={setCommentFiles}
          users={users}
          can={can}
          tasksBy={tasksBy}
          setTasksBy={setTasksBy}
          deleteTask={deleteTask}
          pushActivity={pushActivity}
          moveTask={moveTask}
          updateTask={updateTask}
          setSelectedTask={setSelectedTask}
          handleAddComment={handleAddComment}
        />
      )}

      {createOpen && (
        <CreateTaskModal
          users={users}
          t={t}
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            const snapshot = tasksBy;

            const next: TasksByStatus = {
              TODO: [...tasksBy.TODO],
              IN_PROGRESS: [...tasksBy.IN_PROGRESS],
              DONE: [...tasksBy.DONE],
              CANCELLED: [...tasksBy.CANCELLED],
            };

            const st: Status = isStatus(payload.status)
              ? (payload.status as Status)
              : "TODO";

            const tempId = `temp-${Math.random().toString(16).slice(2)}`;

            const tempTask: Task = {
              id: tempId,
              title: payload.title ?? "Untitled",
              description: payload.description ?? "",
              status: st,
              priority: (payload.priority as any) ?? "MEDIUM",
              start_date: payload.start_date ?? null,
              due_date: payload.due_date ?? null,
              allow_comments: true,
              sort_index: Date.now(),
              assigned_to: payload.assigned_to ?? null,
              created_by: employeeId ?? user.id,
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
              reloadTasks();
              setTimeout(() => reloadTasks(), 1500);
            } catch {
              setTasksBy(snapshot);
              pushActivity(`• Create failed "${tempTask.title}"`);
            }
          }}
        />
      )}
    </div>
  );
}