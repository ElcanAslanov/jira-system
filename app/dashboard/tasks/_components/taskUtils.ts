import { STATUSES, Status, Task, TasksByStatus } from "./taskTypes";

export function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function isStatus(x: any): x is Status {
  return STATUSES.includes(x);
}

export function groupByStatus(tasks: Task[]): TasksByStatus {
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

export function findTask(tasksBy: TasksByStatus, id: string) {
  for (const st of STATUSES) {
    const idx = tasksBy[st].findIndex((t) => t.id === id);
    if (idx !== -1) return { status: st, index: idx, task: tasksBy[st][idx] };
  }

  return null;
}

export function getNewSortIndex(list: Task[], targetIndex: number) {
  const prev = list[targetIndex - 1];
  const next = list[targetIndex + 1];

  const prevVal = prev?.sort_index;
  const nextVal = next?.sort_index;

  if (typeof prevVal === "number" && typeof nextVal === "number") {
    if (prevVal === nextVal) return prevVal + 1;
    return Math.floor(prevVal + (nextVal - prevVal) / 2);
  }

  if (typeof nextVal === "number" && prevVal == null) return nextVal - 1000;
  if (typeof prevVal === "number" && nextVal == null) return prevVal + 1000;

  return Math.floor(Date.now());
}

export function formatDMY(date?: string | null, withTime = false) {
  if (!date) return "-";

  if (!withTime && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  }

  const dt = new Date(date);
  if (Number.isNaN(dt.getTime())) return date;

  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();

  if (!withTime) return `${day}/${month}/${year}`;

  const hours = String(dt.getHours()).padStart(2, "0");
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  const seconds = String(dt.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function getTaskProgress(task: Task) {
  if (!task.start_date || !task.due_date) return 0;

  const start = new Date(task.start_date).getTime();
  const end = new Date(task.due_date).getTime();
  const now = Date.now();

  if (now <= start) return 0;
  if (now >= end) return 100;

  return Math.round(((now - start) / (end - start)) * 100);
}