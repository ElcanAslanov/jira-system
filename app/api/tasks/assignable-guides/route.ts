import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= AUTH ================= */

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization");

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
    .select("id, user_id, role_id, company_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (employeeError) {
    throw employeeError;
  }

  if (!employee) {
    throw new Error("Employee not found");
  }

  return {
    employeeId: employee.id,
    userId: authData.user.id,
    roleId: employee.role_id,
    companyId: employee.company_id,
  };
}

/* ================= GET COMPANY ACCESS ================= */

async function getAllowedCompanyIds(userId: string, roleId: string | null) {
  const { data: roleCompanies, error: roleCompaniesError } = await supabaseAdmin
    .from("role_company_access")
    .select("company_id")
    .eq("role_id", roleId);

  if (roleCompaniesError) {
    throw roleCompaniesError;
  }

  const { data: userCompanies, error: userCompaniesError } = await supabaseAdmin
    .from("user_company_access")
    .select("company_id, allowed")
    .eq("user_id", userId);

  if (userCompaniesError) {
    throw userCompaniesError;
  }

  const allowed = new Set<string>();

  (roleCompanies ?? []).forEach((row: any) => {
    if (row.company_id) {
      allowed.add(String(row.company_id));
    }
  });

  (userCompanies ?? []).forEach((row: any) => {
    const companyId = String(row.company_id);

    if (!companyId) return;

    if (row.allowed === true) {
      allowed.add(companyId);
    } else {
      allowed.delete(companyId);
    }
  });

  return Array.from(allowed);
}

/* ================= GET ASSIGNABLE EMPLOYEES ================= */

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);

    const companyIds = await getAllowedCompanyIds(user.userId, user.roleId);

    /* ================= USER PERMISSION GUIDES ================= */

    const { data: userGuides, error: userGuidesError } = await supabaseAdmin
      .from("user_assignable_guides")
      .select("guide_id")
      .eq("user_id", user.userId);

    if (userGuidesError) {
      throw userGuidesError;
    }

    const guideIds = (userGuides ?? [])
      .map((row: any) => row.guide_id)
      .filter(Boolean);

    /*
      Əvvəl user_assignable_guides varsa, yalnız həmin guide-ları qaytarırıq.
      Əgər boşdursa, fallback olaraq user-in company access-i daxilində olan
      bütün işçiləri qaytarırıq. Bu dropdown-un boş qalmasının qarşısını alır.
    */

    let query = supabaseAdmin
      .from("employees")
      .select("id, user_id, ad, soyad, company_id")
      .neq("id", user.employeeId)
      .order("ad", { ascending: true });

    if (guideIds.length > 0) {
      query = query.in("id", guideIds);
    }

    if (companyIds.length > 0) {
      query = query.in("company_id", companyIds);
    } else if (user.companyId) {
      query = query.eq("company_id", user.companyId);
    }

    const { data: employees, error: employeesError } = await query;

    if (employeesError) {
      throw employeesError;
    }

    const finalEmployees = (employees ?? [])
      .filter((employee: any) => employee.id !== user.employeeId)
      .map((employee: any) => ({
        id: employee.id,
        user_id: employee.user_id,
        ad: employee.ad ?? "",
        soyad: employee.soyad ?? "",
        company_id: employee.company_id,
      }))
      .sort((a: any, b: any) =>
        `${a.ad ?? ""} ${a.soyad ?? ""}`.localeCompare(
          `${b.ad ?? ""} ${b.soyad ?? ""}`,
          "az"
        )
      );

    return NextResponse.json({
      employees: finalEmployees,
      debug: {
        employeeId: user.employeeId,
        userId: user.userId,
        roleId: user.roleId,
        companyId: user.companyId,
        allowedCompanyCount: companyIds.length,
        guideCount: guideIds.length,
        mode: guideIds.length > 0 ? "user_assignable_guides" : "company_fallback",
        count: finalEmployees.length,
      },
    });
  } catch (error: any) {
    console.error("ASSIGNABLE EMPLOYEES ERROR:", error);

    return NextResponse.json(
      {
        employees: [],
        error: error?.message ?? "Server error",
      },
      { status: 500 }
    );
  }
}