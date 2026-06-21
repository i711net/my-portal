import { mergeHomeSettings, type HomeSettings } from "@/lib/home-settings";
import type { Language } from "@/lib/i18n";

export type ContentBlock = {
  id: string;
  type: "paragraph" | "heading" | "image" | "video" | "audio" | "link" | "quote" | "code";
  content: string;
  url?: string;
  caption?: string;
};

export type BlogPostRecord = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  tags: string | null;
  cover_url: string | null;
  status: "Draft" | "Published";
  rich_content: string | null;
  rich_text: string | null;
  blocks: ContentBlock[] | null;
  published_at: string | null;
  updated_at: string;
};

export type PublicPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  updatedDate: string;
  readTime: string;
  image?: string;
  coverUrl: string;
  tags: string;
  richContent: string;
  richText: string;
  blocks: ContentBlock[];
};

export function rowToPublicPost(row: BlogPostRecord): PublicPost {
  const text = row.rich_text || row.excerpt || "";
  const minutes = Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 220));
  const date = (row.published_at || row.updated_at || new Date().toISOString()).slice(0, 10);
  const updatedDate = (row.updated_at || row.published_at || new Date().toISOString()).slice(0, 10);
  const image = row.cover_url || "";

  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || text.slice(0, 140),
    category: row.category || "Publishing",
    date,
    updatedDate,
    readTime: `${minutes} min read`,
    image: image || undefined,
    coverUrl: image,
    tags: row.tags || "",
    richContent: row.rich_content || "",
    richText: row.rich_text || "",
    blocks: row.blocks || [],
  };
}

export type HomeSettingsRow = {
  language: Language;
  site_name: string;
  marquee_text?: string | null;
  marquee_items?: HomeSettings["marqueeItems"] | null;
  marquee_speed?: number | null;
  marquee_gap?: number | null;
  headline: string;
  intro: string;
  start_writing: string;
  browse_posts: string;
  featured_title: string;
  latest_title: string;
  seo_title: string;
  seo_description: string;
  contact_title?: string | null;
  contact_intro?: string | null;
  contact_button?: string | null;
  friend_links_title?: string | null;
  friend_links_intro?: string | null;
  friend_links?: HomeSettings["friendLinks"] | null;
  background_color?: string | null;
  background_image?: string | null;
  layout_order?: HomeSettings["layoutOrder"] | null;
};

export function rowToHomeSettings(language: Language, row?: Partial<HomeSettingsRow> | null): HomeSettings {
  return mergeHomeSettings(language, {
    siteName: row?.site_name,
    marqueeText: row?.marquee_text ?? undefined,
    marqueeItems: row?.marquee_items ?? undefined,
    marqueeSpeed: row?.marquee_speed ?? undefined,
    marqueeGap: row?.marquee_gap ?? undefined,
    headline: row?.headline,
    intro: row?.intro,
    startWriting: row?.start_writing,
    browsePosts: row?.browse_posts,
    featuredTitle: row?.featured_title,
    latestTitle: row?.latest_title,
    seoTitle: row?.seo_title,
    seoDescription: row?.seo_description,
    contactTitle: row?.contact_title ?? undefined,
    contactIntro: row?.contact_intro ?? undefined,
    contactButton: row?.contact_button ?? undefined,
    friendLinksTitle: row?.friend_links_title ?? undefined,
    friendLinksIntro: row?.friend_links_intro ?? undefined,
    friendLinks: row?.friend_links ?? undefined,
    backgroundColor: row?.background_color ?? undefined,
    backgroundImage: row?.background_image ?? undefined,
    layoutOrder: row?.layout_order ?? undefined,
  });
}

function textOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export function homeSettingsToRow(language: Language, settings: Partial<HomeSettings>) {
  const defaults = mergeHomeSettings(language);

  return {
    language,
    site_name: textOrDefault(settings.siteName, defaults.siteName),
    marquee_text: textOrDefault(settings.marqueeText, defaults.marqueeText),
    marquee_items: Array.isArray(settings.marqueeItems) ? settings.marqueeItems : defaults.marqueeItems,
    marquee_speed: typeof settings.marqueeSpeed === "number" ? settings.marqueeSpeed : defaults.marqueeSpeed,
    marquee_gap: typeof settings.marqueeGap === "number" ? settings.marqueeGap : defaults.marqueeGap,
    headline: textOrDefault(settings.headline, defaults.headline),
    intro: textOrDefault(settings.intro, defaults.intro),
    start_writing: textOrDefault(settings.startWriting, defaults.startWriting),
    browse_posts: textOrDefault(settings.browsePosts, defaults.browsePosts),
    featured_title: textOrDefault(settings.featuredTitle, defaults.featuredTitle),
    latest_title: textOrDefault(settings.latestTitle, defaults.latestTitle),
    seo_title: textOrDefault(settings.seoTitle, defaults.seoTitle),
    seo_description: textOrDefault(settings.seoDescription, defaults.seoDescription),
    contact_title: textOrDefault(settings.contactTitle, defaults.contactTitle),
    contact_intro: textOrDefault(settings.contactIntro, defaults.contactIntro),
    contact_button: textOrDefault(settings.contactButton, defaults.contactButton),
    friend_links_title: textOrDefault(settings.friendLinksTitle, defaults.friendLinksTitle),
    friend_links_intro: textOrDefault(settings.friendLinksIntro, defaults.friendLinksIntro),
    friend_links: Array.isArray(settings.friendLinks) ? settings.friendLinks : defaults.friendLinks,
    background_color: textOrDefault(settings.backgroundColor, defaults.backgroundColor),
    background_image: textOrDefault(settings.backgroundImage, defaults.backgroundImage),
    layout_order: Array.isArray(settings.layoutOrder) && settings.layoutOrder.length ? settings.layoutOrder : defaults.layoutOrder,
    updated_at: new Date().toISOString(),
  };
}
