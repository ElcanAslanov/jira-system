import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getRequestEmployee(req: Request) {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user) {
    throw new Error("Unauthorized");
  }

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("id, user_id, ad, soyad")
    .eq("user_id", authData.user.id)
    .single();

  if (employeeError || !employee) {
    throw new Error("Employee not found");
  }

  return {
    employeeId: employee.id as string,
    authUserId: authData.user.id,
    name: `${employee.ad ?? ""} ${employee.soyad ?? ""}`.trim(),
  };
}

export async function GET(req: Request) {
  try {
    const employee = await getRequestEmployee(req);

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit") || 30);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 30;

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", employee.employeeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const notifications = data ?? [];

    return NextResponse.json({
      notifications,
      unread: notifications.filter((n: any) => !n.is_read).length,
      employee_id: employee.employeeId,
    });
  } catch (e: any) {
    console.error("NOTIFICATIONS GET ERROR:", e);

    const status =
      e?.message === "Unauthorized"
        ? 401
        : e?.message === "Employee not found"
          ? 404
          : 500;

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const employee = await getRequestEmployee(req);
    const body = await req.json().catch(() => ({}));

    const id = body?.id as string | undefined;
    const markAll = body?.markAll === true;

    if (!id && !markAll) {
      return NextResponse.json(
        { error: "Notification id or markAll required" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", employee.employeeId);

    if (!markAll && id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("is_read", false);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("NOTIFICATIONS PATCH ERROR:", e);

    const status =
      e?.message === "Unauthorized"
        ? 401
        : e?.message === "Employee not found"
          ? 404
          : 500;

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status }
    );
  }
}