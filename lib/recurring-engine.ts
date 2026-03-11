import { createClient } from "@supabase/supabase-js";

export async function runRecurringEngine() {

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split("T")[0];

  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .lte("next_run_date", today)
    .eq("is_active", true);

  if (!rules?.length) return;

  for (const rule of rules) {

    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("recurring_rule_id", rule.id)
      .eq("start_date", rule.next_run_date)
      .limit(1);

    if (existing && existing.length > 0) continue;

    await supabase.from("tasks").insert({
      title: rule.title,
      description: rule.description,
      status: "TODO",
      priority: rule.priority ?? "MEDIUM",
      start_date: rule.next_run_date,
      due_date: rule.next_run_date,
      recurring_rule_id: rule.id,
      created_by: rule.created_by,
      company_id: rule.company_id ?? null,
      sort_index: Date.now()
    });

    const next = new Date(rule.next_run_date);

    if (rule.frequency === "DAILY") {
      next.setDate(next.getDate() + (rule.interval ?? 1));
    }

    if (rule.frequency === "WEEKLY") {
      next.setDate(next.getDate() + 7 * (rule.interval ?? 1));
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
  }
}