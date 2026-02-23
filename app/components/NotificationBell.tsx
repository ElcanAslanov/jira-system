"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  // 🔹 Notifications yüklə
  const load = async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const res = await fetch("/api/notifications", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return;

    const data = await res.json();
    setNotifications(data.notifications || []);
  };

  useEffect(() => {
    let channel: any;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await load();

      channel = supabase
        .channel("notifications-channel")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new, ...prev]);
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markRead = async (id: string) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return;

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );
  };

  const unreadCount = notifications.filter(
    (n) => !n.is_read
  ).length;

  return (
    <>
      {/* Bell Button */}
      <div className="relative z-[9999]">
        <button
          onClick={() => setOpen(!open)}
          className="relative text-xl"
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/30 z-[9998]"
        />
      )}

      {/* Desktop Dropdown */}
      <div
        className={`
          hidden md:block
          fixed
          top-16
          right-6
          w-96
          bg-white
          shadow-2xl
          rounded-xl
          p-4
          z-[9999]
          transition-all duration-200
          ${open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
        `}
      >
        <h3 className="font-semibold mb-3 text-lg">
          Notifications
        </h3>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="text-sm text-gray-400">
              No notifications
            </div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`p-3 rounded-lg cursor-pointer transition hover:shadow ${
                n.is_read
                  ? "bg-gray-100"
                  : "bg-blue-100"
              }`}
            >
              <div className="text-sm font-medium">
                {n.title}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {n.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Slide Panel */}
      <div
        className={`
          md:hidden
          fixed
          inset-y-0
          right-0
          w-full
          max-w-sm
          bg-white
          shadow-2xl
          p-4
          z-[9999]
          transform transition-transform duration-300
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">
            Notifications
          </h3>
          <button onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="text-sm text-gray-400">
              No notifications
            </div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`p-3 rounded-lg cursor-pointer ${
                n.is_read
                  ? "bg-gray-100"
                  : "bg-blue-100"
              }`}
            >
              <div className="text-sm font-medium">
                {n.title}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {n.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}