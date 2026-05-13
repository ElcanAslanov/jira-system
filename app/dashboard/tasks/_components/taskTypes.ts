export const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export type Status = (typeof STATUSES)[number];

export type TaskFile = {
  name: string;
  path: string;
  size?: number;
  type?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: Status | string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  start_date?: string | null;
  due_date?: string | null;
  allow_comments?: boolean;
  sort_index: number;
  assigned_to?: string[] | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
  files?: TaskFile[];
  comment_count?: number;
  creator_name?: string | null;
  assigned_ids?: string[] | null;
};

export type TasksByStatus = Record<Status, Task[]>;

export type UserInfo = {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  company?: string | null;
  department?: string | null;
};

export const STATUS_FLOW: Record<Status, Status[]> = {
  TODO: ["IN_PROGRESS", "DONE", "CANCELLED"],
  IN_PROGRESS: ["TODO", "DONE", "CANCELLED"],
  DONE: ["TODO"],
  CANCELLED: ["TODO", "IN_PROGRESS"],
};