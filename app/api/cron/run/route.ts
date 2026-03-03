import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ================= SECURITY ================= */

function checkCronSecret(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

/* ================= HELPERS ================= */

function todayISO() {
  const bakuTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Baku" })
  );
  return bakuTime.toISOString().split("T")[0];
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
    /* 🔐 Secret check */
    if (!checkCronSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = todayISO();

    console.log("CRON START:", today);

    const { data: rules, error } = await supabase
      .from("recurring_rules")
      .select("*")
      .lte("next_run_date", today)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json({ message: "No rules due today" });
    }

    for (const rule of rules) {
      console.log("PROCESSING:", rule.title);

      /* 1️⃣ End date check */
      if (rule.end_date && rule.end_date < today) {
        await supabase
          .from("recurring_rules")
          .update({ is_active: false })
          .eq("id", rule.id);

        console.log("AUTO DEACTIVATED:", rule.title);
        continue;
      }

      /* 2️⃣ WEEKLY weekday check */
      if (rule.frequency === "WEEKLY") {
        const weekDays: number[] = rule.week_days || [];
        const checkDate = new Date(rule.next_run_date + "T00:00:00+04:00");
        const dow = checkDate.getDay();

        if (!weekDays.includes(dow)) {
          const next = new Date(rule.next_run_date + "T00:00:00+04:00");
          next.setDate(next.getDate() + 1);

          await supabase
            .from("recurring_rules")
            .update({
              next_run_date: next.toISOString().split("T")[0],
            })
            .eq("id", rule.id);

          console.log("WEEKLY SKIPPED:", rule.title);
          continue;
        }
      }

      /* 3️⃣ Duplicate protection */
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("recurring_rule_id", rule.id)
        .eq("start_date", rule.next_run_date)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log("ALREADY EXISTS:", rule.title);
        continue;
      }

      /* 4️⃣ Creator mapping */
      const { data: creator } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", rule.created_by)
        .single();

      if (!creator) {
        console.log("CREATOR NOT FOUND");
        continue;
      }

      /* 5️⃣ Create task */
      const { data: createdTask } = await supabase
        .from("tasks")
        .insert({
          title: rule.title,
          description: rule.description,
          status: "TODO",
          priority: rule.priority ?? "MEDIUM",
          start_date: rule.next_run_date,
          due_date: rule.next_run_date,
          recurring_rule_id: rule.id,
          created_by: creator.id,
          company_id: rule.company_id ?? null,
        })
        .select("id")
        .single();

      if (!createdTask) continue;

      console.log("TASK CREATED:", createdTask.id);

      /* 6️⃣ Assignees */
      const assignedIds = extractAssignedIds(rule.assigned_to);

      if (assignedIds.length > 0) {
        const { data: employees } = await supabase
          .from("employees")
          .select("id,user_id")
          .or(
            `id.in.(${assignedIds.join(",")}),user_id.in.(${assignedIds.join(
              ","
            )})`
          );

        const employeeIds =
          employees?.map((e: any) => e.id) ?? [];

        if (employeeIds.length > 0) {
          await supabase.from("task_assignees").insert(
            employeeIds.map((empId) => ({
              task_id: createdTask.id,
              employee_id: empId,
            }))
          );
        }
      }

      /* 7️⃣ Next run update */
      let next = new Date(rule.next_run_date + "T00:00:00+04:00");

      if (rule.frequency === "DAILY") {
        next.setDate(next.getDate() + (rule.interval ?? 1));
      }

      if (rule.frequency === "WEEKLY") {
        next.setDate(next.getDate() + 1);
      }

      if (rule.frequency === "MONTHLY") {
        next.setMonth(next.getMonth() + (rule.interval ?? 1));
      }

      await supabase
        .from("recurring_rules")
        .update({
          next_run_date: next.toISOString().split("T")[0],
        })
        .eq("id", rule.id);

      console.log("NEXT UPDATED:", rule.title);
    }

    return NextResponse.json({ message: "Cron success" });

  } catch (err: any) {
    console.error("CRON ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Cron failed" },
      { status: 500 }
    );
  }
}