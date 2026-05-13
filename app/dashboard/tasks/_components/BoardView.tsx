"use client";

import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  GripVertical,
  MessageCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { Status, Task, UserInfo } from "./taskTypes";
import { STATUSES } from "./taskTypes";
import { PriorityPill } from "./TaskBadges";
import { formatDMY, getTaskProgress } from "./taskUtils";
import { useLang } from "@/context/LanguageContext";
import { translations } from "@/lib/translations";

const STATUS_META: Record<
  Status,
  {
    icon: any;
    dot: string;
    column: string;
    header: string;
    badge: string;
    border: string;
    mobileBg: string;
    mobileIcon: string;
  }
> = {
  TODO: {
    icon: Circle,
    dot: "bg-slate-400",
    column: "from-slate-50 via-white to-slate-50",
    header: "bg-slate-100 text-slate-700",
    badge: "bg-slate-900 text-white",
    border: "border-slate-200",
    mobileBg: "bg-slate-50",
    mobileIcon: "bg-slate-900 text-white",
  },
  IN_PROGRESS: {
    icon: PlayCircle,
    dot: "bg-blue-500",
    column: "from-blue-50 via-white to-blue-50",
    header: "bg-blue-100 text-blue-700",
    badge: "bg-blue-600 text-white",
    border: "border-blue-200",
    mobileBg: "bg-blue-50",
    mobileIcon: "bg-blue-600 text-white",
  },
  DONE: {
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    column: "from-emerald-50 via-white to-emerald-50",
    header: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-600 text-white",
    border: "border-emerald-200",
    mobileBg: "bg-emerald-50",
    mobileIcon: "bg-emerald-600 text-white",
  },
  CANCELLED: {
    icon: XCircle,
    dot: "bg-red-500",
    column: "from-red-50 via-white to-red-50",
    header: "bg-red-100 text-red-700",
    badge: "bg-red-600 text-white",
    border: "border-red-200",
    mobileBg: "bg-red-50",
    mobileIcon: "bg-red-600 text-white",
  },
};

type BoardColumn = { id: Status; tasks: Task[] };

function customCollisionDetection(args: any) {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  return rectIntersection(args);
}

