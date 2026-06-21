"use client";

import { useEffect, useState } from "react";
import { BlogHome } from "@/components/BlogHome";
import { SiteHeader } from "@/components/SiteHeader";
import { mergeHomeSettings, type HomeSettings } from "@/lib/home-settings";
import type { PublicPost } from "@/lib/blog-db";
import type { Language } from "@/lib/i18n";

export function LocalizedBlogHome() {
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
    } finally {
      setIsBooting(false);
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
        siteName={homeSettings.siteName}
        marqueeText={homeSettings.marqueeText}
        marqueeItems={homeSettings.marqueeItems}
        marqueeSpeed={homeSettings.marqueeSpeed}
        marqueeGap={homeSettings.marqueeGap}
        onLanguageChange={changeLanguage}
      />
      {isBooting ? <BlogBootScreen /> : <BlogHome language={language} settings={homeSettings} localPosts={localPosts} />}
    </div>
  );
}

function BlogBootScreen() {
  return (
    <main className="container pb-20 pt-12">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-5 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-44 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
    </main>
  );
}
