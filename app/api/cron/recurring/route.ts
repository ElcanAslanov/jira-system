import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ================= SECURITY ================= */

function checkCronSecret(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

/* ================= HELPERS ================= */

function todayISO() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function dateISO(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
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

  if (typeof raw === "object") {
    const one =
      raw.id || raw.user_id || raw.employee_id || raw.value || null;

    return one ? [String(one)] : [];
  }

  return [];
}

/* ================= CRON ================= */

export async function GET(request: NextRequest) {
  try {

    if (!checkCronSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = todayISO();

    console.log("CRON START");
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
      console.log("NO RULES TODAY");
      return NextResponse.json({ message: "No rules today" });
    }

    console.log("RULE COUNT:", rules.length);

    for (const rule of rules) {

      console.log("PROCESSING:", rule.title);

      /* END DATE */

      if (rule.end_date && rule.end_date < today) {

        await supabase
          .from("recurring_rules")
          .update({ is_active: false })
          .eq("id", rule.id);

        console.log("AUTO DISABLED:", rule.title);

        continue;
      }

      let next = new Date(rule.next_run_date + "T00:00:00+04:00");

      while (dateISO(next) <= today) {

        const runDate = dateISO(next);

        /* WEEKLY FILTER */

        if (rule.frequency === "WEEKLY") {

          const weekDays: number[] = rule.week_days || [];
          const dow = next.getDay();

          if (!weekDays.includes(dow)) {

            next.setDate(next.getDate() + 1);
            continue;
          }
        }

        /* DUPLICATE CHECK */

       const { data: existing } = await supabase
  .from("tasks")
  .select("id")
  .eq("recurring_rule_id", rule.id)
  .gte("start_date", runDate)
  .lt("start_date", runDate + "T23:59:59")
  .limit(1);

        let taskCreated = false;

        if (existing && existing.length > 0) {

          console.log("TASK EXISTS:", rule.title, runDate);

        } else {

          /* CREATOR */

          let creatorId = null;

          const { data: creator } = await supabase
            .from("employees")
            .select("id")
            .eq("user_id", rule.created_by)
            .maybeSingle();

          if (creator) creatorId = creator.id;

          /* CREATE TASK */

          const { data: createdTask, error: createErr } = await supabase
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

          if (createErr || !createdTask) {

            console.error("TASK CREATE ERROR:", createErr);

          } else {

            taskCreated = true;

            console.log("TASK CREATED:", createdTask.id);

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
                      task_id: createdTask.id,
                      employee_id: empId,
                    }))
                  );
              }
            }
          }
        }

        /* NEXT STEP ONLY IF TASK CREATED */

        if (taskCreated) {

          if (rule.frequency === "DAILY") {
            next.setDate(next.getDate() + (rule.interval ?? 1));
          }

          if (rule.frequency === "WEEKLY") {
            next.setDate(next.getDate() + 7 * (rule.interval ?? 1));
          }

          if (rule.frequency === "MONTHLY") {
            next.setMonth(next.getMonth() + (rule.interval ?? 1));
          }

        } else {

          break;
        }

      }

      await supabase
        .from("recurring_rules")
        .update({
          next_run_date: dateISO(next),
        })
        .eq("id", rule.id);

      console.log("NEXT UPDATED:", rule.title);

    }

    console.log("CRON FINISHED");

    return NextResponse.json({ message: "Cron success" });

  } catch (err: any) {

    console.error("CRON ERROR:", err);

    return NextResponse.json(
      { error: err.message || "Cron failed" },
      { status: 500 }
    );
  }
}