export default function BoardView({
  columns,
  activeTask,
  handleDragStart,
  handleDragEnd,
  statusLabels,
  can,
  currentUserId,
  userRole,
  users,
  updateTask,
  moveTask,
  isMobile,
  onSelect,
}: {
  columns: BoardColumn[];
  activeTask: Task | null;
  handleDragStart: (e: DragStartEvent) => void;
  handleDragEnd: (e: DragEndEvent) => void;
  statusLabels: Record<Status, string>;
  can: (key: string) => boolean;
  currentUserId: string;
  userRole: string;
  users: UserInfo[];
  updateTask: (id: string, updates: any) => Promise<void>;
  moveTask: (taskId: string, nextStatus: Status) => void;
  isMobile: boolean;
  onSelect: (task: Task) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const [openMobileColumns, setOpenMobileColumns] = useState<
    Record<Status, boolean>
  >({
    TODO: true,
    IN_PROGRESS: false,
    DONE: false,
    CANCELLED: false,
  });

  const totalTasks = useMemo(
    () => columns.reduce((sum, col) => sum + col.tasks.length, 0),
    [columns]
  );

  const toggleMobileColumn = (status: Status) => {
    setOpenMobileColumns((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  if (isMobile) {
    return (
      <div className="space-y-3 pb-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Board
              </h2>
              <p className="mt-1 text-xs font-bold text-slate-400">
                Statuslara görə qruplaşdırılmış task-lar
              </p>
            </div>

            <span className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
              {totalTasks} task
            </span>
          </div>
        </div>

        {columns.map((col) => (
          <MobileColumn
            key={col.id}
            id={col.id}
            tasks={col.tasks}
            statusLabels={statusLabels}
            currentUserId={currentUserId}
            userRole={userRole}
            updateTask={updateTask}
            moveTask={moveTask}
            isOpen={!!openMobileColumns[col.id]}
            onToggle={() => toggleMobileColumn(col.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
   <DndContext
  sensors={sensors}
  collisionDetection={customCollisionDetection}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
      <div className="grid h-[calc(100vh-230px)] min-h-[560px] grid-cols-1 gap-4 pb-2 pt-1 lg:grid-cols-4">
        {columns.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            tasks={col.tasks}
            statusLabels={statusLabels}
            can={can}
            currentUserId={currentUserId}
            userRole={userRole}
            users={users}
            updateTask={updateTask}
            moveTask={moveTask}
            isMobile={isMobile}
            onSelect={onSelect}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="w-[285px] rotate-2 rounded-[20px] border border-slate-200 bg-white px-3 py-2.5 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <PriorityPill p={String(activeTask.priority)} />
              <GripVertical size={14} className="text-slate-300" />
            </div>

            <div className="line-clamp-2 text-[13px] font-black leading-5 text-slate-950">
              {activeTask.title}
            </div>

            {activeTask.start_date &&
              activeTask.due_date &&
              activeTask.status !== "DONE" &&
              activeTask.status !== "CANCELLED" && (
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#e42526]"
                    style={{ width: `${getTaskProgress(activeTask)}%` }}
                  />
                </div>
              )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function MobileColumn({
  id,
  tasks,
  statusLabels,
  currentUserId,
  userRole,
  updateTask,
  moveTask,
  isOpen,
  onToggle,
  onSelect,
}: {
  id: Status;
  tasks: Task[];
  statusLabels: Record<Status, string>;
  currentUserId: string;
  userRole: string;
  updateTask: (id: string, updates: any) => Promise<void>;
  moveTask: (taskId: string, nextStatus: Status) => void;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (task: Task) => void;
}) {
  const meta = STATUS_META[id];
  const Icon = meta.icon;

  return (
    <section
      className={[
        "overflow-hidden rounded-[24px] border bg-white shadow-sm transition-all",
        meta.border,
        isOpen ? "shadow-md" : "",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        className={[
          "flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition active:scale-[0.99]",
          meta.mobileBg,
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={[
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-sm",
              meta.mobileIcon,
            ].join(" ")}
          >
            <Icon size={20} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-slate-950">
              {statusLabels[id]}
            </h3>

            <div className="mt-1 flex items-center gap-2">
              <span className={["h-2 w-2 rounded-full", meta.dot].join(" ")} />
              <span className="text-xs font-bold text-slate-500">
                {tasks.length} task
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={[
              "grid h-8 min-w-8 place-items-center rounded-xl px-2 text-xs font-black",
              meta.badge,
            ].join(" ")}
          >
            {tasks.length}
          </span>

          <span
            className={[
              "grid h-9 w-9 place-items-center rounded-2xl bg-white/80 text-slate-500 shadow-sm transition",
              isOpen ? "rotate-180 text-[#e42526]" : "",
            ].join(" ")}
          >
            <ChevronDown size={18} />
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-white p-3">
          {tasks.length === 0 ? (
            <div className="flex min-h-[130px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm">
                <Icon size={19} />
              </div>
              <p className="mt-3 text-xs font-black text-slate-400">
                Tapşırıq yoxdur
              </p>
            </div>
          ) : (
            <div className="custom-scrollbar max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={onSelect}
                  currentUserId={currentUserId}
                  userRole={userRole}
                  updateTask={updateTask}
                  moveTask={moveTask}
                  isMobile
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Column({
  id,
  tasks,
  onSelect,
  currentUserId,
  userRole,
  updateTask,
  moveTask,
  statusLabels,
  isMobile,
}: {
  id: Status;
  tasks: Task[];
  onSelect: (t: Task) => void;
  can: (key: string) => boolean;
  currentUserId: string;
  userRole: string;
  updateTask: (id: string, updates: any) => Promise<void>;
  moveTask: (taskId: string, nextStatus: Status) => void;
  users: UserInfo[];
  statusLabels: Record<Status, string>;
  isMobile: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const meta = STATUS_META[id];
  const Icon = meta.icon;

  return (
    <section
      ref={setNodeRef}
      className={[
        "group flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border bg-gradient-to-b shadow-sm transition-all duration-200",
        meta.border,
        meta.column,
        isOver ? "scale-[1.005] ring-4 ring-[#e42526]/15" : "",
      ].join(" ")}
    >
      <div className="sticky top-0 z-10 border-b border-white/70 bg-white/80 px-3 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={[
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                meta.header,
              ].join(" ")}
            >
              <Icon size={16} />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-black tracking-tight text-slate-950">
                {statusLabels[id]}
              </h3>

              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={["h-1.5 w-1.5 rounded-full", meta.dot].join(" ")}
                />
                <span className="text-[10px] font-bold text-slate-400">
                  Status
                </span>
              </div>
            </div>
          </div>

          <span
            className={[
              "grid h-7 min-w-7 place-items-center rounded-xl px-2 text-[11px] font-black",
              meta.badge,
            ].join(" ")}
          >
            {tasks.length}
          </span>
        </div>
      </div>

      <SortableContext
  items={tasks.map((t) => t.id)}
  strategy={verticalListSortingStrategy}
>
  <div className="custom-scrollbar flex-1 min-h-[320px] space-y-2 overflow-y-auto p-2.5">
          {tasks.length === 0 ? (
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/55 p-4 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm">
                <Icon size={19} />
              </div>
              <p className="mt-3 text-xs font-black text-slate-400">
                Tapşırıq yoxdur
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelect={onSelect}
                currentUserId={currentUserId}
                userRole={userRole}
                updateTask={updateTask}
                moveTask={moveTask}
                isMobile={isMobile}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}

const TaskCard = React.memo(function TaskCard({
  task,
  onSelect,
  currentUserId,
  userRole,
  updateTask,
  moveTask,
  isMobile,
}: {
  task: Task;
  onSelect: (t: Task) => void;
  currentUserId: string;
  userRole: string;
  updateTask: (id: string, updates: any) => Promise<void>;
  moveTask: (taskId: string, nextStatus: Status) => void;
  isMobile: boolean;
}) {
  const { lang } = useLang();
  const t = translations[lang];

  const taskStatus = String(task.status) as Status;
  const meta = STATUS_META[taskStatus] ?? STATUS_META.TODO;

  const isDone =
    (task.status === "DONE" || task.status === "CANCELLED") &&
    userRole === "EMPLOYEE";

  const progress = getTaskProgress(task);
  const isCreator = task.created_by === currentUserId;

  const now = new Date();
  let dueStatus: "normal" | "soon" | "overdue" = "normal";

  if (task.due_date) {
    const due = new Date(task.due_date);
    const hours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hours < 0 && !isDone) dueStatus = "overdue";
    else if (hours <= 48 && hours >= 0 && !isDone) dueStatus = "soon";
  }

  const cardTone =
    dueStatus === "overdue"
      ? "border-red-200 bg-red-50/80"
      : dueStatus === "soon"
        ? "border-amber-200 bg-amber-50/80"
        : "border-slate-200 bg-white";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isMobile,
  });

  const progressColor =
    task.status === "DONE"
      ? "bg-emerald-500"
      : task.status === "CANCELLED"
        ? "bg-red-500"
        : dueStatus === "overdue"
          ? "bg-red-500"
          : dueStatus === "soon"
            ? "bg-amber-500"
            : "bg-[#e42526]";

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : isDone ? 0.75 : 1,
      }}
      {...attributes}
      {...listeners}
      className={[
        "relative overflow-hidden rounded-[18px] border px-3 py-2.5 shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md",
        isDone
          ? "cursor-default"
          : isMobile
            ? "cursor-pointer"
            : "cursor-grab active:cursor-grabbing",
        cardTone,
      ].join(" ")}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(task);
      }}
    >
      <div className="relative">
        <div className="mb-2 flex items-start justify-between gap-2">
          <PriorityPill p={String(task.priority)} />

          <div className="flex items-center gap-1">
            {dueStatus === "overdue" && (
              <span
                className="grid h-6 w-6 place-items-center rounded-lg bg-red-100 text-red-600"
                title="Gecikib"
              >
                <AlertTriangle size={13} />
              </span>
            )}

            {dueStatus === "soon" && (
              <span
                className="grid h-6 w-6 place-items-center rounded-lg bg-amber-100 text-amber-600"
                title="Vaxt yaxınlaşır"
              >
                <Clock3 size={13} />
              </span>
            )}

            {task.comment_count ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[10px] font-black text-slate-600">
                <MessageCircle size={12} />
                {task.comment_count}
              </span>
            ) : null}

            {!isMobile && <GripVertical size={14} className="text-slate-300" />}
          </div>
        </div>

        <h4 className="line-clamp-2 text-[13px] font-black leading-5 text-slate-950">
          {task.title}
        </h4>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold text-slate-400">
            {formatDMY(task.due_date)}
          </span>

          <span
            className={[
              "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[9px] font-black uppercase tracking-wide",
              meta.header,
            ].join(" ")}
          >
            {String(task.status).replace("_", " ")}
          </span>
        </div>

        {task.start_date &&
          task.due_date &&
          task.status !== "DONE" &&
          task.status !== "CANCELLED" && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={["h-full rounded-full transition-all", progressColor].join(" ")}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

        <TaskActions
          task={task}
          isCreator={isCreator}
          moveTask={moveTask}
          updateTask={updateTask}
          t={t}
        />
      </div>
    </article>
  );
});

function TaskActions({
  task,
  isCreator,
  moveTask,
  updateTask,
  t,
}: {
  task: Task;
  isCreator: boolean;
  moveTask: (taskId: string, nextStatus: Status) => void;
  updateTask: (id: string, updates: any) => Promise<void>;
  t: any;
}) {
  if (task.status !== "DONE" && task.status !== "CANCELLED") {
    return (
      <button
        onClick={async (e) => {
          e.stopPropagation();

          let nextStatus: Status | null = null;

          if (task.status === "TODO") nextStatus = "IN_PROGRESS";
          if (task.status === "IN_PROGRESS") nextStatus = "DONE";

          if (!nextStatus) return;

          moveTask(task.id, nextStatus);
          await updateTask(task.id, { status: nextStatus });
        }}
        className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-950 text-[11px] font-black text-white transition hover:bg-[#e42526] active:scale-[0.98]"
      >
        {task.status === "TODO" && (
          <>
            <PlayCircle size={14} />
            {t.startTask}
          </>
        )}

        {task.status === "IN_PROGRESS" && (
          <>
            <CheckCircle2 size={14} />
            {t.completeTask}
          </>
        )}
      </button>
    );
  }

  if ((task.status === "DONE" || task.status === "CANCELLED") && isCreator) {
    return (
      <button
        onClick={async (e) => {
          e.stopPropagation();

          moveTask(task.id, "TODO");
          await updateTask(task.id, { status: "TODO" });
        }}
        className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-[11px] font-black text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
      >
        <RotateCcw size={14} />
        {t.reopenTask}
      </button>
    );
  }

  return null;
}