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

  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) throw new Error("Unauthorized");

  const { data: employee, error } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("user_id", data.user.id)
    .single();

  if (error || !employee) throw new Error("Employee not found");

  return employee.id;
}

/* ================= MARK COMMENTS AS READ ================= */

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> } // ✅ Promise olmalıdır
) {
  try {
    const { id: taskId } = await context.params; // ✅ await vacibdir
    const employeeId = await getRequestUser(req);

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 401 }
      );
    }

    /* 🔥 Task-a aid bütün comment-ləri alırıq */

    const { data: comments, error: commentError } =
      await supabaseAdmin
        .from("task_comments")
        .select("id")
        .eq("task_id", taskId);

    if (commentError) throw commentError;

    if (!comments?.length) {
      return NextResponse.json({ success: true });
    }

    /* 🔥 Upsert read records */

    const inserts = comments.map((c) => ({
      task_id: taskId,
      comment_id: c.id,
      employee_id: employeeId,
      read_at: new Date().toISOString(), // ✅ vacibdir
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
      { status: 500 }
    );
  }
}