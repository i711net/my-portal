import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;
const LOCK_MS = 10 * 60 * 1000;

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || realIp || vercelIp || "unknown";
}

function isPasswordCorrect(value: string) {
  const expected = process.env.ADMIN_UPLOAD_TOKEN?.trim();
  return Boolean(expected && value && value === expected);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const token = String(body.token || "").trim();
    const ipAddress = getClientIp(request);
    const supabase = getSupabaseAdmin();
    const now = Date.now();

    const { data: existing } = await supabase.from("admin_login_attempts").select("*").eq("ip_address", ipAddress).maybeSingle();
    const lockedUntil = existing?.locked_until ? new Date(existing.locked_until).getTime() : 0;

    if (lockedUntil > now) {
      return NextResponse.json(
        {
          ok: false,
          locked: true,
          lockedUntil: existing.locked_until,
          remainingAttempts: 0,
        },
        { status: 429 },
      );
    }

    if (isPasswordCorrect(token)) {
      await supabase.from("admin_login_attempts").delete().eq("ip_address", ipAddress);
      return NextResponse.json({ ok: true });
    }

    const attempts = Number(existing?.attempts || 0) + 1;
    const shouldLock = attempts >= MAX_ATTEMPTS;
    const nextLockedUntil = shouldLock ? new Date(now + LOCK_MS).toISOString() : null;

    await supabase.from("admin_login_attempts").upsert(
      {
        ip_address: ipAddress,
        attempts,
        locked_until: nextLockedUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ip_address" },
    );

    return NextResponse.json(
      {
        ok: false,
        locked: shouldLock,
        lockedUntil: nextLockedUntil,
        remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempts),
      },
      { status: shouldLock ? 429 : 401 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Could not check admin login.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
