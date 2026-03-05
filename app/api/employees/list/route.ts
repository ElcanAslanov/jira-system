import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= TYPES ================= */

type RoleRelation = {
  name: string;
};

type EmployeeWithRole = {
  id: string;
 roles: RoleRelation | RoleRelation[] | null;
};

/* ================= AUTH HELPER ================= */

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Unauthorized - No token");
  }

  const token = authHeader.replace("Bearer ", "");

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user) {
    throw new Error("Unauthorized - Invalid token");
  }

  const { data: employee, error: employeeError } =
    await supabaseAdmin
      .from("employees")
      .select(`
        id,
        roles(name)
      `)
      .eq("user_id", authData.user.id)
      .single<EmployeeWithRole>();

  if (employeeError || !employee) {
    throw new Error("Employee not found");
  }
  return {
    id: employee.id,
    role: Array.isArray(employee.roles)
  ? employee.roles[0]?.name
  : employee.roles?.name ?? null,
  };
  
}

/* ================= GET ================= */

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);

    // 🟢 BOSS → hamını görür
   if (user.role === "BOSS" || user.role === "ADMIN") {
      const { data, error } = await supabaseAdmin
        .from("employees")
        .select("id, ad, soyad")
        .order("ad");

      if (error) throw error;

      return NextResponse.json({ employees: data });
    }

    // 🟡 REHBER → yalnız öz işçiləri
   // 🟡 REHBER → öz işçiləri + sub-rehber işçiləri (recursive)
if (user.role === "REHBER") {

  const collected = new Set<string>();

  const collectEmployees = async (guideId: string) => {

    const { data: relations, error } = await supabaseAdmin
      .from("employee_guides")
      .select("employee_id")
      .eq("guide_id", guideId);

    if (error) throw error;

    const ids = relations?.map(r => r.employee_id) ?? [];

    for (const id of ids) {

      if (collected.has(id)) continue;

      collected.add(id);

      // 🔍 Bu employee rehberdirmi?
    const { data: emp, error: empErr } = await supabaseAdmin
  .from("employees")
  .select("id, roles(name)")
  .eq("id", id)
  .single<EmployeeWithRole>();

if (empErr) throw empErr;

const role =
  Array.isArray(emp.roles)
    ? emp.roles[0]?.name ?? null
    : emp.roles?.name ?? null;

      if (role === "REHBER") {
        await collectEmployees(id); // 🔥 recursion
      }
    }
  };

  await collectEmployees(user.id);

  const employeeIds = Array.from(collected);

  if (employeeIds.length === 0) {
    return NextResponse.json({ employees: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, ad, soyad")
    .in("id", employeeIds)
    .order("ad");

  if (error) throw error;

  return NextResponse.json({ employees: data });
}

    // 🔴 EMPLOYEE → yalnız özünü
    if (user.role === "EMPLOYEE") {
      const { data, error } = await supabaseAdmin
        .from("employees")
        .select("id, ad, soyad")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      return NextResponse.json({
        employees: data ? [data] : [],
      });
    }

    return NextResponse.json({ employees: [] });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Unauthorized" },
      { status: 401 }
    );
  }
}