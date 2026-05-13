"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Circle,
  Loader2,
  X,
} from "lucide-react";

type NotificationItem = {
  id: string;
  user_id: string;
  title?: string | null;
  body?: string | null;
  task_id?: string | null;
  is_read?: boolean | null;
  created_at?: string | null;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationBell() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function init() {
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const authId = data.session?.user?.id;

      if (!authId) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", authId)
        .single();

      if (!emp) return;

      setEmployeeId(emp.id);
      await fetchNotifications(emp.id);

      const channel = supabase
        .channel(`notifications-${emp.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${emp.id}`,
          },
          (payload) => {
            const next = payload.new as NotificationItem;

            setItems((prev) => {
              if (prev.some((item) => item.id === next.id)) return prev;
              return [next, ...prev].slice(0, 30);
            });

            if (!next.is_read) {
              setUnread((prev) => prev + 1);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } finally {
      setLoading(false);
    }
  }

  async function fetchNotifications(empId: string) {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", empId)
      .order("created_at", { ascending: false })
      .limit(30);

    const rows = (data || []) as NotificationItem[];

    setItems(rows);
    setUnread(rows.filter((n) => !n.is_read).length);
  }

  async function markAsRead(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.is_read) return;

    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    setUnread((prev) => Math.max(0, prev - 1));

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      setUnread((prev) => prev + 1);
    }
  }

  async function markAllAsRead() {
    if (!employeeId || unread === 0) return;

    setMarkingAll(true);

    const prevItems = items;
    const prevUnread = unread;

    setItems((current) => current.map((n) => ({ ...n, is_read: true })));
    setUnread(0);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", employeeId)
      .eq("is_read", false);

    if (error) {
      setItems(prevItems);
      setUnread(prevUnread);
    }

    setMarkingAll(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition",
          "hover:bg-slate-50 hover:text-[#e42526] hover:shadow-md active:scale-95",
          open && "border-[#e42526]/30 bg-[#fff1f1] text-[#e42526]"
        )}
        aria-label="Bildirişlər"
      >
        <Bell size={20} />

        {unread > 0 && (
          <>
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white">
              {unread > 99 ? "99+" : unread}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 z-[100] mt-3 w-[calc(100vw-32px)] max-w-[390px] overflow-hidden rounded-[26px]",
            "border border-slate-200 bg-white shadow-2xl animate-fadeIn"
          )}
        >
          <div className="relative overflow-hidden border-b border-slate-200 bg-white px-4 py-4">
            <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-[#e42526]/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[#fff1f1] text-[#e42526]">
                    <Bell size={17} />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-950">
                      Bildirişlər
                    </h3>
                    <p className="mt-0.5 text-xs font-bold text-slate-400">
                      {unread} oxunmamış
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950"
                aria-label="Bağla"
              >
                <X size={15} />
              </button>
            </div>

            <div className="relative mt-4 flex items-center justify-between gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                Son {items.length} bildiriş
              </span>

              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unread === 0 || markingAll}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-[11px] font-black text-white transition hover:bg-[#e42526] disabled:pointer-events-none disabled:opacity-40"
              >
                {markingAll ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCheck size={13} />
                )}
                Hamısı oxundu
              </button>
            </div>
          </div>

          <div className="custom-scrollbar max-h-[430px] overflow-y-auto bg-slate-50/70 p-2.5">
            {loading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                  <Loader2 size={17} className="animate-spin" />
                  Yüklənir...
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white p-6 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-3xl bg-slate-100 text-slate-400">
                  <Bell size={22} />
                </div>
                <p className="mt-3 text-sm font-black text-slate-500">
                  Bildiriş yoxdur
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  Yeni task və dəyişikliklər burada görünəcək.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    item={n}
                    onRead={() => markAsRead(n.id)}
                    onNavigate={() => {
                      markAsRead(n.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  onRead,
  onNavigate,
}: {
  item: NotificationItem;
  onRead: () => void;
  onNavigate: () => void;
}) {
  const unread = !item.is_read;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRead}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onRead();
      }}
      className={cn(
        "group rounded-[20px] border p-3 transition active:scale-[0.99]",
        unread
          ? "border-[#e42526]/20 bg-white shadow-sm"
          : "border-slate-200 bg-white/75 hover:bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl",
            unread ? "bg-[#fff1f1] text-[#e42526]" : "bg-slate-100 text-slate-400"
          )}
        >
          {unread ? <Circle size={14} fill="currentColor" /> : <Bell size={16} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                "line-clamp-1 text-sm leading-5",
                unread
                  ? "font-black text-slate-950"
                  : "font-bold text-slate-600"
              )}
            >
              {item.title || "Bildiriş"}
            </h4>

            {item.created_at && (
              <span className="shrink-0 text-[10px] font-bold text-slate-400">
                {formatTime(item.created_at)}
              </span>
            )}
          </div>

          {item.body && (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
              {item.body}
            </p>
          )}

          {item.task_id && (
            <Link
              href={`/dashboard/tasks?open=${item.task_id}`}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700 transition hover:bg-indigo-100"
            >
              Task-a keç
              <ChevronRight size={13} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}