import { translations, type Language } from "@/lib/i18n";

export type HomeSection = "hero" | "latest" | "friends" | "contact";

export const defaultHomeLayout: HomeSection[] = ["hero", "latest", "friends", "contact"];
const homeSections = new Set<HomeSection>(defaultHomeLayout);

export type FriendLink = {
  id: string;
  name: string;
  url: string;
  description: string;
};

export type MarqueeItem = {
  id: string;
  text: string;
};

export type HomeSettings = {
  siteName: string;
  marqueeText: string;
  marqueeItems: MarqueeItem[];
  marqueeSpeed: number;
  marqueeGap: number;
  headline: string;
  intro: string;
  startWriting: string;
  browsePosts: string;
  featuredTitle: string;
  latestTitle: string;
  seoTitle: string;
  seoDescription: string;
  contactTitle: string;
  contactIntro: string;
  contactButton: string;
  friendLinksTitle: string;
  friendLinksIntro: string;
  friendLinks: FriendLink[];
  backgroundColor: string;
  backgroundImage: string;
  layoutOrder: HomeSection[];
};

export function getDefaultHomeSettings(language: Language): HomeSettings {
  const t = translations[language].home;

  return {
    siteName: "MY Blog",
    marqueeText: "",
    marqueeItems: [],
    marqueeSpeed: 18,
    marqueeGap: 2,
    headline: t.headline,
    intro: t.intro,
    startWriting: t.startWriting,
    browsePosts: t.browsePosts,
    featuredTitle: t.featured,
    latestTitle: t.latest,
    seoTitle: "MY Blog",
    seoDescription: t.intro,
    contactTitle: t.contactTitle,
    contactIntro: t.contactIntro,
    contactButton: t.contactButton,
    friendLinksTitle: t.friendLinksTitle,
    friendLinksIntro: t.friendLinksIntro,
    friendLinks: [],
    backgroundColor: "#ffffff",
    backgroundImage: "",
    layoutOrder: defaultHomeLayout,
  };
}

export function mergeHomeSettings(language: Language, settings?: Partial<HomeSettings> | null): HomeSettings {
  const defaults = getDefaultHomeSettings(language);

  return {
    ...defaults,
    siteName: textOrDefault(settings?.siteName, defaults.siteName),
    marqueeText: textOrDefault(settings?.marqueeText, defaults.marqueeText),
    marqueeItems: normalizeMarqueeItems(settings?.marqueeItems, settings?.marqueeText),
    marqueeSpeed: numberOrDefault(settings?.marqueeSpeed, defaults.marqueeSpeed, 4, 90),
    marqueeGap: numberOrDefault(settings?.marqueeGap, defaults.marqueeGap, 0, 30),
    headline: textOrDefault(settings?.headline, defaults.headline),
    intro: textOrDefault(settings?.intro, defaults.intro),
    startWriting: textOrDefault(settings?.startWriting, defaults.startWriting),
    browsePosts: textOrDefault(settings?.browsePosts, defaults.browsePosts),
    featuredTitle: textOrDefault(settings?.featuredTitle, defaults.featuredTitle),
    latestTitle: textOrDefault(settings?.latestTitle, defaults.latestTitle),
    seoTitle: textOrDefault(settings?.seoTitle, defaults.seoTitle),
    seoDescription: textOrDefault(settings?.seoDescription, defaults.seoDescription),
    contactTitle: textOrDefault(settings?.contactTitle, defaults.contactTitle),
    contactIntro: textOrDefault(settings?.contactIntro, defaults.contactIntro),
    contactButton: textOrDefault(settings?.contactButton, defaults.contactButton),
    friendLinksTitle: textOrDefault(settings?.friendLinksTitle, defaults.friendLinksTitle),
    friendLinksIntro: textOrDefault(settings?.friendLinksIntro, defaults.friendLinksIntro),
    friendLinks: normalizeFriendLinks(settings?.friendLinks),
    backgroundColor: textOrDefault(settings?.backgroundColor, defaults.backgroundColor),
    backgroundImage: textOrDefault(settings?.backgroundImage, defaults.backgroundImage),
    layoutOrder: normalizeHomeLayout(settings?.layoutOrder),
  };
}

function normalizeMarqueeItems(value?: unknown, fallbackText?: unknown): MarqueeItem[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item, index) => {
        const record = item && typeof item === "object" ? (item as Partial<MarqueeItem>) : {};
        return {
          id: textOrDefault(record.id, `marquee-${index + 1}`),
          text: textOrDefault(record.text, ""),
        };
      })
      .filter((item) => item.text.trim());

    if (normalized.length) {
      return normalized;
    }
  }

  const legacyText = textOrDefault(fallbackText, "").trim();

  return legacyText ? [{ id: "marquee-legacy", text: legacyText }] : [];
}

function normalizeFriendLinks(value?: unknown): FriendLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const record = item && typeof item === "object" ? (item as Partial<FriendLink>) : {};
      return {
        id: textOrDefault(record.id, `friend-${index + 1}`),
        name: textOrDefault(record.name, ""),
        url: textOrDefault(record.url, ""),
        description: textOrDefault(record.description, ""),
      };
    })
    .filter((item) => item.name.trim() || item.url.trim() || item.description.trim());
}

function textOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberOrDefault(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeHomeLayout(layout?: unknown): HomeSection[] {
  if (!Array.isArray(layout)) {
    return defaultHomeLayout;
  }

  const filtered = layout.filter((section): section is HomeSection => homeSections.has(section as HomeSection));
  const merged = [...filtered, ...defaultHomeLayout.filter((section) => !filtered.includes(section))];
  return merged.length ? merged : defaultHomeLayout;
}
