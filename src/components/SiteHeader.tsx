"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { languageNames, translations, type Language } from "@/lib/i18n";
import type { MarqueeItem } from "@/lib/home-settings";

type SiteHeaderProps = {
  language?: Language;
  siteName?: string;
  marqueeText?: string;
  marqueeItems?: MarqueeItem[];
  marqueeSpeed?: number;
  marqueeGap?: number;
  onLanguageChange?: (language: Language) => void;
};

export function SiteHeader({
  language = "zh",
  siteName = "MY Blog",
  marqueeText = "",
  marqueeItems = [],
  marqueeSpeed = 18,
  marqueeGap = 2,
  onLanguageChange,
}: SiteHeaderProps) {
  const t = translations[language].nav;
  const notices = useMemo(() => normalizeNotices(marqueeItems, marqueeText), [marqueeItems, marqueeText]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationCycle, setAnimationCycle] = useState(0);
  const gapTimerRef = useRef<number | null>(null);
  const activeNotice = notices[activeIndex] ?? notices[0];
  const speedSeconds = Math.max(4, Math.min(90, Number(marqueeSpeed) || 18));
  const gapSeconds = Math.max(0, Math.min(30, Number(marqueeGap) || 0));

  useEffect(() => {
    if (gapTimerRef.current) {
      window.clearTimeout(gapTimerRef.current);
    }

    setActiveIndex(0);
    setAnimationCycle((current) => current + 1);
  }, [notices.length]);

  useEffect(() => {
    return () => {
      if (gapTimerRef.current) {
        window.clearTimeout(gapTimerRef.current);
      }
    };
  }, []);

  function showNextNotice() {
    if (!notices.length) {
      return;
    }

    if (gapTimerRef.current) {
      window.clearTimeout(gapTimerRef.current);
    }

    gapTimerRef.current = window.setTimeout(() => {
      if (notices.length > 1) {
        setActiveIndex((current) => (current + 1) % notices.length);
      }

      setAnimationCycle((current) => current + 1);
    }, gapSeconds * 1000);
  }

  return (
    <header className="container flex flex-wrap items-center justify-between gap-4 py-4">
      <Link href="/" className="text-xl font-black tracking-tight text-slate-950">
        {siteName}
      </Link>
      <div className="order-3 flex w-full min-w-0 justify-center md:order-none md:w-auto md:flex-1 md:px-4">
        {activeNotice ? (
          <div className="marquee-box max-w-xl overflow-hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            <div
              key={`${activeNotice.id}-${activeIndex}-${animationCycle}`}
              className="marquee-track whitespace-nowrap"
              style={{ animationDuration: `${speedSeconds}s` }}
              onAnimationEnd={showNextNotice}
            >
              {activeNotice.text}
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {onLanguageChange && (
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <span className="hidden sm:inline">Language</span>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as Language)}
              aria-label="Language"
            >
              {(Object.keys(languageNames) as Language[]).map((item) => (
                <option key={item} value={item}>
                  {languageNames[item]}
                </option>
              ))}
            </select>
          </label>
        )}
        <Link href="/admin" className="button primary">
          {t.admin}
        </Link>
      </div>
    </header>
  );
}

function normalizeNotices(items: MarqueeItem[], fallbackText: string) {
  const normalized = items
    .map((item, index) => ({
      id: item.id || `marquee-${index + 1}`,
      text: item.text.trim(),
    }))
    .filter((item) => item.text);

  const legacy = fallbackText.trim();

  if (!normalized.length && legacy) {
    return [{ id: "marquee-legacy", text: legacy }];
  }

  return normalized;
}
