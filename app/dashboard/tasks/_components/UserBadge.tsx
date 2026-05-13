"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { UserInfo } from "./taskTypes";

export default function UserBadge({
  userId,
  users,
}: {
  userId: string;
  users: UserInfo[];
}) {
  const user =
    users.find((u) => u.id === userId) || users.find((u) => u.name === userId);

  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => setMounted(true), []);

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
      <span className="inline-flex rounded-full border bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
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
        className="inline-flex cursor-pointer items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700"
      >
        👤 {user.name}
      </span>

      {hovered &&
        mounted &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 999999,
            }}
            className="min-w-[210px] rounded-2xl bg-slate-950 px-3 py-2 text-xs text-white shadow-2xl"
          >
            <div className="space-y-1">
              <div className="font-black">{user.name}</div>
              <div className="text-slate-300">{user.email || "-"}</div>
              <div className="my-1 border-t border-slate-700" />
              <div className="text-slate-300">{user.company || "-"}</div>
              <div className="text-slate-300">{user.department || "-"}</div>
              <div className="font-bold text-indigo-300">{user.role || "-"}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}