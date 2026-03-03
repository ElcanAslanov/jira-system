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

  // EMPLOYEE → only assigned
  if (user.role === "EMPLOYEE") {
    const { data: assigned } = await supabaseAdmin
      .from("task_assignees")
      .select("id")
      .eq("task_id", taskId)
      .eq("employee_id", user.id)
      .maybeSingle();

    return !!assigned;
  }

  // REHBER → own created OR team task
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

    return assigned?.some((a) => teamIds.includes(a.employee_id));
  }

  return false;
}

/* ================= GET COMMENTS ================= */

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const user = await getRequestUser(req);

    const hasAccess = await checkTaskAccess(taskId, user);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    const { data: comments, error } = await supabaseAdmin
      .from("task_comments")
      .select(`
        id,
        body,
        author_id,
        created_at,
        files,
        task_comment_reads (
          employee_id,
          read_at,
          employees (
            ad,
            soyad
          )
        )
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!comments?.length) {
      return NextResponse.json({ comments: [] });
    }

    const authorIds = [
      ...new Set(comments.map((c) => c.author_id).filter(Boolean)),
    ];

    const { data: employees } = await supabaseAdmin
      .from("employees")
      .select("user_id, ad, soyad")
      .in("user_id", authorIds);

    const formatted = comments.map((c) => {
      const emp = employees?.find((e) => e.user_id === c.author_id);

      return {
        id: c.id,
        message: c.body,
        created_at: c.created_at,
        author_id: c.author_id,
        author_name: emp
          ? `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim()
          : "Unknown",
        files: Array.isArray(c.files) ? c.files : [],
        reads: c.task_comment_reads ?? [],
      };
    });

    return NextResponse.json({ comments: formatted });

  } catch (e: any) {
    console.error("COMMENT LOAD ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

/* ================= ADD COMMENT ================= */

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const user = await getRequestUser(req);

    const hasAccess = await checkTaskAccess(taskId, user);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const hasMessage =
      typeof body.comment === "string" &&
      body.comment.trim().length > 0;

    const hasFiles =
      Array.isArray(body.files) &&
      body.files.length > 0;

    if (!hasMessage && !hasFiles) {
      return NextResponse.json(
        { error: "Empty comment" },
        { status: 400 }
      );
    }

    const { data: insertedComment, error } = await supabaseAdmin
      .from("task_comments")
      .insert({
        task_id: taskId,
        author_id: user.id,
        body: hasMessage ? body.comment.trim() : null,
        files: hasFiles ? body.files : [],
      })
      .select()
      .single();

    if (error) throw error;

    /* ===== AUTO READ ===== */

    await supabaseAdmin.from("task_comment_reads").upsert(
      {
        task_id: taskId,
        comment_id: insertedComment.id,
        employee_id: user.id,
        read_at: new Date().toISOString(),
      },
      {
        onConflict: "comment_id,employee_id",
      }
    );

    /* ===== NOTIFICATIONS ===== */

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("title, created_by")
      .eq("id", taskId)
      .single();

    const { data: assignees } = await supabaseAdmin
      .from("task_assignees")
      .select("employee_id")
      .eq("task_id", taskId);

    const notifyIds = new Set<string>();

    if (task?.created_by && task.created_by !== user.id) {
      notifyIds.add(task.created_by);
    }

    assignees?.forEach((a) => {
      if (a.employee_id !== user.id) {
        notifyIds.add(a.employee_id);
      }
    });

    if (notifyIds.size > 0) {
      await supabaseAdmin.from("notifications").insert(
        Array.from(notifyIds).map((empId) => ({
          user_id: empId,
          type: "TASK_COMMENT",
          title: "Yeni şərh",
          body: `"${task?.title ?? "Tapşırıq"}" tapşırığında yeni şərh var`,
          task_id: taskId,
        }))
      );
    }

    return NextResponse.json({
      comment: {
        id: insertedComment.id,
        message: insertedComment.body,
        created_at: insertedComment.created_at,
        author_id: user.id,
        author_name: "You",
        files: Array.isArray(insertedComment.files)
          ? insertedComment.files
          : [],
        reads: [],
      },
    });

  } catch (e: any) {
    console.error("COMMENT INSERT ERROR:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}