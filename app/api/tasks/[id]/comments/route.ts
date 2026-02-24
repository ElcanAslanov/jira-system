import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getRequestUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("Unauthorized");

  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) throw new Error("Unauthorized");

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("user_id", data.user.id)
    .single();

  if (!employee) throw new Error("Employee not found");

  return employee.id; // employees.id qaytarırıq
}

/* ================= GET COMMENTS ================= */

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: comments, error } = await supabaseAdmin
      .from("task_comments")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!comments?.length) {
      return NextResponse.json({ comments: [] });
    }

    const authorIds = [...new Set(comments.map(c => c.author_id))];

    const { data: employees } = await supabaseAdmin
      .from("employees")
      .select("id, ad, soyad")
      .in("id", authorIds);

    const formatted = comments.map((c) => {
      const emp = employees?.find(
        (e) => e.id === c.author_id
      );

      return {
        id: c.id,
        message: c.body, // 🔥 DB column body → API field message
        created_at: c.created_at,
        author_name: emp
          ? `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim()
          : "Unknown",
        files: Array.isArray(c.files) ? c.files : [],
      };
    });

    return NextResponse.json({ comments: formatted });

  } catch (e: any) {
    console.error("COMMENT LOAD ERROR:", e);
    return NextResponse.json(
      { error: e.message },
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
    const employeeId = await getRequestUser(req);

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

    const { data, error } = await supabaseAdmin
      .from("task_comments")
      .insert({
        task_id: taskId,
        author_id: employeeId,
        body: hasMessage ? body.comment.trim() : null, // 🔥 DÜZGÜN COLUMN
        files: hasFiles ? body.files : [],
      })
      .select()
      .single();

    if (error) throw error;

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("ad, soyad")
      .eq("id", employeeId)
      .single();

    return NextResponse.json({
      comment: {
        id: data.id,
        message: data.body, // 🔥 DB body → frontend message
        created_at: data.created_at,
        author_name: emp
          ? `${emp.ad ?? ""} ${emp.soyad ?? ""}`.trim()
          : "Unknown",
        files: Array.isArray(data.files) ? data.files : [],
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