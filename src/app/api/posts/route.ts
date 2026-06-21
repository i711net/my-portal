import { NextResponse } from "next/server";
import { rowToPublicPost, type BlogPostRecord } from "@/lib/blog-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_UPLOAD_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(expected && received && expected === received);
}

function isDeleteAuthorized(request: Request, deleteToken: string) {
  const expected = (process.env.ADMIN_DELETE_TOKEN || process.env.ADMIN_UPLOAD_TOKEN)?.trim();
  const received = deleteToken || request.headers.get("x-delete-token")?.trim();

  return Boolean(expected && received && expected === received);
}

function rowToAdminPost(row: BlogPostRecord) {
  return {
    ...rowToPublicPost(row),
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function makeFallbackSlug() {
  return `post-${Date.now().toString(36)}`;
}

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const adminMode = url.searchParams.get("admin") === "1";

    if (adminMode && !isAdmin(request)) {
      return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
    }

    let query = supabase.from("posts").select("*");

    if (!adminMode) {
      query = query.eq("status", "Published").order("published_at", { ascending: false });
    } else {
      query = query.order("updated_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Could not load posts.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({
      posts: ((data ?? []) as BlogPostRecord[]).map((row) => (adminMode ? rowToAdminPost(row) : rowToPublicPost(row))),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Supabase is not configured.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const slug = String(body.slug || url.searchParams.get("slug") || "").trim();

    if (!slug) {
      return NextResponse.json({ error: "Slug is required." }, { status: 400 });
    }

    if (!isDeleteAuthorized(request, String(body.deleteToken || "").trim())) {
      return NextResponse.json({ error: "Delete password is missing or incorrect." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("posts").delete().eq("slug", slug);

    if (error) {
      return NextResponse.json({ error: "Could not delete post.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true, slug });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not delete post.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Admin token is missing or incorrect." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const status = body.status === "Draft" ? "Draft" : "Published";
    const slug = sanitizeSlug(String(body.slug || body.title || "")) || makeFallbackSlug();

    if (!slug || !body.title) {
      return NextResponse.json({ error: "Title and slug are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingPost } = await supabase.from("posts").select("status,published_at").eq("slug", slug).maybeSingle();
    const existingPublishedAt =
      existingPost?.status === "Published" && typeof existingPost.published_at === "string" ? existingPost.published_at : null;

    const row = {
      slug,
      title: String(body.title),
      excerpt: String(body.excerpt || ""),
      category: String(body.category || "Publishing"),
      tags: String(body.tags || ""),
      cover_url: String(body.coverUrl || ""),
      status,
      rich_content: String(body.richContent || ""),
      rich_text: String(body.richText || ""),
      blocks: Array.isArray(body.blocks) ? body.blocks : [],
      published_at: status === "Published" ? existingPublishedAt || now : null,
      updated_at: now,
    };

    const { data, error } = await supabase.from("posts").upsert(row, { onConflict: "slug" }).select("*").single();

    if (error) {
      return NextResponse.json({ error: "Could not save post.", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: rowToPublicPost(data as BlogPostRecord) });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not save post.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
