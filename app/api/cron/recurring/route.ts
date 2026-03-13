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

function extractAssignedIds(raw: any): string[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (!x) return null;
        if (typeof x === "string") return x;
        if (typeof x === "object")
          return x.id || x.user_id || x.employee_id || x.value || null;
        return null;
      })
      .filter(Boolean);
  }

  return [];
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

  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .lte("next_run_date", today)
    .eq("is_active", true);

  if (!rules || rules.length === 0) {
    return NextResponse.json({ message: "No rules today" });
  }

  for (const rule of rules) {

    let next = new Date(rule.next_run_date + "T00:00:00+04:00");

    while (formatDate(next) <= today) {

      const runDate = formatDate(next);

      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("recurring_rule_id", rule.id)
        .eq("due_date", runDate)
        .maybeSingle();

      if (!existing) {

        /* EMPLOYEE ID TAP */

        const { data: creator } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", rule.created_by)
          .maybeSingle();

        if (!creator) {
          console.log("EMPLOYEE NOT FOUND FOR USER", rule.created_by);
          break;
        }

        const { data: task } = await supabase
          .from("tasks")
          .insert({
            title: rule.title,
            description: rule.description,
            status: "TODO",
            priority: rule.priority ?? "MEDIUM",
            start_date: runDate,
            due_date: runDate,
            recurring_rule_id: rule.id,
            created_by: creator.id,
            company_id: rule.company_id ?? null,
          })
          .select("id")
          .single();

        if (task) {

          const assignedIds = extractAssignedIds(rule.assigned_to);

          if (assignedIds.length > 0) {

            const { data: employees } = await supabase
              .from("employees")
              .select("id,user_id")
              .in("user_id", assignedIds);

            const employeeIds = employees?.map((e) => e.id) ?? [];

            if (employeeIds.length > 0) {

              await supabase
                .from("task_assignees")
                .insert(
                  employeeIds.map((empId) => ({
                    task_id: task.id,
                    employee_id: empId,
                  }))
                );
            }
          }
        }
      }

      if (rule.frequency === "DAILY") {
        next.setDate(next.getDate() + (rule.interval ?? 1));
      }

      if (rule.frequency === "WEEKLY") {
        next.setDate(next.getDate() + 7 * (rule.interval ?? 1));
      }

      if (rule.frequency === "MONTHLY") {
        next.setMonth(next.getMonth() + (rule.interval ?? 1));
      }

    }

    await supabase
      .from("recurring_rules")
      .update({
        next_run_date: formatDate(next),
      })
      .eq("id", rule.id);
  }

  return NextResponse.json({ message: "Cron success" });
}