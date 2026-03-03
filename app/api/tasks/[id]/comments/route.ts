import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getAuthUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("Unauthorized");

  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) throw new Error("Unauthorized");

  return data.user; // 🔥 auth user qaytarırıq
}

async function getEmployeeId(userId: string) {
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!emp) throw new Error("Employee not found");

  return emp.id;
}

/* ================= GET COMMENTS ================= */

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;

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

    // müəllif adlarını employees-dən alırıq (author_id = user_id)
    const authorUserIds = [
      ...new Set(comments.map((c) => c.author_id).filter(Boolean)),
    ];

    const { data: employees } = await supabaseAdmin
      .from("employees")
      .select("user_id, ad, soyad")
      .in("user_id", authorUserIds);

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

    const authUser = await getAuthUser(req);
    const employeeId = await getEmployeeId(authUser.id);

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

    /* ===== INSERT COMMENT ===== */
    // 🔥 author_id = auth user id

    const { data: insertedComment, error } = await supabaseAdmin
      .from("task_comments")
      .insert({
        task_id: taskId,
        author_id: authUser.id,
        body: hasMessage ? body.comment.trim() : null,
        files: hasFiles ? body.files : [],
      })
      .select()
      .single();

    if (error) throw error;

    /* ===== AUTHOR AUTO-READ ===== */

    await supabaseAdmin
      .from("task_comment_reads")
      .upsert(
        {
          task_id: taskId,
          comment_id: insertedComment.id,
          employee_id: employeeId,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: "comment_id,employee_id",
        }
      );

    /* ================= NOTIFICATION LOGIC ================= */

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("title, created_by")
      .eq("id", taskId)
      .single();

    const { data: assignees } = await supabaseAdmin
      .from("task_assignees")
      .select("employee_id")
      .eq("task_id", taskId);

    const notifyUserIds = new Set<string>();

    if (task?.created_by && task.created_by !== employeeId) {
      notifyUserIds.add(task.created_by);
    }

    assignees?.forEach((a) => {
      if (a.employee_id !== employeeId) {
        notifyUserIds.add(a.employee_id);
      }
    });

    if (notifyUserIds.size > 0) {
      await supabaseAdmin.from("notifications").insert(
        Array.from(notifyUserIds).map((empId) => ({
          user_id: empId,
          type: "TASK_COMMENT",
          title: "Yeni şərh",
          body: `"${task?.title ?? "Tapşırıq"}" tapşırığında yeni şərh var`,
          task_id: taskId,
        }))
      );
    }

    /* ================= RESPONSE ================= */

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("ad, soyad")
      .eq("id", employeeId)
      .single();

    return NextResponse.json({
      comment: {
        id: insertedComment.id,
        message: insertedComment.body,
        created_at: insertedComment.created_at,
        author_id: authUser.id,
        author_name: emp
          ? `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim()
          : "Unknown",
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