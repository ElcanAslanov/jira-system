"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { Task } from "@/app/dashboard/tasks/_components/taskTypes";
import { isStatus } from "@/app/dashboard/tasks/_components/taskUtils";

export const TASKS_CACHE_KEY = "taskflow_tasks_cache_v1";

export function normalizeTasks(tasks: any[]): Task[] {
  return (tasks || []).map((task: any) => ({
    ...task,
    status: isStatus(task.status) ? task.status : "TODO",
    sort_index:
      typeof task.sort_index === "number"
        ? task.sort_index
        : Number(task.sort_index ?? 0),
    files: Array.isArray(task.files) ? task.files : [],
    comment_count: task.comment_count ?? 0,
    creator_name: task.creator_name ?? null,
    allow_comments: task.allow_comments ?? true,
  }));
}

export function readCachedTasks(): Task[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(TASKS_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.tasks)) return [];

    return normalizeTasks(parsed.tasks);
  } catch {
    return [];
  }
}

export function writeCachedTasks(tasks: Task[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      TASKS_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        tasks,
      })
    );
  } catch {
    // ignore storage errors
  }
}

async function fetchTasks(): Promise<Task[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    return [];
  }

  const res = await fetch("/api/tasks", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Tasks could not be loaded");
  }

  const json = await res.json();
  const tasks = normalizeTasks(json.tasks || []);

  writeCachedTasks(tasks);

  return tasks;
}

export function useTasks(enabled = true) {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    retry: 1,
  });
}