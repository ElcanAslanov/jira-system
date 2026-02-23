import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getRequestUser(req: Request) {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");

  if (!userId || !role) throw new Error("Unauthorized");

  return { id: userId, role };
}

// ========================
// GET - List comments
// ========================
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;

    const { data, error } = await supabaseAdmin
      .from("task_comments")
      .select(`
        *,
        author:employees!task_comments_author_id_fkey(id,ad,soyad)
      `)
      .eq("task_id", taskId)
      .order("created_at");

    if (error) throw error;

    return NextResponse.json({ comments: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 400 }
    );
  }
}

// ========================
// POST - Add comment
// ========================
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getRequestUser(req);
    const taskId = params.id;
    const { body } = await req.json();

    if (!body) throw new Error("Comment boş ola bilməz");

    const { data: comment, error } = await supabaseAdmin
      .from("task_comments")
      .insert({
        task_id: taskId,
        author_id: user.id,
        body,
      })
      .select()
      .single();

    if (error) throw error;

    // 🔔 Notification - task owner və assignee üçün
    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("assigned_to, created_by, title")
      .eq("id", taskId)
      .single();

    const notifyUsers = new Set<string>();

    if (task?.assigned_to && task.assigned_to !== user.id)
      notifyUsers.add(task.assigned_to);

    if (task?.created_by && task.created_by !== user.id)
      notifyUsers.add(task.created_by);

    for (const uid of notifyUsers) {
      await supabaseAdmin.from("notifications").insert({
        user_id: uid,
        type: "COMMENT",
        title: "Yeni comment",
        body: `Task: ${task?.title}`,
        task_id: taskId,
        comment_id: comment.id,
      });
    }

    // 📝 Activity log
    await supabaseAdmin.from("task_activity").insert({
      task_id: taskId,
      actor_id: user.id,
      action: "COMMENTED",
      new_data: { comment_id: comment.id },
    });

    return NextResponse.json({ comment });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 400 }
    );
  }
}