import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getRequestUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user)
    throw new Error("Unauthorized");

  const { data: employee, error: empError } =
    await supabaseAdmin
      .from("employees")
      .select("id, role_id")
      .eq("user_id", authData.user.id)
      .single();

  if (empError || !employee)
    throw new Error("Employee not found");

  const { data: roleRow } =
    await supabaseAdmin
      .from("roles")
      .select("name")
      .eq("id", employee.role_id)
      .single();

  return {
    id: employee.id,
    role: String(roleRow?.name || "").toUpperCase(),
  };
}

/* ================= PUT ================= */

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const user = await getRequestUser(request);
    const body = await request.json().catch(() => ({}));

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (!task) throw new Error("Task not found");

    if (task.status === "DONE" && user.role !== "ADMIN") {
      throw new Error("DONE tapşırıqları yalnız ADMIN dəyişə bilər");
    }

    /* ================= EMPLOYEE ================= */

    if (user.role === "EMPLOYEE") {
      const { data: assigned } = await supabaseAdmin
        .from("task_assignees")
        .select("id")
        .eq("task_id", taskId)
        .eq("employee_id", user.id)
        .maybeSingle();

      if (!assigned) throw new Error("Permission denied");

      const newStatus = body.status ?? task.status;

      await supabaseAdmin
        .from("tasks")
        .update({
          status: newStatus,
          sort_index:
            body.sort_index !== undefined
              ? body.sort_index
              : task.sort_index,
        })
        .eq("id", taskId);

      // Creator-a notification (özündən fərqlidirsə)
      if (newStatus !== task.status && task.created_by !== user.id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: task.created_by,
          type: "TASK_STATUS_CHANGED",
          title: "Task status dəyişdi",
          body: `Task "${task.title}" → ${newStatus}`,
          task_id: taskId,
        });
      }

      return NextResponse.json({ success: true });
    }

    /* ================= REHBER ================= */

    if (user.role === "REHBER") {
      const { data: team } = await supabaseAdmin
        .from("employee_guides")
        .select("employee_id")
        .eq("guide_id", user.id);

      const teamIds = team?.map((t) => t.employee_id) ?? [];

      const { data: assigned } = await supabaseAdmin
        .from("task_assignees")
        .select("employee_id")
        .eq("task_id", taskId);

      const hasAccess = assigned?.some((a) =>
        teamIds.includes(a.employee_id)
      );

      if (!hasAccess) throw new Error("Permission denied");
    }

    /* ================= ADMIN / BOSS ================= */

    const updateFields: Record<string, any> = {};

    if (body.status !== undefined)
      updateFields.status = body.status;
    if (body.priority !== undefined)
      updateFields.priority = body.priority;
    if (body.sort_index !== undefined)
      updateFields.sort_index = body.sort_index;
    if (body.title !== undefined)
      updateFields.title = body.title;
    if (body.description !== undefined)
      updateFields.description = body.description;
    if (body.due_date !== undefined)
      updateFields.due_date = body.due_date;

    if (Object.keys(updateFields).length > 0) {
      await supabaseAdmin
        .from("tasks")
        .update(updateFields)
        .eq("id", taskId);
    }

    /* ================= STATUS CHANGE ================= */

    if (body.status && body.status !== task.status) {
      const { data: assignees } = await supabaseAdmin
        .from("task_assignees")
        .select("employee_id")
        .eq("task_id", taskId);

      if (assignees?.length) {
        await supabaseAdmin.from("notifications").insert(
          assignees
            .filter((a) => a.employee_id !== user.id)
            .map((a) => ({
              user_id: a.employee_id,
              type: "TASK_STATUS_CHANGED",
              title: "Task status dəyişdi",
              body: `Task "${task.title}" → ${body.status}`,
              task_id: taskId,
            }))
        );
      }
    }

    /* ================= ASSIGN CHANGE ================= */

    if (body.assigned_ids) {
      const { data: oldRows } = await supabaseAdmin
        .from("task_assignees")
        .select("employee_id")
        .eq("task_id", taskId);

      const oldIds = oldRows?.map((r) => r.employee_id) ?? [];
      const newIds: string[] = body.assigned_ids;

      const added = newIds.filter((id) => !oldIds.includes(id));

      // əvvəl köhnələri sil
      await supabaseAdmin
        .from("task_assignees")
        .delete()
        .eq("task_id", taskId);

      // yeniləri insert et
      await supabaseAdmin.from("task_assignees").insert(
        newIds.map((empId) => ({
          task_id: taskId,
          employee_id: empId,
        }))
      );

      // yalnız əlavə olunanlara notification
      if (added.length > 0) {
        await supabaseAdmin.from("notifications").insert(
          added
            .filter((id) => id !== user.id)
            .map((empId) => ({
              user_id: empId,
              type: "TASK_ASSIGNED",
              title: "Yeni tapşırıq",
              body: `Sizə "${task.title}" tapşırıldı`,
              task_id: taskId,
            }))
        );
      }
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error("TASK UPDATE ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 400 }
    );
  }
}

/* ================= DELETE ================= */

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const user = await getRequestUser(request);

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("id, created_by")
      .eq("id", taskId)
      .single();

    if (!task) throw new Error("Task not found");

    // 🔒 EMPLOYEE yalnız öz taskını silə bilməsin
    if (user.role === "EMPLOYEE") {
      throw new Error("Permission denied");
    }

    // 🔒 REHBER yalnız komandasının taskını silə bilər (istəsən əlavə edə bilərik)

    // 1️⃣ əvvəl assignees sil
    await supabaseAdmin
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId);

    // 2️⃣ notification sil (istəyə görə)
    await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("task_id", taskId);

    // 3️⃣ task sil
    const { error } = await supabaseAdmin
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error("TASK DELETE ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 400 }
    );
  }
}