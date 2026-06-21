"use client";

import { useEffect, useState } from "react";
import { AdminStudio } from "@/components/AdminStudio";
import { SiteHeader } from "@/components/SiteHeader";
import { mergeHomeSettings, type HomeSettings } from "@/lib/home-settings";
import type { Language } from "@/lib/i18n";

export function LocalizedAdmin() {
  const [language, setLanguage] = useState<Language>("zh");
  const [homeSettings, setHomeSettings] = useState<HomeSettings>(() => mergeHomeSettings("zh"));

  useEffect(() => {
    const saved = window.localStorage.getItem("my-blog-language");

    if (saved === "en" || saved === "zh" || saved === "ko") {
      setLanguage(saved);
    }

    const settings = window.localStorage.getItem("my-blog-home-settings");

    if (settings) {
      try {
        const parsed = JSON.parse(settings) as Partial<Record<Language, Partial<HomeSettings>>>;
        setHomeSettings(mergeHomeSettings((saved as Language) || "zh", parsed[(saved as Language) || "zh"]));
      } catch {
        setHomeSettings(mergeHomeSettings((saved as Language) || "zh"));
      }
    }
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("my-blog-language", nextLanguage);

    const settings = window.localStorage.getItem("my-blog-home-settings");

    if (settings) {
      try {
        const parsed = JSON.parse(settings) as Partial<Record<Language, Partial<HomeSettings>>>;
        setHomeSettings(mergeHomeSettings(nextLanguage, parsed[nextLanguage]));
      } catch {
        setHomeSettings(mergeHomeSettings(nextLanguage));
      }
    } else {
      setHomeSettings(mergeHomeSettings(nextLanguage));
    }
  }

  return (
    <div className="page-shell">
      <SiteHeader language={language} siteName="MY Portal" onLanguageChange={changeLanguage} />
      <AdminStudio language={language} />
    </div>
  );
}
