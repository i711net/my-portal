import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function hasValue(name: string) {
  return Boolean(process.env[name]?.trim());
}

function mask(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 12) {
    return `${trimmed.slice(0, 4)}...`;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

export async function GET() {
  const env = {
    SUPABASE_URL: hasValue("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: hasValue("SUPABASE_SERVICE_ROLE_KEY"),
    ADMIN_UPLOAD_TOKEN: hasValue("ADMIN_UPLOAD_TOKEN"),
  };

  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("posts")
      .select("slug", { count: "exact", head: true })
      .eq("status", "Published");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          env,
          values: {
            SUPABASE_URL: mask(process.env.SUPABASE_URL),
          },
          error: "Supabase connected, but the posts table query failed.",
          detail: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      env,
      values: {
        SUPABASE_URL: mask(process.env.SUPABASE_URL),
      },
      publishedPosts: count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        env,
        values: {
          SUPABASE_URL: mask(process.env.SUPABASE_URL),
        },
        error: "Supabase is not configured.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
