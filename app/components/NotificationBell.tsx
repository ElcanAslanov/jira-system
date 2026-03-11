"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function NotificationBell() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
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
    fetchNotifications(emp.id);
    listenRealtime(emp.id);
  }

  async function fetchNotifications(empId: string) {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", empId)
      .order("created_at", { ascending: false })
      .limit(20);

    setItems(data || []);
    setUnread((data || []).filter((n) => !n.is_read).length);
  }

  function listenRealtime(empId: string) {
    supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${empId}`,
        },
        (payload) => {
          setItems((prev) => [payload.new, ...prev]);
          setUnread((prev) => prev + 1);
        }
      )
      .subscribe();
  }

  async function markAsRead(id: string) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );

    setUnread((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="relative">

      {/* 🔔 BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl bg-white shadow hover:shadow-md transition"
      >
        <span className="text-xl">🔔</span>

        {unread > 0 && (
          <span
            className="
              absolute
              -top-1.5
              -right-1.5
              min-w-[20px]
              h-[20px]
              flex
              items-center
              justify-center
              text-[11px]
              font-bold
              rounded-full
              bg-gradient-to-r from-red-500 to-rose-600
              text-white
              shadow-lg
              ring-2
              ring-white
            "
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* DROPDOWN */}
      {open && (
        <div
          className="
            absolute
            right-0
            mt-3
            w-[340px]
            bg-white
            border
            rounded-2xl
            shadow-2xl
            z-50
            overflow-hidden
            animate-fadeIn
          "
        >
          <div className="px-4 py-3 border-b font-semibold text-gray-700 flex justify-between">
            <span>Bildirişlər</span>
            <span className="text-xs text-gray-400">
              {unread} oxunmamış
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">

            {items.length === 0 && (
              <div className="p-6 text-center text-gray-400">
                Bildiriş yoxdur
              </div>
            )}

            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className={`
                  px-4 py-3 border-b last:border-none cursor-pointer transition
                  ${n.is_read
                    ? "bg-white hover:bg-gray-50"
                    : "bg-indigo-50 hover:bg-indigo-100"}
                `}
              >
                <div className="font-semibold text-sm text-gray-800">
                  {n.title}
                </div>

                <div className="text-xs text-gray-600 mt-1">
                  {n.body}
                </div>

                {n.task_id && (
                  <Link
                    href={`/dashboard/tasks?open=${n.task_id}`}
                    className="text-xs text-indigo-600 font-medium mt-2 inline-block hover:underline"
                  >
                    Task-a keç →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}