import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function clean(v: unknown) {
  return String(v ?? "").trim();
}

// GET
export async function GET() {
  const { data, error } = await supabase
    .from("departments")
    .select("id,name,company_id,companies(name)")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ departments: data ?? [] });
}

// POST
export async function POST(req: Request) {
  const body = await req.json();
  const name = clean(body?.name);
  const company_id = clean(body?.company_id);

  if (!name || !company_id) {
    return NextResponse.json(
      { error: "Ad və şirkət seçimi məcburidir" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("departments")
    .insert({ name, company_id })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ department: data });
}

// PUT
export async function PUT(req: Request) {
  const body = await req.json();
  const id = clean(body?.id);
  const name = clean(body?.name);
  const company_id = clean(body?.company_id);

  if (!id || !name || !company_id) {
    return NextResponse.json(
      { error: "Məlumat natamamdır" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("departments")
    .update({ name, company_id })
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ department: data });
}

// DELETE
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id)
    return NextResponse.json({ error: "ID tapılmadı" }, { status: 400 });

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
