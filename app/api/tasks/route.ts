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

  const { data: employee, error: employeeError } =
    await supabaseAdmin
      .from("employees")
      .select(`id, roles(name)`)
      .eq("user_id", authData.user.id)
      .single();

  if (employeeError || !employee)
    throw new Error("Employee not found");

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
  creator:employees!tasks_created_by_fkey (
    ad,
    soyad
  ),
  updater:employees!tasks_updated_by_fkey (
    ad,
    soyad
  )
`;

    /* ================= ADMIN / BOSS ================= */

    if (["ADMIN", "BOSS"].includes(user.role ?? "")) {
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select(baseSelect)
        .order("sort_index");

      if (error) throw error;
      tasks = data ?? [];
    }

    /* ================= REHBER / EMPLOYEE ================= */

    /* ================= REHBER ================= */

    /* ================= REHBER / EMPLOYEE ================= */

    else if (user.role === "REHBER" || user.role === "EMPLOYEE") {

      // 1️⃣ mənə assign olunan tasklar
      const { data: assignedRows } =
        await supabaseAdmin
          .from("task_assignees")
          .select("task_id")
          .eq("employee_id", user.id);

      const assignedTaskIds =
        assignedRows?.map((r) => r.task_id) ?? [];

      // 2️⃣ mənim yaratdığım tasklar
      const { data: createdRows } =
        await supabaseAdmin
          .from("tasks")
          .select("id")
          .eq("created_by", user.id);

      const createdTaskIds =
        createdRows?.map((r) => r.id) ?? [];

      // 3️⃣ ikisini birləşdir
      const allTaskIds = [...assignedTaskIds, ...createdTaskIds];

      const uniqueTaskIds = [...new Set(allTaskIds)];

      if (!uniqueTaskIds.length) {
        return NextResponse.json({ tasks: [] });
      }

      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select(baseSelect)
        .in("id", uniqueTaskIds)
        .order("sort_index");

      if (error) throw error;

      tasks = data ?? [];
    }

    if (!tasks.length) {
      return NextResponse.json({ tasks: [] });
    }

    const taskIds = tasks.map((t) => t.id);

    /* ===== COMMENT COUNTS ===== */

    /* ===== COMMENT + READ DATA ===== */

    const { data: comments } = await supabaseAdmin
      .from("task_comments")
      .select(`
    id,
    task_id,
    author_id,
    task_comment_reads (
      employee_id
    )
  `)
      .in("task_id", taskIds);

    const unreadMap: Record<string, number> = {};

    comments?.forEach((c) => {


      // 🔥 author_id artıq employee.id-dir
      if (c.author_id === user.id) return;

      const alreadyRead = c.task_comment_reads?.some(
        (r: any) => r.employee_id === user.id
      );

      if (!alreadyRead) {
        unreadMap[c.task_id] = (unreadMap[c.task_id] || 0) + 1;
      }
    });

    /* ===== ASSIGNEES ===== */

    const { data: assignees } =
      await supabaseAdmin
        .from("task_assignees")
        .select(`
          task_id,
          employees (
            ad,
            soyad
          )
        `)
        .in("task_id", taskIds);

    /* ===== FILES ===== */

    /* ===== FILES (FROM PRIVATE STORAGE BUCKET) ===== */

    const { data: taskFiles } = await supabaseAdmin
      .from("task_files")
      .select("task_id, original_name, path, size_bytes")
      .in("task_id", taskIds);

    const filesMap: Record<string, any[]> = {}; // 🔥 YALNIZ BU QALIR

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

      // 🔥 STORAGE-DAN GƏLƏN FILES
      const relatedFiles = filesMap[task.id] ?? [];

      // 🔥 COMMENT COUNT
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
        assigned_to: names,
        files: relatedFiles,
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

    const comments_enabled =
      formData.get("comments_enabled") !== "false";
    const files = formData.getAll("files") as File[];

    if (!title) throw new Error("Title required");
    if (!assignedIds.length) throw new Error("Assigned required");

    /* ===== CREATE TASK ===== */

    const { data: task, error } =
      await supabaseAdmin
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
      assignedIds.map((empId) => ({
        task_id: task.id,
        employee_id: empId,
      }))
    );

    /* ===== INSERT NOTIFICATIONS ===== */

   


  

    /* ===== EMAIL GÖNDƏR ===== */

    const { data: users } = await supabaseAdmin
      .from("employees")
      .select("id, email")
      .in("id", assignedIds);

   void Promise.all(
  (users || []).map((u) => {
    if (!u.email) return Promise.resolve();
    return sendNotificationEmail({
      to: u.email,
      taskTitle: title,
      assignedBy: "Admin",
      taskId: task.id,
    });
  })
).catch((err) => {
  console.error("EMAIL SEND ERROR:", err);
});

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

//burdan sora basladim