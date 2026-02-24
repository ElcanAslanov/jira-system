import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split("T")[0];

    console.log("=================================");
    console.log("CRON START:", today);
    console.log("RAW DATE:", new Date());
    console.log("ISO DATE:", new Date().toISOString());
    console.log("=================================");

    // 1️⃣ Due rule-ları tap
    const { data: rules, error: ruleError } = await supabase
      .from("recurring_rules")
      .select("*")
      .lte("next_run_date", today)
      .eq("is_active", true);

    if (ruleError) {
      console.log("RULE FETCH ERROR:", ruleError);
      return NextResponse.json(
        { error: "Rule fetch error" },
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

      // 2️⃣ End date keçibsə skip
      if (rule.end_date && rule.end_date < today) {
        console.log("RULE ENDED, SKIPPED:", rule.title);
        continue;
      }

      // 3️⃣ Duplicate protection
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

      // 4️⃣ Auth ID → Employee ID mapping
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", rule.created_by)
        .single();

      if (empError || !employee) {
        console.log(
          "EMPLOYEE NOT FOUND FOR AUTH ID:",
          rule.created_by
        );
        continue;
      }

      // 5️⃣ Task insert
      const { error: insertError } = await supabase
        .from("tasks")
        .insert({
          title: rule.title,
          description: rule.description,
          status: "TODO",
          priority: rule.priority ?? "MEDIUM",
          start_date: rule.next_run_date,
          due_date: rule.next_run_date,
          recurring_rule_id: rule.id,
          created_by: employee.id, // ✅ DÜZGÜN employee id
          company_id: rule.company_id ?? null,
        });

      if (insertError) {
        console.log("TASK INSERT ERROR:", insertError);
        continue;
      }

      console.log("TASK CREATED FOR RULE:", rule.title);

      // 6️⃣ Növbəti tarix hesabla (catch-up logic)
      let next = new Date(rule.next_run_date);
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

      // 7️⃣ next_run_date update
      const { error: updateError } = await supabase
        .from("recurring_rules")
        .update({ next_run_date: nextDate })
        .eq("id", rule.id);

      if (updateError) {
        console.log("NEXT DATE UPDATE ERROR:", updateError);
      } else {
        console.log("NEXT RUN DATE UPDATED:", nextDate);
      }
    }

    console.log("CRON FINISHED");
    console.log("=================================");

    return NextResponse.json({
      message: "Cron executed successfully",
    });
  } catch (err) {
    console.log("CRON FATAL ERROR:", err);
    return NextResponse.json(
      { error: "Cron failed" },
      { status: 500 }
    );
  }
}