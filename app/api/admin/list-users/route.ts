import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const pageSizeRaw = Number(searchParams.get("pageSize") || 10);
    const pageSize = Math.min(Math.max(pageSizeRaw, 5), 100);

    const search = (searchParams.get("search") || "").trim().toLowerCase();

    /*
      Supabase auth.admin.listUsers pagination:
      page starts from 1.
      perPage controls how many auth users are returned.
    */
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const authUsers = data.users || [];
    const userIds = authUsers.map((user) => user.id);

    let employeeMap = new Map<
      string,
      {
        user_id: string;
        ad: string | null;
        soyad: string | null;
      }
    >();

    if (userIds.length > 0) {
      const { data: employees, error: empError } = await supabaseAdmin
        .from("employees")
        .select("user_id, ad, soyad")
        .in("user_id", userIds);

      if (empError) {
        return NextResponse.json({ error: empError.message }, { status: 400 });
      }

      employeeMap = new Map(
        (employees || []).map((employee) => [employee.user_id, employee])
      );
    }

    let users = authUsers.map((user) => {
      const employee = employeeMap.get(user.id);

      return {
        id: user.id,
        email: user.email || "-",
        ad: employee?.ad || "-",
        soyad: employee?.soyad || "-",
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      };
    });

    /*
      Qeyd:
      Auth users üzərində server-side global search Supabase Auth API ilə tam ideal deyil.
      Bu search cari səhifənin nəticələrində işləyir.
      Əgər global search lazımdırsa, users-i employees/profiles cədvəlindən idarə etmək daha düzgündür.
    */
    if (search) {
      users = users.filter((user) => {
        const full = `${user.ad} ${user.soyad} ${user.email}`.toLowerCase();
        return full.includes(search);
      });
    }

    const hasMore = authUsers.length === pageSize;

    return NextResponse.json({
      users,
      page,
      pageSize,
      count: users.length,
      hasMore,
    });
  } catch (err) {
    console.error("List users error:", err);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}