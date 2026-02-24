import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getRequestUser(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");

  if (!userId || !role) throw new Error("Unauthorized");

  return { id: userId, role };
}

/* =======================
   GET - File list
======================= */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("task_files")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at");

    if (error) throw error;

    return NextResponse.json({ files: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 400 }
    );
  }
}

/* =======================
   POST - Upload file
======================= */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const user = await getRequestUser(request);

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) throw new Error("File tapılmadı");

    if (file.size > 20 * 1024 * 1024) {
      throw new Error("Max 20MB");
    }

    const ext = file.name.split(".").pop();
    const path = `${taskId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("task-files")
      .upload(path, file, {
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data: fileRow, error } = await supabaseAdmin
      .from("task_files")
      .insert({
        task_id: taskId,
        uploaded_by: user.id,
        path,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single();

    if (error) throw error;

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
        type: "FILE_ADDED",
        title: "Yeni fayl əlavə edildi",
        body: `Task: ${task?.title}`,
        task_id: taskId,
        file_id: fileRow.id,
      });
    }

    await supabaseAdmin.from("task_activity").insert({
      task_id: taskId,
      actor_id: user.id,
      action: "FILE_UPLOADED",
      new_data: { file_id: fileRow.id },
    });

    return NextResponse.json({ file: fileRow });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 400 }
    );
  }
}

/* =======================
   DELETE - Remove file
======================= */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await context.params;
    const user = await getRequestUser(request);

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) throw new Error("fileId lazımdır");

    const { data: fileRow } = await supabaseAdmin
      .from("task_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (!fileRow) throw new Error("File tapılmadı");

    if (
      user.role !== "BOSS" &&
      fileRow.uploaded_by !== user.id
    ) {
      throw new Error("İcazə yoxdur");
    }

    await supabaseAdmin.storage
      .from("task-files")
      .remove([fileRow.path]);

    await supabaseAdmin
      .from("task_files")
      .delete()
      .eq("id", fileId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 400 }
    );
  }
}