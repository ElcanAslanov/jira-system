import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function checkCronSecret(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

function formatDate(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function todayISO() {
  return formatDate(new Date());
}

function parseDateBaku(dateStr: string) {
  return new Date(`${dateStr}T00:00:00+04:00`);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function extractAssignedIds(raw: any): string[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(raw)) return [];

  return raw
    .map((x) => {
      if (!x) return null;
      if (typeof x === "string") return x;
      if (typeof x === "object") {
        return x.id || x.user_id || x.employee_id || x.value || null;
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeWeekDays(raw: any): number[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(raw)) return [];

  const map: Record<string, number> = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  };

  return raw
    .map((x) => {
      if (typeof x === "number") return x;
      if (typeof x === "string") {
        const upper = x.trim().toUpperCase();
        if (upper in map) return map[upper];
        const asNum = Number(upper);
        if (!Number.isNaN(asNum)) return asNum;
      }
      return null;
    })
    .filter((x): x is number => x !== null && x >= 0 && x <= 6);
}

function getWeekdayBaku(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Baku",
      weekday: "short",
    })
      .format(date)
      .replace("Sun", "0")
      .replace("Mon", "1")
      .replace("Tue", "2")
      .replace("Wed", "3")
      .replace("Thu", "4")
      .replace("Fri", "5")
      .replace("Sat", "6")
  );
}

function getDayOfMonthBaku(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baku",
      day: "2-digit",
    }).format(date)
  );
}

function shouldRunDaily(ruleDate: Date, todayDate: Date, interval: number) {
  const diffMs = todayDate.getTime() - ruleDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays % interval === 0;
}

/* WEEKLY FIXED LOGIC */
function shouldRunWeekly(
  ruleStartDate: Date,
  todayDate: Date,
  interval: number,
  weekDays: number[]
) {
  if (!weekDays || weekDays.length === 0) return false;

  const weekday = getWeekdayBaku(todayDate);

  if (!weekDays.includes(weekday)) {
    return false;
  }

  if (todayDate < ruleStartDate) {
    return false;
  }

  const diffMs = todayDate.getTime() - ruleStartDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const weekIndex = Math.floor(diffDays / 7);

  return weekIndex % interval === 0;
}

function shouldRunMonthly(ruleStartDate: Date, todayDate: Date, interval: number) {
  const startYear = ruleStartDate.getFullYear();
  const startMonth = ruleStartDate.getMonth();
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth();

  const monthsDiff =
    (todayYear - startYear) * 12 + (todayMonth - startMonth);

  if (monthsDiff < 0) return false;
  if (monthsDiff % interval !== 0) return false;

  const startDay = getDayOfMonthBaku(ruleStartDate);
  const todayDay = getDayOfMonthBaku(todayDate);

  return todayDay === startDay;
}

async function getCreatorEmployeeId(supabase: any, createdByUserId: string) {
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", createdByUserId)
    .maybeSingle();

  return employee?.id ?? null;
}

async function createTaskIfMissing(
  supabase: any,
  rule: any,
  runDate: string
) {
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("recurring_rule_id", rule.id)
    .eq("due_date", runDate)
    .maybeSingle();

  if (existing) return;

  const creatorEmployeeId = await getCreatorEmployeeId(
    supabase,
    rule.created_by
  );

  if (!creatorEmployeeId) return;

  const { data: task } = await supabase
    .from("tasks")
    .insert({
      title: rule.title,
      description: rule.description ?? "",
      status: "TODO",
      priority: rule.priority ?? "MEDIUM",
      start_date: runDate,
      due_date: runDate,
      recurring_rule_id: rule.id,
      created_by: creatorEmployeeId,
      company_id: rule.company_id ?? null,
    })
    .select("id")
    .single();

  const assignedUserIds = extractAssignedIds(rule.assigned_to);

  if (!task || assignedUserIds.length === 0) return;

  const { data: employees } = await supabase
    .from("employees")
    .select("id,user_id")
    .in("user_id", assignedUserIds);

  const employeeIds = (employees ?? []).map((e: any) => e.id).filter(Boolean);

  if (employeeIds.length === 0) return;

  await supabase.from("task_assignees").insert(
    employeeIds.map((employeeId: string) => ({
      task_id: task.id,
      employee_id: employeeId,
    }))
  );
}

export async function GET(request: NextRequest) {
  if (!checkCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = todayISO();
  const todayDate = parseDateBaku(today);

  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .lte("start_date", today);

  if (!rules || rules.length === 0) {
    return NextResponse.json({ message: "No active rules" });
  }

  for (const rule of rules) {
    try {
      const interval =
        Number(rule.interval ?? 1) > 0 ? Number(rule.interval) : 1;

      const ruleStartDate = parseDateBaku(rule.start_date);

      if (rule.end_date) {
        const endDate = parseDateBaku(rule.end_date);

        if (todayDate > endDate) {
          await supabase
            .from("recurring_rules")
            .update({ is_active: false })
            .eq("id", rule.id);

          continue;
        }
      }

      let shouldRun = false;

      if (rule.frequency === "DAILY") {
        shouldRun = shouldRunDaily(ruleStartDate, todayDate, interval);
      }

      if (rule.frequency === "WEEKLY") {
        const weekDays = normalizeWeekDays(rule.week_days);
        shouldRun = shouldRunWeekly(
          ruleStartDate,
          todayDate,
          interval,
          weekDays
        );
      }

      if (rule.frequency === "MONTHLY") {
        shouldRun = shouldRunMonthly(ruleStartDate, todayDate, interval);
      }

      if (!shouldRun) continue;

      await createTaskIfMissing(supabase, rule, today);

     let nextRunDate = addDays(todayDate, 1);

if (rule.frequency === "WEEKLY") {
  const weekDays = normalizeWeekDays(rule.week_days);

  const todayWeekday = getWeekdayBaku(todayDate);

  let minDiff = 7;

  for (const d of weekDays) {
    let diff = d - todayWeekday;

    if (diff <= 0) diff += 7;

    if (diff < minDiff) {
      minDiff = diff;
    }
  }

  nextRunDate = addDays(todayDate, minDiff);
}

if (rule.frequency === "MONTHLY") {
  nextRunDate = addMonths(todayDate, interval);
}

const nextRun = formatDate(nextRunDate);

await supabase
  .from("recurring_rules")
  .update({
    next_run_date: nextRun,
  })
  .eq("id", rule.id);
    } catch (err) {
      console.error("RULE PROCESS ERROR:", rule?.id, err);
    }
  }

  return NextResponse.json({ message: "Cron success", today });
}