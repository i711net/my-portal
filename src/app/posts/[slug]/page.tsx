import Image from "next/image";
import { notFound } from "next/navigation";
import { posts } from "@/lib/posts";
import { SiteHeader } from "@/components/SiteHeader";
import { PostHeaderClient } from "@/components/PostHeaderClient";
import { rowToPublicPost, type BlogPostRecord, type ContentBlock } from "@/lib/blog-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugCandidates = getSlugCandidates(slug);
  const databasePost = await getDatabasePost(slugCandidates);
  const staticPost = posts.find((item) => slugCandidates.includes(item.slug));
  const post = databasePost ?? staticPost;

  if (!post) {
    notFound();
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="container pb-20 pt-8">
        <PostHeaderClient
          title={post.title}
          excerpt={post.excerpt}
          category={post.category}
          date={post.date}
          updatedDate={"updatedDate" in post ? post.updatedDate : undefined}
          readTime={post.readTime}
        />
      {post.image && (
        <div className="relative mx-auto mt-10 h-[420px] max-w-5xl overflow-hidden rounded-lg">
          <Image src={post.image} alt="" fill priority className="object-cover" sizes="100vw" />
        </div>
      )}
      <article className="mx-auto mt-10 max-w-3xl space-y-6 text-lg leading-8 text-slate-700">
        {"richContent" in post && post.richContent ? (
          <div className="prose-editor" dangerouslySetInnerHTML={{ __html: post.richContent }} />
        ) : null}
        {"blocks" in post && post.blocks?.map((block) => <PostBlock key={block.id} block={block} />)}
      </article>
      </main>
    </div>
  );
}

function getSlugCandidates(slug: string) {
  const values = [slug];

  try {
    values.push(decodeURIComponent(slug));
  } catch {
    // Keep the original slug when decoding is not possible.
  }

  try {
    values.push(encodeURIComponent(slug));
  } catch {
    // Keep the original slug when encoding is not possible.
  }

  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function getDatabasePost(slugCandidates: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .in("slug", slugCandidates)
      .eq("status", "Published")
      .limit(1);

    if (error || !data?.length) {
      return null;
    }

    return rowToPublicPost(data[0] as BlogPostRecord);
  } catch {
    return null;
  }
}

function PostBlock({ block }: { block: ContentBlock }) {
  if (block.type === "heading") {
    return <h2 className="text-3xl font-black tracking-tight text-slate-950">{block.content}</h2>;
  }

  if (block.type === "image") {
    return (
      <figure>
        {block.url && <img className="max-h-[520px] w-full rounded-lg object-cover" src={block.url} alt={block.caption ?? ""} />}
        {block.caption && <figcaption className="mt-2 text-sm text-slate-500">{block.caption}</figcaption>}
      </figure>
    );
  }

  if (block.type === "video") {
    return (
      <figure>
        {block.url && <video className="w-full rounded-lg bg-slate-950" src={block.url} controls />}
        {block.caption && <figcaption className="mt-2 text-sm text-slate-500">{block.caption}</figcaption>}
      </figure>
    );
  }

  if (block.type === "audio") {
    return (
      <figure className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        {block.url && <audio className="w-full" src={block.url} controls />}
        {block.caption && <figcaption className="mt-2 text-sm text-slate-500">{block.caption}</figcaption>}
      </figure>
    );
  }

  if (block.type === "link") {
    return (
      <a className="block rounded-lg border border-blue-200 bg-blue-50 p-4 font-bold text-blue-700" href={block.url} target="_blank" rel="noreferrer">
        {block.content || block.url}
      </a>
    );
  }

  if (block.type === "quote") {
    return <blockquote className="border-l-4 border-blue-600 pl-5 text-xl font-semibold leading-8 text-slate-700">{block.content}</blockquote>;
  }

  if (block.type === "code") {
    return <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">{block.content}</pre>;
  }

  return <p>{block.content}</p>;
}
