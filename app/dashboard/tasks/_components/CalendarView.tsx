"use client";

import dynamic from "next/dynamic";
import dayjs from "dayjs";
import type { Task } from "./taskTypes";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

const Calendar = dynamic(() => import("antd/es/calendar"), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-[28px] border border-slate-200 bg-white" />
  ),
});

export default function CalendarView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[];
  onSelectTask: (t: Task) => void;
}) {
  const { lang } = useLang();
  const t = translations[lang];

  const dateCellRender = (value: dayjs.Dayjs) => {
    const dayStr = value.format("YYYY-MM-DD");

    const dayTasks = tasks.filter(
      (task) => task.start_date === dayStr || task.due_date === dayStr
    );

    if (!dayTasks.length) return null;

    return (
      <div className="space-y-1">
        {dayTasks.slice(0, 3).map((task) => (
          <button
            key={task.id}
            onClick={() => onSelectTask(task)}
            className="block w-full truncate rounded-lg bg-indigo-50 px-2 py-1 text-left text-xs font-bold text-indigo-700 hover:bg-indigo-100"
          >
            {task.title}
          </button>
        ))}

        {dayTasks.length > 3 && (
          <div className="text-[10px] text-slate-500">
            + {dayTasks.length - 3} {t.more}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <Calendar
        fullscreen
        cellRender={(value: any, info: any) => {
          if (info.type === "date") return dateCellRender(value);
          return info.originNode;
        }}
      />
    </div>
  );
}