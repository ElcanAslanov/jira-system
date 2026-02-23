import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cleanName(v: unknown) {
  return String(v ?? "").trim();
}

// GET /api/companies  -> list
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id,name,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ companies: data ?? [] });
}

// POST /api/companies -> create
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = cleanName(body?.name);

    if (!name) {
      return NextResponse.json({ error: "Şirkət adı boş ola bilməz" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("companies")
      .insert({ name })
      .select("id,name,created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server xətası" }, { status: 500 });
  }
}

// PUT /api/companies -> update
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || "");
    const name = cleanName(body?.name);

    if (!id) {
      return NextResponse.json({ error: "ID tapılmadı" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Şirkət adı boş ola bilməz" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("companies")
      .update({ name })
      .eq("id", id)
      .select("id,name,created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server xətası" }, { status: 500 });
  }
}

// DELETE /api/companies?id=... -> delete
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "");

  if (!id) {
    return NextResponse.json({ error: "ID tapılmadı" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("companies").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
