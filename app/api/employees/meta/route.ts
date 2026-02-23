import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const [
      companiesRes,
      departmentsRes,
      positionsRes,
      rolesRes,
      guidesRes,
    ] = await Promise.all([
      supabase.from("companies").select("id,name").order("name"),
      supabase.from("departments").select("id,name,company_id").order("name"),
      supabase.from("positions").select("id,name").order("name"),
      supabase.from("roles").select("id,name").order("name"),

      // 🔥 Yalnız REHBER rolunda olan employees
      supabase
        .from("employees")
        .select(`
          id,
          ad,
          soyad,
          roles(name)
        `)
        .eq("roles.name", "REHBER"),
    ]);

    if (
      companiesRes.error ||
      departmentsRes.error ||
      positionsRes.error ||
      rolesRes.error ||
      guidesRes.error
    ) {
      throw new Error("Meta məlumatlar yüklənmədi");
    }

    return NextResponse.json({
      companies: companiesRes.data ?? [],
      departments: departmentsRes.data ?? [],
      positions: positionsRes.data ?? [],
      roles: rolesRes.data ?? [],

      // 🔥 Ad + soyad backend-də birləşdirilir
      guides:
        guidesRes.data?.map((g) => ({
          id: g.id,
          name: `${g.ad ?? ""} ${g.soyad ?? ""}`.trim(),
        })) ?? [],
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Meta xətası" },
      { status: 500 }
    );
  }
}