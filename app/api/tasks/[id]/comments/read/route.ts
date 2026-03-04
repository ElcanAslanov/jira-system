import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getRequestUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("Unauthorized");

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user)
    throw new Error("Unauthorized");

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id, role_id")
    .eq("user_id", authData.user.id)
    .single();

  if (!employee) throw new Error("Employee not found");

  const { data: roleRow } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", employee.role_id)
    .single();

  return {
    id: employee.id,
    role: String(roleRow?.name || "").toUpperCase(),
  };
}

/* ================= TASK ACCESS CHECK ================= */

async function checkTaskAccess(
  taskId: string,
  user: { id: string; role: string }
) {
  if (["ADMIN", "BOSS"].includes(user.role)) return true;

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("created_by")
    .eq("id", taskId)
    .single();

  if (!task) throw new Error("Task not found");

  if (user.role === "EMPLOYEE") {
    const { data: assigned } = await supabaseAdmin
      .from("task_assignees")
      .select("id")
      .eq("task_id", taskId)
      .eq("employee_id", user.id)
      .maybeSingle();

    return !!assigned;
  }

  if (user.role === "REHBER") {
    if (task.created_by === user.id) return true;

    const { data: team } = await supabaseAdmin
      .from("employee_guides")
      .select("employee_id")
      .eq("guide_id", user.id);

    const teamIds = team?.map((t) => t.employee_id) ?? [];

    const { data: assigned } = await supabaseAdmin
      .from("task_assignees")
      .select("employee_id")
      .eq("task_id", taskId);

    return assigned?.some((a) =>
      teamIds.includes(a.employee_id)
    );
  }

  return false;
}

/* ================= MARK COMMENTS AS READ ================= */

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const user = await getRequestUser(req);

    /* ===== TASK ACCESS CHECK ===== */

    const hasAccess = await checkTaskAccess(taskId, user);

   if (!hasAccess) {
  return NextResponse.json({ success: true });
}

    /* ===== GET TASK COMMENTS ===== */

    const { data: comments, error: commentError } =
      await supabaseAdmin
        .from("task_comments")
        .select("id")
        .eq("task_id", taskId);

    if (commentError) throw commentError;

    if (!comments?.length) {
      return NextResponse.json({ success: true });
    }

    /* ===== UPSERT READ RECORDS ===== */

    const inserts = comments.map((c) => ({
      task_id: taskId,
      comment_id: c.id,
      employee_id: user.id,
      read_at: new Date().toISOString(),
    }));

    const { error: upsertError } =
      await supabaseAdmin
        .from("task_comment_reads")
        .upsert(inserts, {
          onConflict: "comment_id,employee_id",
        });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error("READ ERROR:", e);

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status:
        e?.message === "Unauthorized" ? 401 : 500
      }
    );
  }
}