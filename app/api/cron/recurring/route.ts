import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ================= SECURITY ================= */

function checkCronSecret(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

/* ================= DATE HELPERS ================= */

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

/* ================= ASSIGNEE PARSER ================= */

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

/* ================= CRON ================= */

export async function GET(request: NextRequest) {

  console.log("===== CRON START =====");

  if (!checkCronSecret(request)) {
    console.log("CRON SECRET INVALID");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = todayISO();

  console.log("TODAY:", today);

  const { data: rules, error } = await supabase
    .from("recurring_rules")
    .select("*")
    .lte("next_run_date", today)
    .eq("is_active", true);

  if (error) {
    console.error("RULE FETCH ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rules || rules.length === 0) {
    console.log("NO RULES TO RUN");
    return NextResponse.json({ message: "No rules today" });
  }

  console.log("RULE COUNT:", rules.length);

  for (const rule of rules) {

    console.log("PROCESSING RULE:", rule.id, rule.title);

    if (rule.end_date && rule.end_date < today) {

      console.log("RULE EXPIRED:", rule.title);

      await supabase
        .from("recurring_rules")
        .update({ is_active: false })
        .eq("id", rule.id);

      continue;
    }

    let next = new Date(rule.next_run_date + "T00:00:00+04:00");

    while (formatDate(next) <= today) {

      const runDate = formatDate(next);

      console.log("RUN DATE:", runDate);

      /* CHECK DUPLICATE */

      const { data: existing, error: existErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("recurring_rule_id", rule.id)
        .eq("due_date", runDate)
        .maybeSingle();

      if (existErr) {
        console.error("DUPLICATE CHECK ERROR:", existErr);
      }

      if (!existing) {

        console.log("CREATING TASK FOR:", runDate);

        /* CREATOR */

        let creatorId = null;

        const { data: creator } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", rule.created_by)
          .maybeSingle();

        if (creator) creatorId = creator.id;

        /* INSERT TASK */

        const { data: task, error: insertErr } = await supabase
          .from("tasks")
          .insert({
            title: rule.title,
            description: rule.description,
            status: "TODO",
            priority: rule.priority ?? "MEDIUM",
            start_date: runDate,
            due_date: runDate,
            recurring_rule_id: rule.id,
            created_by: creatorId,
            company_id: rule.company_id ?? null,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("TASK INSERT ERROR:", insertErr);
        }

        if (task) {

          console.log("TASK CREATED:", task.id);

          /* ASSIGNEES */

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

              console.log("ASSIGNEES ADDED:", employeeIds.length);
            }
          }
        }

      } else {

        console.log("TASK ALREADY EXISTS FOR:", runDate);
      }

      /* NEXT DATE */

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

    const newNext = formatDate(next);

    console.log("UPDATING NEXT RUN:", newNext);

    await supabase
      .from("recurring_rules")
      .update({
        next_run_date: newNext,
      })
      .eq("id", rule.id);
  }

  console.log("===== CRON FINISHED =====");

  return NextResponse.json({ message: "Cron success" });

}