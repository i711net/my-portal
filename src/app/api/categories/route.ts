import { NextResponse } from "next/server";
import { defaultCategories, type BlogCategory } from "@/lib/categories";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_UPLOAD_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(expected && received && expected === received);
}

function normalizeCategories(items: BlogCategory[]) {
  return items
    .map((item, index) => ({
      slug: item.slug.trim(),
      labels: {
        en: item.labels.en.trim() || item.slug.trim(),
        zh: item.labels.zh.trim() || item.labels.en.trim() || item.slug.trim(),
        ko: item.labels.ko.trim() || item.labels.en.trim() || item.slug.trim(),
      },
      sort_order: index,
    }))
    .filter((item) => item.slug);
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const adminMode = url.searchParams.get("admin") === "1";

    if (adminMode && !isAdmin(request)) {
      return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
    }

    const { data, error } = await supabase.from("blog_categories").select("*").order("sort_order", { ascending: true });

    if (error) {
      if (adminMode) {
        return NextResponse.json(
          {
            error: "Category table is not ready.",
            detail: error.message,
            hint: "Run supabase/schema.sql in Supabase SQL Editor, then redeploy or refresh.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({ categories: defaultCategories, fallback: true, detail: error.message });
    }

    const categories = (data ?? []).map((item) => ({
      slug: String(item.slug),
      labels: {
        en: String(item.label_en || item.slug),
        zh: String(item.label_zh || item.label_en || item.slug),
        ko: String(item.label_ko || item.label_en || item.slug),
      },
    }));

    return NextResponse.json({ categories: categories.length ? categories : defaultCategories });
  } catch (error) {
    return NextResponse.json({
      categories: defaultCategories,
      fallback: true,
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { categories?: BlogCategory[] };
    const rows = normalizeCategories(body.categories ?? []);

    if (!rows.length) {
      return NextResponse.json({ error: "At least one category is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error: deleteError } = await supabase.from("blog_categories").delete().neq("slug", "");

    if (deleteError) {
      return NextResponse.json({ error: "Could not clear categories.", detail: deleteError.message }, { status: 500 });
    }

    const { error } = await supabase.from("blog_categories").insert(
      rows.map((item) => ({
        slug: item.slug,
        label_en: item.labels.en,
        label_zh: item.labels.zh,
        label_ko: item.labels.ko,
        sort_order: item.sort_order,
      })),
    );

    if (error) {
      return NextResponse.json({ error: "Could not save categories.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: rows.map(({ slug, labels }) => ({ slug, labels })) });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not save categories.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
