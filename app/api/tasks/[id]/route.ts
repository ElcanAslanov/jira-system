import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNotificationEmail } from "@/lib/sendEmail";

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

  if (roleErr) throw roleErr;

  // ===== ROLE PERMS =====
  const { data: rolePerms, error: rolePermErr } = await supabaseAdmin
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", employee.role_id);

  if (rolePermErr) throw rolePermErr;

  // ===== USER OVERRIDES (EXTRA/DENY) =====
  const { data: userPerms, error: userPermErr } = await supabaseAdmin
    .from("user_permissions")
    .select("permission_key, allowed")
    .eq("user_id", employee.id);

  if (userPermErr) throw userPermErr;

  let permissions = rolePerms?.map((p: any) => p.permission_key) ?? [];

  if (userPerms?.length) {
    userPerms.forEach((p: any) => {
      if (p.allowed === true && !permissions.includes(p.permission_key)) {
        permissions.push(p.permission_key);
      }
      if (p.allowed === false) {
        permissions = permissions.filter((k) => k !== p.permission_key);
      }
    });
  }

  return {
    id: employee.id,
    role_id: employee.role_id,
    role: String(roleRow?.name || "").toUpperCase(),
    permissions,
  };
}

function hasAnyPermission(user: { permissions: string[] }, keys: string[]) {
  return keys.some((k) => user.permissions.includes(k));
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

    const { data: task, error: taskErr } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskErr) throw taskErr;
    if (!task) throw new Error("Task not found");

   // ===== STATUS CHANGE icazəsi =====
const isStatusUpdate = body.status !== undefined;

if (!isStatusUpdate) {
  const canEdit =
    ["ADMIN", "BOSS"].includes(user.role) ||
    hasAnyPermission(user, ["tasks.edit.list", "tasks.edit.drawer"]);

  if (!canEdit) {
    return NextResponse.json(
      { error: "Permission denied (edit)" },
      { status: 403 }
    );
  }
}

    // DONE only ADMIN can change
    if (task.status === "DONE" && body.status === "TODO") {
  const { data: assignees } = await supabaseAdmin
    .from("task_assignees")
    .select("employee_id")
    .eq("task_id", taskId);

  const assignedIds = assignees?.map(a => a.employee_id) ?? [];
  const isAssigned = assignedIds.includes(user.id);
  const isCreator = task.created_by === user.id;
  const isRehber = user.role === "REHBER";

  const canReopen =
    user.role === "ADMIN" ||
    isRehber ||
    (isCreator && !isAssigned);

  if (!canReopen) {
    return NextResponse.json(
      { error: "Reopen icazəniz yoxdur" },
      { status: 403 }
    );
  }
}

    /* ================= EMPLOYEE ================= */
    // EMPLOYEE: only if assigned
   if (user.role === "EMPLOYEE") {
  const { data: assigned, error: asgErr } = await supabaseAdmin
    .from("task_assignees")
    .select("id")
    .eq("task_id", taskId)
    .eq("employee_id", user.id)
    .maybeSingle();

  if (asgErr) throw asgErr;
  if (!assigned) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const newStatus = body.status ?? task.status;

  const { error: upErr } = await supabaseAdmin
    .from("tasks")
    .update({
      status: newStatus,
      sort_index:
        body.sort_index !== undefined ? body.sort_index : task.sort_index,
      updated_by: user.id,
    })
    .eq("id", taskId);

  if (upErr) throw upErr;

  // ================= EMAIL BURDA OLMALIDIR =================

  if (body.status) {
    console.log("🔥 EMPLOYEE STATUS BLOCK WORKED");

    const { data: creatorData } = await supabaseAdmin
      .from("employees")
      .select("email, ad, soyad")
      .eq("id", task.created_by)
      .single();

    console.log("CREATOR:", creatorData);

    if (creatorData?.email) {
      const { data: currentUser } = await supabaseAdmin
        .from("employees")
        .select("ad, soyad")
        .eq("id", user.id)
        .single();

      const changerName = currentUser
        ? `${currentUser.ad ?? ""} ${currentUser.soyad ?? ""}`.trim()
        : "User";

      console.log("📨 SENDING EMAIL (EMPLOYEE)");

      await sendNotificationEmail({
        to: creatorData.email,
        taskTitle: task.title,
        assignedBy: changerName,
        taskId: taskId,
        type: "status_update",
        status: body.status,
      });

      console.log("✅ EMAIL SENT (EMPLOYEE)");
    }
  }

  return NextResponse.json({ success: true });
}

    /* ================= REHBER ================= */
    // REHBER: must have access to team task or own-created
    if (user.role === "REHBER") {
      const { data: team, error: teamErr } = await supabaseAdmin
        .from("employee_guides")
        .select("employee_id")
        .eq("guide_id", user.id);

      if (teamErr) throw teamErr;

      const teamIds = team?.map((t) => t.employee_id) ?? [];

      const { data: assigned, error: assignedErr } = await supabaseAdmin
        .from("task_assignees")
        .select("employee_id")
        .eq("task_id", taskId);

      if (assignedErr) throw assignedErr;

      const hasAccess =
        task.created_by === user.id ||
        assigned?.some((a) => teamIds.includes(a.employee_id));

      if (!hasAccess) {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }
    }

    /* ================= ADMIN / BOSS / REHBER (allowed) ================= */

    const updateFields: Record<string, any> = {};

    if (body.status !== undefined) updateFields.status = body.status;
    if (body.priority !== undefined) updateFields.priority = body.priority;
    if (body.sort_index !== undefined) updateFields.sort_index = body.sort_index;
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.due_date !== undefined) updateFields.due_date = body.due_date;
    if (body.start_date !== undefined) updateFields.start_date = body.start_date;

   if (Object.keys(updateFields).length > 0) {

  updateFields.updated_by = user.id;

  const { error: upErr } = await supabaseAdmin
    .from("tasks")
    .update(updateFields)
    .eq("id", taskId);

  if (upErr) throw upErr;
}

    /* ================= STATUS CHANGE NOTIF ================= */
