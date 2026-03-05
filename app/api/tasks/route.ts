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
    // 🔥 RECURSIVE: bütün alt rehber və employee-ləri tapmaq üçün
    async function getAllSubordinates(rootId: string): Promise<string[]> {
      const visited = new Set<string>();
      const stack = [rootId];

      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;

        const { data } = await supabaseAdmin
          .from("employee_guides")
          .select("employee_id")
          .eq("guide_id", current);

        const children = data?.map((r) => r.employee_id) ?? [];

        for (const child of children) {
          if (!visited.has(child)) {
            visited.add(child);
            stack.push(child);
          }
        }
      }

      return Array.from(visited);
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

    else if (user.role === "REHBER") {

      // 1️⃣ özünə assign olunan
      const { data: selfAssigned } =
        await supabaseAdmin
          .from("task_assignees")
          .select("task_id")
          .eq("employee_id", user.id);

      const selfTaskIds =
        selfAssigned?.map(r => r.task_id) ?? [];

      // 2️⃣ öz işçiləri
      // 🔥 bütün alt rehber və employee-ləri tap
      const employeeIds = await getAllSubordinates(user.id);

      // 3️⃣ işçilərə assign olunan tasklar
      let employeeTaskIds: string[] = [];

      if (employeeIds.length) {
        const { data: employeeAssigned } =
          await supabaseAdmin
            .from("task_assignees")
            .select("task_id")
            .in("employee_id", employeeIds);

        employeeTaskIds =
          employeeAssigned?.map(r => r.task_id) ?? [];
      }

      // 4️⃣ öz yaratdığı tasklar
      const { data: createdTasks } =
        await supabaseAdmin
          .from("tasks")
          .select("id")
          .eq("created_by", user.id);

      const createdTaskIds =
        createdTasks?.map(r => r.id) ?? [];

      const allTaskIds = [
        ...selfTaskIds,
        ...employeeTaskIds,
        ...createdTaskIds
      ];

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


    /* ================= EMPLOYEE ================= */

    else if (user.role === "EMPLOYEE") {

      const { data: assignedRows } =
        await supabaseAdmin
          .from("task_assignees")
          .select("task_id")
          .eq("employee_id", user.id);

      const assignedTaskIds =
        assignedRows?.map((r) => r.task_id) ?? [];

      if (!assignedTaskIds.length) {
        return NextResponse.json({ tasks: [] });
      }

      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select(baseSelect)
        .in("id", assignedTaskIds)
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

const filesMap: Record<string, any[]> = {};

for (const taskId of taskIds) {
  const { data: storageFiles } =
    await supabaseAdmin.storage
      .from("task-files")
      .list(taskId, {
        limit: 100,
        offset: 0,
      });

  if (storageFiles?.length) {
    filesMap[taskId] = storageFiles.map((f) => ({
      name: f.name.split("_").slice(1).join("_") || f.name,
      path: `${taskId}/${f.name}`,
      size: f.metadata?.size ?? 0,
    }));
  } else {
    filesMap[taskId] = [];
  }
}

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

    const notifPayload = assignedIds.map((empId) => ({
      user_id: empId,
      type: "TASK_ASSIGNED",
      title: "Yeni tapşırıq",
      body: `Sizə "${title}" tapşırıldı`,
      task_id: task.id,
    }));


    const { data: notifData, error: notifErr } =
      await supabaseAdmin.from("notifications").insert(
        assignedIds.map((empId) => ({
          user_id: empId,
          type: "TASK_ASSIGNED",
          title: "Yeni tapşırıq",
          body: `Sizə "${title}" tapşırıldı`,
          task_id: task.id,
        }))
      );

    /* ===== FILE UPLOAD (optional) ===== */

    if (files.length > 0) {
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${task.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } =
          await supabaseAdmin.storage
            .from("task-files")
            .upload(filePath, file);

        if (!uploadError) {
          await supabaseAdmin.from("task_files").insert({
            task_id: task.id,
            original_name: file.name,
            path: filePath,
            size_bytes: file.size,
          });
        }
      }
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