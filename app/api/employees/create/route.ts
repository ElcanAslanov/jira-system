import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toNull(v: FormDataEntryValue | null) {
  if (!v) return null;
  const value = String(v).trim();
  return value === "" ? null : value;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const ad = String(formData.get("ad") || "");
    const soyad = String(formData.get("soyad") || "");
    const ata_adi = String(formData.get("ata_adi") || "");
    const elaqe_nomresi = String(formData.get("elaqe_nomresi") || "");

    const company_id = toNull(formData.get("company_id"));
    const department_id = toNull(formData.get("department_id"));
    const position_id = toNull(formData.get("position_id"));
    const role_id = toNull(formData.get("role_id"));

    const guide_ids = formData.getAll("guide_ids");

    if (!email || !password || !ad || !soyad) {
      return NextResponse.json(
        { error: "Zəruri məlumatlar boşdur" },
        { status: 400 }
      );
    }

    /* 1️⃣ Auth create */
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (userError) {
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      );
    }

    /* 2️⃣ Employees insert */
    const { data: employeeData, error: employeeError } =
      await supabaseAdmin
        .from("employees")
        .insert({
          user_id: userData.user.id,
          email,
          ad,
          soyad,
          ata_adi,
          elaqe_nomresi,
          company_id,
          department_id,
          position_id,
          role_id,
        })
        .select()
        .single();

    if (employeeError) {
      return NextResponse.json(
        { error: employeeError.message },
        { status: 400 }
      );
    }

    /* 3️⃣ Rehber insert */
    if (guide_ids.length > 0) {
      const guidesToInsert = guide_ids
        .map((g) => String(g))
        .filter(Boolean)
        .map((guideId) => ({
          employee_id: employeeData.id,
          guide_id: guideId,
        }));

      if (guidesToInsert.length > 0) {
        const { error: guideError } = await supabaseAdmin
          .from("employee_guides")
          .insert(guidesToInsert);

        if (guideError) {
          console.error("Guide insert error:", guideError);
          return NextResponse.json(
            { error: guideError.message },
            { status: 400 }
          );
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("SERVER ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Server xətası" },
      { status: 500 }
    );
  }
}