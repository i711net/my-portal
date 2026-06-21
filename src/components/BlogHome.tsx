"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { defaultCategories, getCategoryLabel, type BlogCategory } from "@/lib/categories";
import { defaultHomeLayout, type HomeSection, type HomeSettings } from "@/lib/home-settings";
import { translations, type Language } from "@/lib/i18n";

type HomePost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  updatedDate?: string;
  readTime: string;
  image?: string;
};

export function BlogHome({
  language,
  settings,
  localPosts = [],
}: {
  language: Language;
  settings?: HomeSettings;
  localPosts?: HomePost[];
}) {
  const t = translations[language];
  const [categoryItems, setCategoryItems] = useState<BlogCategory[]>(defaultCategories);
  const [activeCategory, setActiveCategory] = useState("All");
  const [contactState, setContactState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [contactError, setContactError] = useState("");
  const [localTime, setLocalTime] = useState<Date | null>(null);
  const allLatest = localPosts;
  const latest = useMemo(
    () => (activeCategory === "All" ? allLatest : allLatest.filter((post) => post.category === activeCategory)),
    [activeCategory, allLatest],
  );
  const home = {
    headline: settings?.headline ?? t.home.headline,
    intro: settings?.intro ?? t.home.intro,
    startWriting: settings?.startWriting ?? t.home.startWriting,
    browsePosts: settings?.browsePosts ?? t.home.browsePosts,
    latestTitle: settings?.latestTitle ?? t.home.latest,
    contactTitle: settings?.contactTitle ?? t.home.contactTitle,
    contactIntro: settings?.contactIntro ?? t.home.contactIntro,
    contactButton: settings?.contactButton ?? t.home.contactButton,
    friendLinksTitle: settings?.friendLinksTitle ?? t.home.friendLinksTitle,
    friendLinksIntro: settings?.friendLinksIntro ?? t.home.friendLinksIntro,
    friendLinks: settings?.friendLinks ?? [],
    backgroundColor: settings?.backgroundColor || "#ffffff",
    backgroundImage: settings?.backgroundImage || "",
  };
  const layoutOrder = settings?.layoutOrder?.length ? settings.layoutOrder : defaultHomeLayout;
  const visibleFriendLinks = home.friendLinks.filter((item) => item.url.trim() && item.url.trim() !== "https://");
  const backgroundStyle: CSSProperties = {
    backgroundColor: home.backgroundColor,
    backgroundImage: home.backgroundImage
      ? `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.9)), url("${home.backgroundImage}")`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center top",
    backgroundAttachment: "fixed",
  };

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = String(data.get("message") || "").trim();

    if (message.length < 2 || message.length > 200) {
      setContactState("error");
      setContactError(t.home.contactMessageHint);
      return;
    }

    setContactState("sending");
    setContactError("");

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          message,
        }),
      });
      const result = (await response.json()) as { error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(result.detail || result.error || t.home.contactFailed);
      }

      form.reset();
      setContactState("sent");
    } catch (error) {
      setContactState("error");
      setContactError(error instanceof Error ? error.message : t.home.contactFailed);
    }
  }

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/categories", { cache: "no-store" });
        const data = (await response.json()) as { categories?: BlogCategory[] };

        if (data.categories?.length) {
          setCategoryItems(data.categories);

          if (activeCategory !== "All" && !data.categories.some((item) => item.slug === activeCategory)) {
            setActiveCategory("All");
          }
        }
      } catch {
        setCategoryItems(defaultCategories);
      }
    }

    void loadCategories();
  }, [activeCategory]);

  useEffect(() => {
    setLocalTime(new Date());
    const timer = window.setInterval(() => setLocalTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sections: Record<HomeSection, ReactNode> = {
    hero: (
      <section className="container pb-8 pt-6" key="hero">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
              {home.headline}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {home.intro}
            </p>
            <CategoryFilter
              activeCategory={activeCategory}
              categories={categoryItems}
              language={language}
              labels={t.categories}
              onChange={setActiveCategory}
            />
          </div>
          <LocalTimeCard value={localTime} />
        </div>
      </section>
    ),

    latest: (
      <section id="latest" className="container pb-20" key="latest">
        {latest.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((post) => (
              <article key={post.slug} className="home-post-card overflow-hidden rounded-lg bg-white">
                {post.image && (
                  <div className="relative h-28 bg-slate-100">
                    <Image src={post.image} alt="" fill className="object-contain" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{getCategoryLabel(categoryItems, post.category, language)}</p>
                  <Link href={`/posts/${post.slug}`} className="mt-2 block text-lg font-black tracking-tight text-slate-950">
                    {post.title}
                  </Link>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{post.date}</span>
                    <span>{post.readTime}</span>
                  </div>
                  {post.updatedDate && post.updatedDate !== post.date && (
                    <p className="mt-2 text-xs font-semibold text-slate-500">更新于 {post.updatedDate}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-slate-400 bg-white p-10 text-center text-sm font-bold text-slate-500 shadow-sm">
            {t.home.noPosts}
          </div>
        )}
      </section>
    ),

    contact: (
      <section id="contact" className="container pb-20" key="contact">
        <div className="home-post-card grid gap-6 rounded-lg bg-white p-5 md:grid-cols-[0.9fr_1.1fr] md:p-7">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{home.contactTitle}</h2>
            {home.contactIntro && <p className="mt-3 text-base leading-7 text-slate-600">{home.contactIntro}</p>}
            <p className="mt-4 text-sm font-semibold text-slate-500">{t.home.contactMessageHint}</p>
          </div>
          <form className="grid gap-3" onSubmit={submitMessage}>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" name="name" placeholder={t.home.contactName} maxLength={80} />
              <input className="field" name="email" type="email" placeholder={t.home.contactEmail} maxLength={120} />
            </div>
            <textarea className="field min-h-32 resize-y" name="message" placeholder={t.home.contactMessage} maxLength={200} required />
            <button className="button primary w-fit" type="submit" disabled={contactState === "sending"}>
              {contactState === "sending" ? "..." : home.contactButton}
            </button>
            {contactState === "sent" && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700">{t.home.contactSuccess}</p>}
            {contactState === "error" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{contactError || t.home.contactFailed}</p>}
          </form>
        </div>
      </section>
    ),

    friends: (
      <section id="friends" className="container pb-12" key="friends">
        <div className="home-post-card rounded-lg bg-white p-4 md:p-5">
          <div className="mb-3">
            <h2 className="text-xl font-black tracking-tight text-slate-950">{home.friendLinksTitle}</h2>
            {home.friendLinksIntro && <p className="mt-1 text-xs leading-5 text-slate-600">{home.friendLinksIntro}</p>}
          </div>
          {visibleFriendLinks.length ? (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {visibleFriendLinks.map((item) => (
                <a
                  key={item.id}
                  className="min-w-0 rounded-lg border border-slate-300 bg-slate-50 p-3 transition hover:border-blue-500 hover:bg-blue-50"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <p className="truncate text-sm font-black text-slate-950">{item.name || item.url}</p>
                  {item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.description}</p>}
                  <p className="mt-2 truncate text-[11px] font-bold text-blue-700">{item.url}</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">{t.home.noFriendLinks}</p>
          )}
        </div>
      </section>
    ),
  };

  return (
    <main className="min-h-screen" style={backgroundStyle}>
      {layoutOrder.map((section) => sections[section]).filter(Boolean)}
    </main>
  );
}

function CategoryFilter({
  activeCategory,
  categories,
  language,
  labels,
  onChange,
}: {
  activeCategory: string;
  categories: BlogCategory[];
  language: Language;
  labels: typeof translations["zh"]["categories"];
  onChange: (category: string) => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {["All", ...categories.map((category) => category.slug)].map((category) => (
        <button
          key={category}
          className={`rounded-full border px-4 py-2 text-sm font-bold shadow-sm ${
            activeCategory === category ? "border-blue-700 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
          type="button"
          onClick={() => onChange(category)}
        >
          {category === "All" ? labels.All : getCategoryLabel(categories, category, language)}
        </button>
      ))}
    </div>
  );
}

function LocalTimeCard({ value }: { value: Date | null }) {
  const display = value
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(value)
    : "--/--/-- --:--:--";
  const timezone = value ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  return (
    <aside className="home-post-card rounded-lg bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Local Time</p>
      <p className="mt-3 text-2xl font-black tabular-nums tracking-tight text-slate-950">{display}</p>
      {timezone && <p className="mt-2 text-sm font-semibold text-slate-500">{timezone}</p>}
    </aside>
  );
}
