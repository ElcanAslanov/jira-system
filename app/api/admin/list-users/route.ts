import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // 1️⃣ Auth users
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const authUsers = data.users;

    // 2️⃣ Employees cədvəli (ad, soyad)
    const { data: employees } = await supabaseAdmin
      .from("employees")
      .select("user_id, ad, soyad");

    // 3️⃣ Merge
    const merged = authUsers.map((user) => {
      const employee = employees?.find(
        (e) => e.user_id === user.id
      );

      return {
        id: user.id,
        email: user.email,
        ad: employee?.ad || "-",
        soyad: employee?.soyad || "-",
      };
    });

    return NextResponse.json({ users: merged });

  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}