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

  if (authError || !authData?.user) {
    throw new Error("Unauthorized");
  }

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("id, user_id, role_id")
    .eq("user_id", authData.user.id)
    .single();

  if (employeeError || !employee) {
    throw new Error("Employee not found");
  }

  return {
    employeeId: employee.id,      // employees.id
    userId: authData.user.id,     // auth user id
    roleId: employee.role_id,
  };
}

/* ================= GET ASSIGNABLE EMPLOYEES ================= */

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);

    /* ================= ROLE COMPANY ACCESS ================= */

    const { data: roleCompanies, error: roleCompaniesError } =
      await supabaseAdmin
        .from("role_company_access")
        .select("company_id")
        .eq("role_id", user.roleId);

    if (roleCompaniesError) throw roleCompaniesError;

    /* ================= USER COMPANY OVERRIDES ================= */

    const { data: userCompanies, error: userCompaniesError } =
      await supabaseAdmin
        .from("user_company_access")
        .select("company_id, allowed")
        .eq("user_id", user.userId);

    if (userCompaniesError) throw userCompaniesError;

    /* ================= FINAL COMPANIES ================= */

    const base = new Set(
      roleCompanies?.map((c: any) => c.company_id) ?? []
    );

    userCompanies?.forEach((c: any) => {
      if (c.allowed) base.add(c.company_id);
      else base.delete(c.company_id);
    });

    const companyIds = Array.from(base);

    /* ================= USER PERMISSION GUIDES ================= */

    const { data: userGuides, error: userGuidesError } =
      await supabaseAdmin
        .from("user_assignable_guides")
        .select("guide_id")
        .eq("user_id", user.userId);

    if (userGuidesError) throw userGuidesError;

    const guideIds = userGuides?.map((r: any) => r.guide_id) ?? [];

    if (!guideIds.length) {
      return NextResponse.json({ employees: [] });
    }

    /* ================= FETCH EMPLOYEES ================= */

    let query = supabaseAdmin
      .from("employees")
      .select("id, ad, soyad, company_id")
      .in("id", guideIds);

    if (companyIds.length > 0) {
      query = query.in("company_id", companyIds);
    }

    const { data: employees, error: employeesError } = await query;

    if (employeesError) throw employeesError;

    const finalEmployees = (employees ?? [])
      .filter((e: any) => e.id !== user.employeeId)
      .map(({ id, ad, soyad }) => ({ id, ad, soyad }));

    return NextResponse.json({
      employees: finalEmployees,
    });
  } catch (error: any) {
    console.error("ASSIGNABLE EMPLOYEES ERROR:", error);

    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: 500 }
    );
  }
}