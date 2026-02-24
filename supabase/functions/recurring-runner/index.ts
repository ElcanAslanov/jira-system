import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Rule = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  assigned_to: string | null;
  created_by: string | null;

  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | string;
  interval: number | null;

  start_date: string;
  end_date: string;
  next_run_date: string;

  is_active: boolean;
};

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);

  while (d.getUTCDate() !== day) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

serve(async () => {
  const supabase = createClient(
  Deno.env.get("PROJECT_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

  const today = new Date().toISOString().slice(0, 10);

  const { data: rules, error } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_date", today);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!rules?.length) {
    return new Response("No rules due");
  }

  for (const r0 of rules as Rule[]) {
    const interval = Math.max(1, Number(r0.interval ?? 1));

    // end_date keçibsə stop
    if (r0.next_run_date > r0.end_date) {
      await supabase.from("recurring_rules").update({ is_active: false }).eq("id", r0.id);
      continue;
    }

    // ✅ Yeni task yarat
await supabase.from("tasks").insert({
  title: r0.title,
  description: r0.description ?? "",
  priority: r0.priority ?? "MEDIUM",
  status: "TODO",
  start_date: r0.next_run_date,
  due_date: null,
  assigned_to: null, // artıq multi olduğu üçün task-da ayrıca relation varsa dəyişərik
  created_by: r0.created_by,
  recurring_rule_id: r0.id,
  files: r0.files ?? [],
  sort_index: Date.now()
});

if (insertError) {
  return new Response(
    JSON.stringify({ insertError }),
    { status: 500 }
  );
}

    // ✅ Növbəti tarix
    let next = r0.next_run_date;
    if (r0.frequency === "DAILY") next = addDaysISO(next, 1 * interval);
    else if (r0.frequency === "WEEKLY") next = addDaysISO(next, 7 * interval);
    else if (r0.frequency === "MONTHLY") next = addMonthsISO(next, 1 * interval);
    else next = addDaysISO(next, 7 * interval);

    const willBeActive = next <= r0.end_date;

    await supabase
      .from("recurring_rules")
      .update({ next_run_date: next, is_active: willBeActive })
      .eq("id", r0.id);
  }

  return new Response(`Processed ${rules.length} rules`);
});