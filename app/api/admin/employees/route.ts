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

export async function GET(request: Request) {
  // 1️⃣ Login user tap
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // 2️⃣ Öz employee recordunu tap (çox vacib!)
  const { data: myEmployeeRow } = await supabaseAdmin
    .from("employees")
    .select("id, role_id")
    .eq("user_id", userId)
    .single();

  if (!myEmployeeRow) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  const myEmployeeId = myEmployeeRow.id;
  const roleId = myEmployeeRow.role_id;

  // 3️⃣ Role adı tap
  const { data: roleData } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", roleId)
    .single();

  const roleName = roleData?.name;
  const isAdmin = roleName === "ADMIN";
  const isRehber = roleName === "REHBER";

  // 4️⃣ Company access hesabla
  let allowedCompanies: number[] = [];

  if (!isAdmin) {
    const { data: roleCompanies } = await supabaseAdmin
      .from("role_company_access")
      .select("company_id")
      .eq("role_id", roleId);

    allowedCompanies =
      roleCompanies?.map((c: any) => c.company_id) || [];

    const { data: userCompanies } = await supabaseAdmin
      .from("user_company_access")
      .select("company_id,allowed")
      .eq("user_id", userId);

    userCompanies?.forEach((c: any) => {
      if (c.allowed === true) {
        if (!allowedCompanies.includes(c.company_id)) {
          allowedCompanies.push(c.company_id);
        }
      } else {
        allowedCompanies = allowedCompanies.filter(
          (id) => id !== c.company_id
        );
      }
    });
  }

  // 5️⃣ REHBER üçün tabeliyində olan userləri tap
  let myEmployeeIds: string[] = [];

  if (isRehber) {
    const { data: myEmployees } = await supabaseAdmin
      .from("employee_guides")
      .select("employee_id")
      .eq("guide_id", myEmployeeId); // 🔥 DÜZGÜN ID

    myEmployeeIds =
      myEmployees?.map((x: any) => x.employee_id) || [];
  }

  // 6️⃣ MAIN QUERY
  let query = supabaseAdmin
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

  if (!isAdmin) {
    // NORMAL ROLE
    if (!isRehber) {
      if (allowedCompanies.length === 0) {
        return NextResponse.json({ employees: [] });
      }

      query = query.in("company_id", allowedCompanies);
    }
    // REHBER ROLE
    else {
      const filters: string[] = [];

      if (allowedCompanies.length > 0) {
        filters.push(`company_id.in.(${allowedCompanies.join(",")})`);
      }

      if (myEmployeeIds.length > 0) {
        filters.push(`id.in.(${myEmployeeIds.join(",")})`);
      }

      if (filters.length === 0) {
        return NextResponse.json({ employees: [] });
      }

      query = query.or(filters.join(","));
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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