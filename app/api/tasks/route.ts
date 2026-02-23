import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  const headerUserId = req.headers.get("x-user-id");
  const headerRole = req.headers.get("x-user-role");

  if (!authHeader && headerUserId) {
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
      .select(`id, role_id, roles(name)`)
      .eq("user_id", authData.user.id)
      .single();

  if (employeeError || !employee) throw new Error("Employee not found");

  let role: string | null = null;

  if (Array.isArray(employee.roles)) {
    role = employee.roles[0]?.name ?? null;
  } else if (employee.roles && typeof employee.roles === "object") {
    role = (employee.roles as any).name ?? null;
  }

  return {
    id: employee.id,
    role,
  };
}

/* ================= GET TASKS ================= */

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);

    let tasks;

    // ADMIN / BOSS → hamısını görür
    if (["ADMIN", "BOSS"].includes(user.role ?? "")) {
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select("*")
        .order("sort_index");

      if (error) throw error;
      tasks = data;
    } else {
      /* 1️⃣ User-a assign olunan task id-lər */
      const { data: assignedRows, error: assignErr } =
        await supabaseAdmin
          .from("task_assignees")
          .select("task_id")
          .eq("employee_id", user.id);

      if (assignErr) throw assignErr;

      const assignedTaskIds =
        assignedRows?.map((r) => r.task_id) ?? [];

      /* 2️⃣ Task filter */
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select("*")
        .or(
          assignedTaskIds.length > 0
            ? `created_by.eq.${user.id},id.in.(${assignedTaskIds.join(",")})`
            : `created_by.eq.${user.id}`
        )
        .order("sort_index");

      if (error) throw error;
      tasks = data;
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    const taskIds = tasks.map((t) => t.id);

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

    const { data: files } =
      await supabaseAdmin
        .from("task_files")
        .select(`
          task_id,
          original_name,
          path,
          size_bytes
        `)
        .in("task_id", taskIds);

    const finalTasks = tasks.map((task) => {
      const relatedAssignees =
        assignees?.filter((a) => a.task_id === task.id);

      const names = relatedAssignees
        ?.map((r) => {
          const emp = Array.isArray(r.employees)
            ? r.employees[0]
            : r.employees;

          if (!emp) return null;
          return `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim();
        })
        .filter(Boolean);

      const relatedFiles =
        files?.filter((f) => f.task_id === task.id);

      return {
        ...task,
        assigned_to:
          names && names.length > 0
            ? names.join(", ")
            : null,
        files:
          relatedFiles?.map((f) => ({
            name: f.original_name,
            path: f.path,
            size: f.size_bytes,
          })) ?? [],
      };
    });

    return NextResponse.json({ tasks: finalTasks });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 401 }
    );
  }
}

/* ================= CREATE TASK ================= */

export async function POST(req: Request) {
  try {
    const user = await getRequestUser(req);

    const contentType = req.headers.get("content-type") || "";

    let title = "";
    let description = "";
    let priority = "";
    let start_date = "";
    let due_date = "";
    let assigned_to: string[] = [];
    let files: File[] = [];

    /* MULTIPART */
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      title = String(formData.get("title") || "");
      description = String(formData.get("description") || "");
      priority = String(formData.get("priority") || "");
      start_date = String(formData.get("start_date") || "");
      due_date = String(formData.get("due_date") || "");
      assigned_to = formData.getAll("assigned_to[]") as string[];
      files = formData.getAll("files") as File[];
    }

    /* JSON */
    else {
      const body = await req.json();

      title = body.title;
      description = body.description;
      priority = body.priority;
      start_date = body.start_date;
      due_date = body.due_date;
      assigned_to = body.assigned_to || [];
      files = [];
    }

    if (!title) throw new Error("Title required");

    const { data: task, error: taskError } =
      await supabaseAdmin
        .from("tasks")
        .insert({
          title,
          description,
          priority,
          start_date: start_date || null,
          due_date: due_date || null,
          created_by: user.id,
          status: "TODO",
          sort_index: Date.now(),
        })
        .select()
        .single();

    if (taskError) throw taskError;

    /* ASSIGNEES */
    if (assigned_to.length) {
      await supabaseAdmin.from("task_assignees").insert(
        assigned_to.map((id) => ({
          task_id: task.id,
          employee_id: id,
        }))
      );
    }

    /* FILE UPLOAD + DB INSERT (DÜZGÜN SÜTUNLAR) */
    for (const file of files) {
      const filePath = `${task.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } =
        await supabaseAdmin.storage
          .from("task-files")
          .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: fileInsertError } =
        await supabaseAdmin.from("task_files").insert({
          task_id: task.id,
          uploaded_by: user.id,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          bucket: "task-files",
          path: filePath,
        });

      if (fileInsertError) throw fileInsertError;
    }

    return NextResponse.json({ task });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 400 }
    );
  }
}