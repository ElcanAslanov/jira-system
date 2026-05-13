import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNotificationEmail } from "@/lib/sendEmail";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  const headerUserId = req.headers.get("x-user-id");
  const headerRole = req.headers.get("x-user-role");

  if (
    process.env.NODE_ENV !== "production" &&
    !authHeader &&
    headerUserId
  ) {
    return {
      id: headerUserId,
      role: headerRole ?? null,
    };
  }

  if (!authHeader) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user) throw new Error("Unauthorized");

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select(`id, roles(name)`)
    .eq("user_id", authData.user.id)
    .single();

  if (employeeError || !employee) {
    throw new Error("Employee not found");
  }

  const role = Array.isArray(employee.roles)
    ? employee.roles[0]?.name ?? null
    : (employee.roles as any)?.name ?? null;

  return {
    id: employee.id,
    role,
  };
}

/* ================= GET TASKS ================= */

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const isDeleted = searchParams.get("deleted") === "true";

    let tasks: any[] = [];

    const baseSelect = `
      id,
      title,
      description,
      status,
      priority,
      start_date,
      due_date,
      comments_enabled,
      sort_index,
      created_at,
      updated_at,
      created_by,
      updated_by,
      deleted_at,
      deleted_by,

      creator:employees!tasks_created_by_fkey (
        ad,
        soyad
      ),

      updater:employees!tasks_updated_by_fkey (
        ad,
        soyad
      ),

      deleter:employees!tasks_deleted_by_fkey (
        ad,
        soyad
      )
    `;

    /* ================= ADMIN / BOSS ================= */

    if (["ADMIN", "BOSS"].includes(user.role ?? "")) {
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select(baseSelect)
        .eq("is_deleted", isDeleted)
        .order("sort_index");

      if (error) throw error;
      tasks = data ?? [];
    }

    /* ================= REHBER / EMPLOYEE ================= */

    else if (user.role === "REHBER" || user.role === "EMPLOYEE") {
      const { data: assignedRows } = await supabaseAdmin
        .from("task_assignees")
        .select("task_id")
        .eq("employee_id", user.id);

      const assignedTaskIds = assignedRows?.map((r) => r.task_id) ?? [];

      const { data: createdRows } = await supabaseAdmin
        .from("tasks")
        .select("id")
        .eq("created_by", user.id)
        .eq("is_deleted", isDeleted);

      const createdTaskIds = createdRows?.map((r) => r.id) ?? [];

      const uniqueTaskIds = [...new Set([...assignedTaskIds, ...createdTaskIds])];

      if (!uniqueTaskIds.length) {
        return NextResponse.json({ tasks: [] });
      }

      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select(baseSelect)
        .in("id", uniqueTaskIds)
        .eq("is_deleted", isDeleted)
        .order("sort_index");

      if (error) throw error;

      tasks = data ?? [];
    }

    if (!tasks.length) {
      return NextResponse.json({ tasks: [] });
    }

    const taskIds = tasks.map((t) => t.id);
    const deleterIds = tasks.map((t) => t.deleted_by).filter(Boolean);

    const { data: deleters } = deleterIds.length
      ? await supabaseAdmin
          .from("employees")
          .select("id, ad, soyad")
          .in("id", deleterIds)
      : { data: [] as any[] };

    /* ===== COMMENT + READ DATA ===== */

    const { data: comments } = await supabaseAdmin
      .from("task_comments")
      .select(
        `
        id,
        task_id,
        author_id,
        task_comment_reads (
          employee_id
        )
      `
      )
      .in("task_id", taskIds);

    const unreadMap: Record<string, number> = {};

    comments?.forEach((c) => {
      if (c.author_id === user.id) return;

      const alreadyRead = c.task_comment_reads?.some(
        (r: any) => r.employee_id === user.id
      );

      if (!alreadyRead) {
        unreadMap[c.task_id] = (unreadMap[c.task_id] || 0) + 1;
      }
    });

    /* ===== ASSIGNEES ===== */

    const { data: assignees } = await supabaseAdmin
      .from("task_assignees")
      .select(
        `
        task_id,
        employee_id,
        employees (
          ad,
          soyad
        )
      `
      )
      .in("task_id", taskIds);

    /* ===== FILES ===== */

    const { data: taskFiles } = await supabaseAdmin
      .from("task_files")
      .select("task_id, original_name, path, size_bytes")
      .in("task_id", taskIds);

    const filesMap: Record<string, any[]> = {};

    (taskFiles ?? []).forEach((f) => {
      if (!filesMap[f.task_id]) filesMap[f.task_id] = [];

      filesMap[f.task_id].push({
        name: f.original_name,
        path: f.path,
        size: f.size_bytes ?? 0,
      });
    });

    const finalTasks = tasks.map((task) => {
      const relatedAssignees =
        assignees?.filter((a) => a.task_id === task.id) ?? [];

      const updater = Array.isArray(task.updater)
        ? task.updater[0]
        : task.updater;

      const updatedByName = updater
        ? `${updater.ad ?? ""} ${updater.soyad ?? ""}`.trim()
        : null;

      const names: string[] = relatedAssignees
        .map((r) => {
          const emp = Array.isArray(r.employees)
            ? r.employees[0]
            : r.employees;

          if (!emp) return null;

          return `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim();
        })
        .filter(Boolean) as string[];

      const deleter = deleters?.find((d) => d.id === task.deleted_by);

      const relatedFiles = filesMap[task.id] ?? [];
      const commentCount = unreadMap[task.id] ?? 0;

      const creator = Array.isArray(task.creator)
        ? task.creator[0]
        : task.creator;

      const creatorName = creator
        ? `${creator.ad ?? ""} ${creator.soyad ?? ""}`.trim()
        : null;

      return {
        ...task,
        creator_name: creatorName,
        updated_by_name: updatedByName,
        comment_count: commentCount,

        // UI üçün adlar
        assigned_to: names,

        // Backend üçün employee UUID-lər
        assigned_ids: relatedAssignees.map((r) => r.employee_id),

        files: relatedFiles,
        deleter,
      };
    });

    return NextResponse.json({ tasks: finalTasks });
  } catch (e: any) {
    console.error("TASKS GET ERROR:", e);

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 401 }
    );
  }
}

/* ================= CREATE TASK ================= */

export async function POST(req: Request) {
  try {
    const user = await getRequestUser(req);

    const formData = await req.formData();

    const title = formData.get("title")?.toString() || "";
    const description = formData.get("description")?.toString() || "";
    const priority = formData.get("priority")?.toString() || "MEDIUM";
    const start_date = formData.get("start_date")?.toString() || null;
    const due_date = formData.get("due_date")?.toString() || null;

    const assignedIds: string[] = [];

    formData.forEach((value, key) => {
      if (key === "assigned_to[]") {
        assignedIds.push(value.toString());
      }
    });

    const comments_enabled = formData.get("comments_enabled") !== "false";
    const files = formData.getAll("files") as File[];

    if (!title) throw new Error("Title required");
    if (!assignedIds.length) throw new Error("Assigned required");

    const uniqueAssignedIds = [...new Set(assignedIds)].filter(Boolean);

    /* ===== CREATE TASK ===== */

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        title,
        description,
        priority,
        start_date,
        due_date,
        comments_enabled,
        created_by: user.id,
        status: "TODO",
        sort_index: Date.now(),
      })
      .select()
      .single();

    if (error || !task) throw error || new Error("Task create failed");

    /* ===== INSERT ASSIGNEES ===== */

    await supabaseAdmin.from("task_assignees").insert(
      uniqueAssignedIds.map((empId) => ({
        task_id: task.id,
        employee_id: empId,
      }))
    );

    /* ===== EMAIL DATA ===== */
    /* Bu hissə həm email, həm də bell notification mətnində istifadə olunur. */

    const { data: currentUser } = await supabaseAdmin
      .from("employees")
      .select("ad, soyad")
      .eq("id", user.id)
      .single();

    const assignedByName = currentUser
      ? `${currentUser.ad ?? ""} ${currentUser.soyad ?? ""}`.trim()
      : "Admin";

    /* ===== SYSTEM NOTIFICATION: NEW TASK ===== */
    /* Mail sisteminə toxunmur. Sadəcə daxili bell notification yaradır. */

    const notifyAssignedIds = uniqueAssignedIds.filter(
      (empId) => empId !== user.id
    );

    if (notifyAssignedIds.length > 0) {
      const { error: notificationError } = await supabaseAdmin
        .from("notifications")
        .insert(
          notifyAssignedIds.map((empId) => ({
            user_id: empId, // employees.id
            type: "TASK_ASSIGNED",
            title: "Yeni tapşırıq",
            body: `${assignedByName} sizə "${title}" tapşırığını təyin etdi`,
            task_id: task.id,
            is_read: false,
          }))
        );

      if (notificationError) {
        console.error("TASK CREATE NOTIFICATION ERROR:", notificationError);
      }
    }

    /* ===== EMAIL GÖNDƏR ===== */
    /* Bu blok saxlanılıb, mail sisteminə toxunulmayıb. */

    const { data: users } = await supabaseAdmin
      .from("employees")
      .select("id, email")
      .in("id", uniqueAssignedIds);

    void Promise.all(
      (users || []).map((u) => {
        if (!u.email) return Promise.resolve();

        return sendNotificationEmail({
          to: u.email,
          taskTitle: title,
          assignedBy: assignedByName,
          taskId: task.id,
        });
      })
    );

    /* ===== FILE UPLOAD (optional) ===== */

    if (files.length > 0) {
      void Promise.all(
        files.map(async (file) => {
          const safeName = file.name
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w.\-]/g, "_");

          const filePath = `${task.id}/${Date.now()}_${safeName}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("task-files")
            .upload(filePath, file);

          if (uploadError) {
            console.error("TASK FILE UPLOAD ERROR:", uploadError);
            return;
          }

          const { error: insertError } = await supabaseAdmin
            .from("task_files")
            .insert({
              task_id: task.id,
              uploaded_by: user.id,
              original_name: file.name,
              path: filePath,
              size_bytes: file.size,
            });

          if (insertError) {
            console.error("TASK FILE INSERT ERROR:", insertError);
          }
        })
      ).catch((err) => {
        console.error("TASK FILE BACKGROUND ERROR:", err);
      });
    }

    return NextResponse.json({ task });
  } catch (e: any) {
    console.error("TASKS CREATE ERROR:", e);

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

/* ================= DELETE TASK ================= */

export async function DELETE(req: Request) {
  try {
    console.log("🔥 DELETE ROUTE IS HIT");

    const user = await getRequestUser(req);

    const { id, hard } = await req.json();

    if (!id) throw new Error("Task id required");

    if (hard) {
      const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from("tasks")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq("id", id.trim());

    console.log("SILINEN ID:", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("TASK DELETE ERROR:", e);

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

/* ================= RESTORE TASK ================= */

export async function PUT(req: Request) {
  try {
    await getRequestUser(req);

    const { id, action } = await req.json();

    if (action !== "restore") {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("tasks")
      .update({
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("TASK RESTORE ERROR:", e);

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}