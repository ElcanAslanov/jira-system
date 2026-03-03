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

    // auth → employee mapping
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", authId)
      .single();

    if (!emp) return;

    setEmployeeId(emp.id);
    fetchNotifications(emp.id);
    listenRealtime(emp.id);
    console.log("EMPLOYEE ID:", emp.id);
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
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}>
        🔔 {unread > 0 && <span>({unread})</span>}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 40,
            width: 300,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 10,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {items.length === 0 && <div>Bildirim yoxdur</div>}

          {items.map((n) => (
            <div
              key={n.id}
              style={{
                padding: 8,
                marginBottom: 6,
                background: n.is_read ? "#f9f9f9" : "#e6f4ff",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onClick={() => markAsRead(n.id)}
            >
              <div style={{ fontWeight: 600 }}>
                {n.title}
              </div>
              <div style={{ fontSize: 12 }}>
                {n.body}
              </div>

              {n.task_id && (
              <Link
  href={`/dashboard/tasks?open=${n.task_id}`}
  style={{ fontSize: 12, color: "blue" }}
>
  Task-a keç →
</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}