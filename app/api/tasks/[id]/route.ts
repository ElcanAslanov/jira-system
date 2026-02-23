import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) throw new Error("Unauthorized");

  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("id, role_id")
    .eq("user_id", authData.user.id)
    .single();

  if (empError || !employee) throw new Error("Employee not found");

  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", employee.role_id)
    .single();

  if (roleErr || !roleRow?.name) throw new Error("Role not found");

  return {
    id: employee.id, // employees.id
    role: String(roleRow.name).toUpperCase(),
  };
}

/* ================= PUT ================= */

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const taskId = params.id;
    const user = await getRequestUser(req);

    const body = await req.json().catch(() => ({}));

    const { data: task, error: taskErr } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskErr || !task) throw new Error("Task not found");

    // 🔒 DONE tapşırıqları yalnız ADMIN dəyişə bilər
    if (task.status === "DONE" && user.role !== "ADMIN") {
      throw new Error("DONE tapşırıqları yalnız ADMIN dəyişə bilər");
    }

    /* ================= PERMISSIONS ================= */

    // EMPLOYEE → yalnız özünə assign olunubsa status/sort dəyişə bilər
    if (user.role === "EMPLOYEE") {
      const { data: assigned, error: assignedErr } = await supabaseAdmin
        .from("task_assignees")
        .select("id")
        .eq("task_id", taskId)
        .eq("employee_id", user.id)
        .maybeSingle();

      if (assignedErr) throw assignedErr;
      if (!assigned) throw new Error("Permission denied");

      const { error: empUpdateErr } = await supabaseAdmin
        .from("tasks")
        .update({
          status: body.status ?? task.status,
          sort_index: body.sort_index !== undefined ? body.sort_index : task.sort_index,
        })
        .eq("id", taskId);

      if (empUpdateErr) throw empUpdateErr;

      return NextResponse.json({ success: true });
    }

    // REHBER → yalnız öz komandasına assign olunan task-lar
    if (user.role === "REHBER") {
      const { data: team, error: teamErr } = await supabaseAdmin
        .from("employee_guides")
        .select("employee_id")
        .eq("guide_id", user.id);

      if (teamErr) throw teamErr;

      const teamIds = team?.map((t) => t.employee_id) ?? [];

      const { data: assigned, error: assErr } = await supabaseAdmin
        .from("task_assignees")
        .select("employee_id")
        .eq("task_id", taskId);

      if (assErr) throw assErr;

      const hasAccess = assigned?.some((a) => teamIds.includes(a.employee_id));
      if (!hasAccess) throw new Error("Permission denied");
    }

    // ADMIN / BOSS → full access

    /* ================= UPDATE LOGIC ================= */

    const updateFields: Record<string, any> = {};

    if (body.status !== undefined) updateFields.status = body.status;
    if (body.priority !== undefined) updateFields.priority = body.priority;
    if (body.sort_index !== undefined) updateFields.sort_index = body.sort_index;
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.due_date !== undefined) updateFields.due_date = body.due_date;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from("tasks")
      .update(updateFields)
      .eq("id", taskId);

    if (updateError) throw updateError;

    /* ================= NOTIFICATION ================= */

    if (body.status && task.created_by && task.created_by !== user.id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: task.created_by,
        type: "STATUS_CHANGED",
        title: "Status changed",
        body: `Task "${task.title}" → ${body.status}`,
        task_id: taskId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("TASK UPDATE ERROR:", e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

/* ================= DELETE ================= */

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params; // 🔥 ƏSAS FIX

    if (!taskId) {
      return NextResponse.json(
        { error: "Task id missing" },
        { status: 400 }
      );
    }

    const user = await getRequestUser(req);

    if (!["ADMIN", "BOSS"].includes(user.role)) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    // Faylları sil
    const { data: files } = await supabaseAdmin
      .from("task_files")
      .select("path")
      .eq("task_id", taskId);

    if (files?.length) {
      await supabaseAdmin.storage
        .from("task-files")
        .remove(files.map(f => f.path));
    }

    await supabaseAdmin.from("task_files").delete().eq("task_id", taskId);
    await supabaseAdmin.from("task_assignees").delete().eq("task_id", taskId);
    await supabaseAdmin.from("tasks").delete().eq("id", taskId);

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error("TASK DELETE ERROR:", e);
    return NextResponse.json(
      { error: e.message },
      { status: 400 }
    );
  }
}