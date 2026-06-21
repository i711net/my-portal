import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_UPLOAD_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(expected && received && expected === received);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("site_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: "Could not load messages.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not load messages.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = normalizeText(body.name).slice(0, 80);
    const email = normalizeText(body.email).slice(0, 120);
    const message = normalizeText(body.message);

    if (message.length < 2 || message.length > 200) {
      return NextResponse.json({ error: "Message must be 2-200 characters." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("site_messages").insert({
      name,
      email,
      message,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: "Could not save message.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not save message.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const id = normalizeText(body.id);

    if (!id) {
      return NextResponse.json({ error: "Message id is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("site_messages").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Could not delete message.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not delete message.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