if (body.status) {

  console.log("🔥 STATUS BLOCK WORKED");
  console.log("OLD STATUS:", task.status);
  console.log("NEW STATUS:", body.status);

  const { data: assignees, error: asgErr } = await supabaseAdmin
    .from("task_assignees")
    .select("employee_id")
    .eq("task_id", taskId);

  if (asgErr) throw asgErr;

  // ===== EMAIL DEBUG =====
  console.log("📧 TRYING TO SEND EMAIL");

  const { data: creatorData } = await supabaseAdmin
    .from("employees")
    .select("email, ad, soyad")
    .eq("id", task.created_by)
    .single();

  console.log("👤 CREATOR DATA:", creatorData);

  if (creatorData?.email) {
    const { data: currentUser } = await supabaseAdmin
      .from("employees")
      .select("ad, soyad")
      .eq("id", user.id)
      .single();

    const changerName = currentUser
      ? `${currentUser.ad ?? ""} ${currentUser.soyad ?? ""}`.trim()
      : "User";

    console.log("📨 SENDING EMAIL TO:", creatorData.email);

    await sendNotificationEmail({
      to: creatorData.email,
      taskTitle: task.title,
      assignedBy: changerName,
      taskId: taskId,
      type: "status_update",
      status: body.status,
    });

    console.log("✅ EMAIL SENT (STATUS)");
  }
}

    /* ================= ASSIGN CHANGE ================= */
    if (body.assigned_ids) {
      const { data: oldRows, error: oldErr } = await supabaseAdmin
        .from("task_assignees")
        .select("employee_id")
        .eq("task_id", taskId);

      if (oldErr) throw oldErr;

      const oldIds = oldRows?.map((r) => r.employee_id) ?? [];
      const newIds: string[] = Array.isArray(body.assigned_ids) ? body.assigned_ids : [];

      const added = newIds.filter((id) => !oldIds.includes(id));

      // delete old
      const { error: delErr } = await supabaseAdmin
        .from("task_assignees")
        .delete()
        .eq("task_id", taskId);

      if (delErr) throw delErr;

      // insert new
      if (newIds.length) {
        const { error: insErr } = await supabaseAdmin.from("task_assignees").insert(
          newIds.map((empId) => ({
            task_id: taskId,
            employee_id: empId,
          }))
        );
        if (insErr) throw insErr;
      }

      // notify only added
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
      { status: e?.message?.includes("Unauthorized") ? 401 : 400 }
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

    const { data: task, error: taskErr } = await supabaseAdmin
      .from("tasks")
      .select("id, created_by")
      .eq("id", taskId)
      .single();

    if (taskErr) throw taskErr;
    if (!task) throw new Error("Task not found");

    // ===== PERMISSION CHECK (DELETE) =====
    const canDelete =
      ["ADMIN", "BOSS"].includes(user.role) ||
      hasAnyPermission(user, ["tasks.delete.list", "tasks.delete.drawer"]);

    if (!canDelete) {
      return NextResponse.json(
        { error: "Permission denied (delete)" },
        { status: 403 }
      );
    }

    // EMPLOYEE cannot delete
    if (user.role === "EMPLOYEE") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Optional: REHBER only team or own-created
    if (user.role === "REHBER") {
      const { data: team, error: teamErr } = await supabaseAdmin
        .from("employee_guides")
        .select("employee_id")
        .eq("guide_id", user.id);

      if (teamErr) throw teamErr;

      const teamIds = team?.map((t) => t.employee_id) ?? [];

      const { data: assigned, error: asgErr } = await supabaseAdmin
        .from("task_assignees")
        .select("employee_id")
        .eq("task_id", taskId);

      if (asgErr) throw asgErr;

      const hasAccess =
        task.created_by === user.id ||
        assigned?.some((a) => teamIds.includes(a.employee_id));

      if (!hasAccess) {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }
    }

    // 1) delete assignees
    await supabaseAdmin.from("task_assignees").delete().eq("task_id", taskId);

    // 2) delete notifications related to task
    await supabaseAdmin.from("notifications").delete().eq("task_id", taskId);

    // 3) delete task
    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", taskId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("TASK DELETE ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: e?.message?.includes("Unauthorized") ? 401 : 400 }
    );
  }
}