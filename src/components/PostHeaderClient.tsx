"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { defaultCategories, getCategoryLabel, type BlogCategory } from "@/lib/categories";
import { translations, type Language } from "@/lib/i18n";

type PostHeaderClientProps = {
  title: string;
  excerpt: string;
  category: string;
  date: string;
  updatedDate?: string;
  readTime: string;
};

function getStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return "zh";
  }

  const saved = window.localStorage.getItem("my-blog-language");
  return saved === "en" || saved === "ko" || saved === "zh" ? saved : "zh";
}

function formatReadTime(value: string, language: Language) {
  const minutes = Number(value.match(/\d+/)?.[0] || 1);

  if (language === "en") {
    return `${minutes} min read`;
  }

  if (language === "ko") {
    return `${minutes}분 읽기`;
  }

  return `${minutes} 分钟阅读`;
}

export function PostHeaderClient({ title, excerpt, category, date, updatedDate, readTime }: PostHeaderClientProps) {
  const [language, setLanguage] = useState<Language>("zh");
  const [categories, setCategories] = useState<BlogCategory[]>(defaultCategories);

  useEffect(() => {
    const nextLanguage = getStoredLanguage();
    setLanguage(nextLanguage);

    async function loadCategories() {
      try {
        const response = await fetch("/api/categories", { cache: "no-store" });
        const data = (await response.json()) as { categories?: BlogCategory[] };

        if (response.ok && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      } catch {
        setCategories(defaultCategories);
      }
    }

    void loadCategories();
  }, []);

  const copy = translations[language].post;
  const categoryLabel = useMemo(() => getCategoryLabel(categories, category, language), [categories, category, language]);

  return (
    <>
      <Link href="/" className="text-sm font-bold text-blue-700">
        {copy.backHome}
      </Link>
      <article className="mx-auto mt-8 max-w-3xl">
        <p className="text-sm font-bold text-blue-700">{categoryLabel}</p>
        <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">{title}</h1>
        {excerpt && <p className="mt-5 text-lg leading-8 text-slate-600">{excerpt}</p>}
        <div className="mt-7 flex gap-3 text-sm font-semibold text-slate-500">
          <span>{date}</span>
          <span>/</span>
          <span>{formatReadTime(readTime, language)}</span>
        </div>
        {updatedDate && updatedDate !== date && <p className="mt-2 text-sm font-semibold text-slate-500">{copy.updatedAt} {updatedDate}</p>}
      </article>
    </>
  );
}
