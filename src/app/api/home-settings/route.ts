import { NextResponse } from "next/server";
import { homeSettingsToRow, rowToHomeSettings, type HomeSettingsRow } from "@/lib/blog-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { HomeSettings } from "@/lib/home-settings";
import type { Language } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getLanguage(value: string | null): Language {
  return value === "en" || value === "ko" || value === "zh" ? value : "zh";
}

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_UPLOAD_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(expected && received && expected === received);
}

function hasMissingHomeSettingsColumns(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes("layout_order") ||
      error?.message?.includes("contact_") ||
      error?.message?.includes("background_") ||
      error?.message?.includes("friend_links") ||
      error?.message?.includes("marquee_"),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const language = getLanguage(url.searchParams.get("language"));

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("home_settings").select("*").eq("language", language).maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Could not load home settings.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: rowToHomeSettings(language, data as HomeSettingsRow | null) });
  } catch (error) {
    return NextResponse.json(
      { error: "Supabase is not configured.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { language?: Language; settings?: HomeSettings };
    const language = getLanguage(body.language ?? null);
    const settings = body.settings;

    if (!settings) {
      return NextResponse.json({ error: "Home settings are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const row = homeSettingsToRow(language, settings);
    let { data, error } = await supabase
      .from("home_settings")
      .upsert(row, { onConflict: "language" })
      .select("*")
      .single();

    if (hasMissingHomeSettingsColumns(error)) {
      const {
        layout_order: _layoutOrder,
        marquee_items: _marqueeItems,
        marquee_speed: _marqueeSpeed,
        marquee_gap: _marqueeGap,
        contact_title: _contactTitle,
        contact_intro: _contactIntro,
        contact_button: _contactButton,
        friend_links_title: _friendLinksTitle,
        friend_links_intro: _friendLinksIntro,
        friend_links: _friendLinks,
        background_color: _backgroundColor,
        background_image: _backgroundImage,
        ...legacyRow
      } = row;
      const retry = await supabase
        .from("home_settings")
        .upsert(legacyRow, { onConflict: "language" })
        .select("*")
        .single();

      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: "Could not save home settings.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: rowToHomeSettings(language, { ...((data as HomeSettingsRow | null) ?? {}), ...row }) });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not save home settings.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
