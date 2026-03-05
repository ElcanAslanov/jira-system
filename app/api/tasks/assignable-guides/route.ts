import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");

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

  return {
    id: employee.id,
    role_id: employee.role_id
  };
}

/* ================= GET ASSIGNABLE EMPLOYEES ================= */

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);

    /* ================= SUBORDINATES ================= */

    const { data: subordinates } =
      await supabaseAdmin
        .from("employee_guides")
        .select(`
          employee_id,
          employees (
            id,
            ad,
            soyad
          )
        `)
        .eq("guide_id", user.id);

    const subordinateEmployees =
      subordinates?.map((r: any) => r.employees) ?? [];

    /* ================= ROLE COMPANY ACCESS ================= */

/* ================= ROLE COMPANY ACCESS ================= */

const { data: roleCompanies } =
  await supabaseAdmin
    .from("role_company_access")
    .select("company_id")
    .eq("role_id", user.role_id);

/* ================= USER COMPANY OVERRIDES ================= */

const { data: userCompanies } =
  await supabaseAdmin
    .from("user_company_access")
    .select("company_id, allowed")
    .eq("user_id", user.id);

/* ================= FINAL COMPANIES ================= */

const base = new Set(
  roleCompanies?.map((c: any) => c.company_id) ?? []
);

userCompanies?.forEach((c: any) => {
  if (c.allowed) base.add(c.company_id);
  else base.delete(c.company_id);
});

const companyIds = Array.from(base);

 

    /* ================= PERMISSION GUIDES ================= */

    const { data: roleGuides } =
      await supabaseAdmin
        .from("role_assignable_guides")
        .select("guide_id")
        .eq("role_id", user.role_id);

    const guideIds =
      roleGuides?.map(r => r.guide_id) ?? [];

    let permissionGuides: any[] = [];

    if (guideIds.length) {
      const { data } =
        await supabaseAdmin
          .from("employees")
          .select("id, ad, soyad")
          .in("id", guideIds);

      permissionGuides = data ?? [];
    }

    /* ================= MERGE ================= */

 const allEmployees = [
  ...subordinateEmployees,
  ...permissionGuides
];

    /* ================= UNIQUE + REMOVE SELF ================= */

    const unique = Object.values(
      Object.fromEntries(
        allEmployees.map((e: any) => [e.id, e])
      )
    ).filter((e: any) => e.id !== user.id); // 🔥 kendisini çıkar

    return NextResponse.json({
      employees: unique
    });

  } catch (error: any) {
    console.error("ASSIGNABLE EMPLOYEES ERROR:", error);

    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

//burdan sora basladim