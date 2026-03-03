import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ================= HELPERS ================= */

function todayISO() {
  const bakuTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Baku" })
  );
  return bakuTime.toISOString().split("T")[0];
}

function extractAssignedIds(raw: any): string[] {
  if (!raw) return [];

  // JSONB gələndə string kimi də gələ bilər
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

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = todayISO();

    console.log("=================================");
    console.log("CRON START:", today);
    console.log("=================================");

    /* 1️⃣ Due rule-ları tap */
    const { data: rules, error: ruleError } = await supabase
      .from("recurring_rules")
      .select("*")
      .lte("next_run_date", today)
      .eq("is_active", true);

    if (ruleError) {
      console.log("RULE FETCH ERROR:", ruleError);
      return NextResponse.json(
        { error: ruleError.message },
        { status: 500 }
      );
    }

    if (!rules || rules.length === 0) {
      console.log("NO RULES DUE");
      return NextResponse.json({ message: "No rules due today" });
    }

    console.log("RULE COUNT:", rules.length);

    for (const rule of rules) {
      console.log("PROCESSING RULE:", rule.title);

      /* 2️⃣ End date keçibsə skip */
     if (rule.end_date && rule.end_date < today) {
  await supabase
    .from("recurring_rules")
    .update({ is_active: false })
    .eq("id", rule.id);

  console.log("RULE AUTO-DEACTIVATED:", rule.title);
  continue;
}

      /* 3️⃣ Duplicate protection */
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("recurring_rule_id", rule.id)
        .eq("start_date", rule.next_run_date)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log("TASK ALREADY EXISTS:", rule.title);
        continue;
      }

      /* 4️⃣ created_by auth → employee */
      const { data: creator } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", rule.created_by)
        .single();

      if (!creator) {
        console.log("CREATOR NOT FOUND:", rule.created_by);
        continue;
      }

      /* 5️⃣ Task insert (id qaytarırıq) */
      const { data: createdTask, error: insertError } = await supabase
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

      if (insertError || !createdTask) {
        console.log("TASK INSERT ERROR:", insertError);
        continue;
      }

      console.log("TASK CREATED:", createdTask.id);

      /* 6️⃣ ASSIGNEES əlavə et */
      const assignedIds = extractAssignedIds(rule.assigned_to);

      let employeeIds: string[] = [];

      if (assignedIds.length > 0) {
        // əvvəl employee.id kimi yoxla
        const { data: byEmp } = await supabase
          .from("employees")
          .select("id")
          .in("id", assignedIds);

        if (byEmp && byEmp.length > 0) {
          employeeIds = byEmp.map((e: any) => e.id);
        }

        // əgər tapılmadısa auth user_id kimi yoxla
        if (employeeIds.length === 0) {
          const { data: byUser } = await supabase
            .from("employees")
            .select("id,user_id")
            .in("user_id", assignedIds);

          if (byUser && byUser.length > 0) {
            employeeIds = byUser.map((e: any) => e.id);
          }
        }
      }

      if (employeeIds.length > 0) {
        const assigneeRows = employeeIds.map((empId) => ({
          task_id: createdTask.id,
          employee_id: empId,
        }));

        const { error: assErr } = await supabase
          .from("task_assignees")
          .insert(assigneeRows);

        if (assErr) {
          console.log("ASSIGNEE INSERT ERROR:", assErr);
        } else {
          console.log("ASSIGNEES ADDED:", employeeIds.length);
        }
      }

      /* 7️⃣ Next run date hesabla */
      let next = new Date(rule.next_run_date + "T00:00:00+04:00");
      let safetyCounter = 0;

      while (
        next.toISOString().split("T")[0] <= today &&
        safetyCounter < 365
      ) {
        if (rule.frequency === "DAILY") {
          next.setDate(next.getDate() + rule.interval);
        }

        if (rule.frequency === "WEEKLY") {
          next.setDate(next.getDate() + 7 * rule.interval);
        }

        if (rule.frequency === "MONTHLY") {
          next.setMonth(next.getMonth() + rule.interval);
        }

        safetyCounter++;
      }

      const nextDate = next.toISOString().split("T")[0];

      await supabase
        .from("recurring_rules")
        .update({ next_run_date: nextDate })
        .eq("id", rule.id);

      console.log("NEXT RUN UPDATED:", nextDate);
    }

    console.log("CRON FINISHED");
    console.log("=================================");

    return NextResponse.json({
      message: "Cron executed successfully",
    });
  } catch (err: any) {
    console.log("CRON FATAL ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Cron failed" },
      { status: 500 }
    );
  }
}