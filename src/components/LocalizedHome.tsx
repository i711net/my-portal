"use client";

import { useEffect, useState } from "react";
import { PortalHome } from "@/components/PortalHome";
import { SiteHeader } from "@/components/SiteHeader";
import { mergeHomeSettings, type HomeSettings } from "@/lib/home-settings";
import type { Language } from "@/lib/i18n";
import type { PublicPost } from "@/lib/blog-db";

export function LocalizedHome() {
  const [language, setLanguage] = useState<Language>("zh");
  const [localPosts, setLocalPosts] = useState<PublicPost[]>([]);
  const [homeSettings, setHomeSettings] = useState<HomeSettings>(() => mergeHomeSettings("zh"));
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    let activeLanguage: Language = "zh";
    const saved = window.localStorage.getItem("my-blog-language");

    if (saved === "en" || saved === "zh" || saved === "ko") {
      activeLanguage = saved;
      setLanguage(saved);
    }

    void loadHomeData(activeLanguage);
  }, []);

  async function loadHomeData(activeLanguage: Language) {
    const settings = window.localStorage.getItem("my-blog-home-settings");

    if (!isBooting && settings) {
      try {
        const parsed = JSON.parse(settings) as Partial<Record<Language, Partial<HomeSettings>>>;
        setHomeSettings(mergeHomeSettings(activeLanguage, parsed[activeLanguage]));
      } catch {
        setHomeSettings(mergeHomeSettings(activeLanguage));
      }
    } else {
      setHomeSettings(mergeHomeSettings(activeLanguage));
    }

    if (!isBooting) {
      setLocalPosts(getLocalPublishedPosts());
    }

    try {
      const [settingsResponse, postsResponse] = await Promise.all([
        fetch(`/api/home-settings?language=${activeLanguage}`, { cache: "no-store" }),
        fetch("/api/posts", { cache: "no-store" }),
      ]);

      if (settingsResponse.ok) {
        const data = (await settingsResponse.json()) as { settings?: HomeSettings };

        if (data.settings) {
          setHomeSettings(mergeHomeSettings(activeLanguage, data.settings));
        }
      }

      if (postsResponse.ok) {
        const data = (await postsResponse.json()) as { posts?: PublicPost[] };

        if (data.posts) {
          setLocalPosts(data.posts);
        }
      }
    } catch {
      setLocalPosts(getLocalPublishedPosts());
    } finally {
      setIsBooting(false);
    }
  }

  function getLocalPublishedPosts() {
    const published = window.localStorage.getItem("my-blog-published-posts");

    if (!published) {
      return [];
    }

    try {
      const drafts = JSON.parse(published) as Array<{
        slug: string;
        title: string;
        excerpt: string;
        category: string;
        coverUrl: string;
        richText?: string;
        updatedAt: string;
      }>;

      return drafts.map((draft) => ({
        slug: draft.slug,
        title: draft.title,
        excerpt: draft.excerpt || draft.richText?.slice(0, 140) || "",
        category: draft.category || "Publishing",
        date: draft.updatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        updatedDate: draft.updatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        readTime: "Local draft",
        image: draft.coverUrl || undefined,
        coverUrl: draft.coverUrl || "",
        tags: "",
        richContent: "",
        richText: draft.richText || "",
        blocks: [],
      }));
    } catch {
      return [];
    }
  }

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("my-blog-language", nextLanguage);
    void loadHomeData(nextLanguage);
  }

  return (
    <div className="page-shell">
      <SiteHeader
        language={language}
        siteName={homeSettings.siteName && homeSettings.siteName !== "MY Blog" ? homeSettings.siteName : "MY Portal"}
        marqueeText={homeSettings.marqueeText}
        marqueeItems={homeSettings.marqueeItems}
        marqueeSpeed={homeSettings.marqueeSpeed}
        marqueeGap={homeSettings.marqueeGap}
        onLanguageChange={changeLanguage}
      />
      {isBooting ? <HomeBootScreen /> : <PortalHome language={language} posts={localPosts} />}
    </div>
  );
}

function HomeBootScreen() {
  return (
    <main className="container pb-20 pt-12">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-5 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-44 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
    </main>
  );
}
