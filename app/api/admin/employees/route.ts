import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/* ======================= */
/* GET */
/* ======================= */

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("employees")
  .select(`
  id,
  user_id,
  email,
  ad,
  soyad,
  ata_adi,
  elaqe_nomresi,
  created_at,
  company_id,
  department_id,
  position_id,
  role_id,

  companies:companies!fk_employees_company(id,name),
  departments:departments!fk_employees_department(id,name,company_id),
  positions:positions!fk_employees_position(id,name),
  roles:roles!fk_employees_role(id,name),

  employee_guides!employee_guides_employee_id_fkey(
    guide_id,
    guides:employees!employee_guides_guide_id_fkey(
      id,
      ad,
      soyad
    )
  )
`)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 400);

  return NextResponse.json({
    employees: data ?? [],
  });
}

/* ======================= */
/* PUT */
/* ======================= */

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    const id = safeStr(body?.id);
    if (!id) return jsonError("ID tapılmadı", 400);

    const payload = {
      ad: safeStr(body?.ad),
      soyad: safeStr(body?.soyad),
      ata_adi: safeStr(body?.ata_adi),
      elaqe_nomresi: safeStr(body?.elaqe_nomresi),
      company_id: body?.company_id || null,
      department_id: body?.department_id || null,
      position_id: body?.position_id || null,
      role_id: body?.role_id || null,
    };

    if (!payload.ad || !payload.soyad) {
      return jsonError("Ad və Soyad boş ola bilməz", 400);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("employees")
      .update(payload)
      .eq("id", id);

    if (updateErr) return jsonError(updateErr.message, 400);

    /* ===== Guides sync ===== */

    await supabaseAdmin
      .from("employee_guides")
      .delete()
      .eq("employee_id", id);

    if (Array.isArray(body?.guide_ids) && body.guide_ids.length > 0) {
      const rows = body.guide_ids.map((guideId: string) => ({
        employee_id: id,
        guide_id: guideId,
      }));

      const { error: insertGuidesErr } = await supabaseAdmin
        .from("employee_guides")
        .insert(rows);

      if (insertGuidesErr)
        return jsonError(insertGuidesErr.message, 400);
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    return jsonError(e?.message || "Server xətası", 500);
  }
}

/* ======================= */
/* DELETE */
/* ======================= */

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = safeStr(searchParams.get("id"));

    if (!id) return jsonError("ID tapılmadı", 400);

    const { data: emp, error: empReadErr } = await supabaseAdmin
      .from("employees")
      .select("id,user_id")
      .eq("id", id)
      .single();

    if (empReadErr) return jsonError(empReadErr.message, 400);

    await supabaseAdmin
      .from("employee_guides")
      .delete()
      .eq("employee_id", id);

    const { error: empDelErr } = await supabaseAdmin
      .from("employees")
      .delete()
      .eq("id", id);

    if (empDelErr) return jsonError(empDelErr.message, 400);

    if (emp?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(emp.user_id);
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    return jsonError(e?.message || "Server xətası", 500);
  }
}