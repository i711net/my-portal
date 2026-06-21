"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { defaultCategories, getCategoryLabel, makeCategorySlug, type BlogCategory } from "@/lib/categories";
import { defaultHomeLayout, getDefaultHomeSettings, mergeHomeSettings, type HomeSection, type HomeSettings } from "@/lib/home-settings";
import { translations, type Language } from "@/lib/i18n";

type UploadState = "idle" | "uploading" | "done" | "error";
type EditorMode = "edit" | "preview";
type PostStatus = "Draft" | "Published";
type AdminSection = "dashboard" | "post" | "manage" | "news" | "novels" | "shop" | "media" | "background" | "categories" | "home" | "messages";
type BlockType = "paragraph" | "heading" | "image" | "video" | "audio" | "link" | "quote" | "code";
type MediaInsertType = "image" | "video" | "audio";

type MediaItem = {
  key: string;
  url: string | null;
  type: MediaInsertType;
  size: number;
  uploadedAt: string | null;
  name: string;
};

type MediaStorageInfo = {
  objectCount: number;
  totalSizeBytes: number;
  freeTierBytes: number;
  remainingFreeTierBytes: number;
  usagePercent: number;
};

type ContentBlock = {
  id: string;
  type: BlockType;
  content: string;
  url?: string;
  caption?: string;
};

type DraftPost = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string;
  coverUrl: string;
  status: PostStatus;
  blocks: ContentBlock[];
  richContent: string;
  richText: string;
  updatedAt: string;
};

type ManagedPost = DraftPost & {
  date: string;
  readTime: string;
};

type SiteMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

type AdminCopy = (typeof translations)["en"]["admin"];

const portalAdminCopy = {
  zh: {
    title: "MY Portal 后台",
    intro: "整个门户网站的控制台：管理首页、新闻、小说、商品、博客、媒体和留言。",
    dashboard: "门户总览",
    news: "新闻管理",
    novels: "小说管理",
    shop: "商品管理",
    blogEditor: "博客写作",
    blogPosts: "博客文章",
    comingSoon: "这个频道页面已经建立，后台数据管理会在下一步接入。",
    dashboardIntro: "现在后台已经从单一博客后台改成门户后台。博客功能保留，同时预留新闻、小说、商品和订单扩展位置。",
    homepage: "门户首页",
    content: "内容频道",
    commerce: "商品与收款",
    system: "系统设置",
  },
  en: {
    title: "MY Portal Admin",
    intro: "The full portal control center for homepage, news, novels, shop, blog, media, and messages.",
    dashboard: "Portal Overview",
    news: "News",
    novels: "Novels",
    shop: "Shop",
    blogEditor: "Blog Editor",
    blogPosts: "Blog Posts",
    comingSoon: "This public channel page exists now. Data management will be connected next.",
    dashboardIntro: "The admin is now a portal admin instead of only a blog desk. Blog tools stay here while news, novels, products, and orders are prepared.",
    homepage: "Portal Homepage",
    content: "Content Channels",
    commerce: "Shop and Payments",
    system: "System Settings",
  },
  ko: {
    title: "MY Portal 관리자",
    intro: "홈, 뉴스, 소설, 상품, 블로그, 미디어, 메시지를 관리하는 포털 전체 관리자 화면입니다.",
    dashboard: "포털 개요",
    news: "뉴스 관리",
    novels: "소설 관리",
    shop: "상품 관리",
    blogEditor: "블로그 작성",
    blogPosts: "블로그 글",
    comingSoon: "공개 채널 페이지는 만들어졌고, 데이터 관리는 다음 단계에서 연결합니다.",
    dashboardIntro: "관리자 화면이 단일 블로그 관리에서 포털 전체 관리로 바뀌었습니다. 블로그 기능은 유지하고 뉴스, 소설, 상품, 주문 확장 자리를 준비했습니다.",
    homepage: "포털 홈",
    content: "콘텐츠 채널",
    commerce: "상품과 결제",
    system: "시스템 설정",
  },
};

type PortalAdminCopy = (typeof portalAdminCopy)["zh"];

const ADMIN_TOKEN_KEY = "my-blog-admin-token";
const ADMIN_LOCK_KEY = "my-blog-admin-lock";
const ADMIN_MAX_ATTEMPTS = 3;
const ADMIN_LOCK_MS = 10 * 60 * 1000;
const AUTO_SAVE_MS = 10 * 1000;
const backgroundPalette = ["#ffffff", "#f8fafc", "#eef2ff", "#eff6ff", "#ecfeff", "#f0fdf4", "#fffbeb", "#fdf2f8", "#111827", "#172554"];

type AdminLockState = {
  attempts: number;
  lockedUntil: number;
};

function getStarterBlocks(copy: AdminCopy): ContentBlock[] {
  return [
    {
      id: "intro",
      type: "paragraph",
      content: copy.defaults.starter,
    },
  ];
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function createBlock(type: BlockType, copy: AdminCopy, seed = ""): ContentBlock {
  const defaults: Record<BlockType, ContentBlock> = {
    paragraph: { id: createId(), type, content: seed || copy.defaults.paragraph },
    heading: { id: createId(), type, content: seed || copy.defaults.heading },
    image: { id: createId(), type, content: "", url: seed, caption: copy.defaults.imageCaption },
    video: { id: createId(), type, content: "", url: seed, caption: copy.defaults.videoCaption },
    audio: { id: createId(), type, content: "", url: seed, caption: copy.defaults.audioCaption },
    link: { id: createId(), type, content: seed || copy.defaults.link, url: "https://" },
    quote: { id: createId(), type, content: seed || copy.defaults.quote },
    code: { id: createId(), type, content: seed || copy.defaults.code },
  };

  return defaults[type];
}

function makeFallbackSlug(prefix = "post") {
  return `${prefix}-${Date.now().toString(36)}`;
}

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeSlug(title: string) {
  return sanitizeSlug(title) || makeFallbackSlug();
}

function isAutoSlug(value: string) {
  return !value || value === "untitled-draft" || /^draft-[a-z0-9]+$/.test(value) || /^post-[a-z0-9]+$/.test(value);
}

function getMediaType(contentType: string): MediaInsertType {
  if (contentType.startsWith("video/")) {
    return "video";
  }

  if (contentType.startsWith("audio/")) {
    return "audio";
  }

  return "image";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatMediaDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString();
}

function formatUsagePercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.max(0, Math.min(100, value)).toFixed(value < 1 ? 2 : 1)}%`;
}

function getLockRemainingText(lockedUntil: number) {
  const remainingMs = Math.max(0, lockedUntil - Date.now());
  const minutes = Math.ceil(remainingMs / 60000);
  return `${minutes}`;
}

function readAdminLockState(): AdminLockState {
  if (typeof window === "undefined") {
    return { attempts: 0, lockedUntil: 0 };
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_LOCK_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AdminLockState>) : {};
    return {
      attempts: Number(parsed.attempts || 0),
      lockedUntil: Number(parsed.lockedUntil || 0),
    };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function writeAdminLockState(state: AdminLockState) {
  window.localStorage.setItem(ADMIN_LOCK_KEY, JSON.stringify(state));
}

function clearStoredAdminSession() {
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function getInitialRichContent(copy: AdminCopy) {
  void copy;
  return "";
}

function getStoredRichContent(post: Partial<DraftPost>, copy: AdminCopy) {
  if (typeof post.richContent === "string") {
    return post.richContent;
  }

  return post.blocks?.length ? blocksToHtml(post.blocks) : getInitialRichContent(copy);
}

function getStoredRichText(post: Partial<DraftPost>, fallback = "") {
  if (typeof post.richText === "string") {
    return post.richText;
  }

  return post.blocks?.map((block) => block.content).join(" ") || fallback;
}

function blocksToHtml(blocks: ContentBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        return `<h2>${block.content}</h2>`;
      }

      if (block.type === "image" && block.url) {
        return `<figure><img src="${block.url}" alt="${block.caption ?? ""}" />${block.caption ? `<figcaption>${block.caption}</figcaption>` : ""}</figure>`;
      }

      if (block.type === "video" && block.url) {
        return `<video src="${block.url}" controls></video>`;
      }

      if (block.type === "audio" && block.url) {
        return `<audio src="${block.url}" controls></audio>`;
      }

      if (block.type === "link") {
        return `<p><a href="${block.url ?? "#"}">${block.content || block.url}</a></p>`;
      }

      if (block.type === "quote") {
        return `<blockquote>${block.content}</blockquote>`;
      }

      if (block.type === "code") {
        return `<pre><code>${block.content}</code></pre>`;
      }

      return `<p>${block.content}</p>`;
    })
    .join("");
}

export function AdminStudio({ language = "zh" }: { language?: Language }) {
  const t = translations[language].admin;
  const portalT = portalAdminCopy[language];
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [mode, setMode] = useState<EditorMode>("edit");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState(defaultCategories[0]?.slug ?? "Workflow");
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState<PostStatus>("Draft");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [richContent, setRichContent] = useState("");
  const [richText, setRichText] = useState("");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [insertRequest, setInsertRequest] = useState<{ id: string; type: MediaInsertType; url: string } | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState("intro");
  const [history, setHistory] = useState<ContentBlock[][]>([]);
  const [future, setFuture] = useState<ContentBlock[][]>([]);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [token, setToken] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [adminLockedUntil, setAdminLockedUntil] = useState(0);
  const [lastSaved, setLastSaved] = useState(t.notSaved);
  const [notice, setNotice] = useState(t.notSaved);
  const [isSaving, setIsSaving] = useState(false);
  const [homeSettings, setHomeSettings] = useState<HomeSettings>(() => getDefaultHomeSettings(language));
  const [managedPosts, setManagedPosts] = useState<ManagedPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [categoryItems, setCategoryItems] = useState<BlogCategory[]>(defaultCategories);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaStorage, setMediaStorage] = useState<MediaStorageInfo | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [isLoadingHomeSettings, setIsLoadingHomeSettings] = useState(false);
  const [messages, setMessages] = useState<SiteMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoDraftSlugRef = useRef("");
  const autoSaveInFlightRef = useRef(false);
  const lastAutoSaveSnapshotRef = useRef("");

  const wordCount = useMemo(() => {
    const text = [title, excerpt, richText].join(" ");
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [excerpt, richText, title]);

  const mediaCount = useMemo(() => (richContent.match(/<(img|video|audio)\b/gi) ?? []).length, [richContent]);

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const lockState = readAdminLockState();

    window.localStorage.removeItem(ADMIN_TOKEN_KEY);

    if (lockState.lockedUntil > Date.now()) {
      setAdminLockedUntil(lockState.lockedUntil);
      setLoginError(t.adminLocked.replace("{minutes}", getLockRemainingText(lockState.lockedUntil)));
    }

    if (savedToken) {
      setToken(savedToken);
      setAdminUnlocked(true);
    }

    window.localStorage.removeItem("my-blog-draft");
    const savedSettings = window.localStorage.getItem("my-blog-home-settings");

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as Partial<Record<Language, Partial<HomeSettings>>>;
        setHomeSettings(mergeHomeSettings(language, parsed[language]));
      } catch {
        setHomeSettings(getDefaultHomeSettings(language));
      }
    } else {
      setHomeSettings(getDefaultHomeSettings(language));
    }
  }, [language, t]);

  useEffect(() => {
    if (!adminLockedUntil) {
      return;
    }

    const timer = window.setInterval(() => {
      if (adminLockedUntil <= Date.now()) {
        writeAdminLockState({ attempts: 0, lockedUntil: 0 });
        setAdminLockedUntil(0);
        setLoginError("");
      } else {
        setLoginError(t.adminLocked.replace("{minutes}", getLockRemainingText(adminLockedUntil)));
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [adminLockedUntil, t]);

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (adminUnlocked && token.trim()) {
      void loadMediaLibrary(token);
    }
  }, [adminUnlocked, token]);

  useEffect(() => {
    if (adminUnlocked && section === "home") {
      void loadHomeSettings();
    }
  }, [adminUnlocked, language, section]);

  useEffect(() => {
    if (!adminUnlocked || section !== "post" || status !== "Draft") {
      return;
    }

    const timer = window.setInterval(() => {
      void autoSaveDraft();
    }, AUTO_SAVE_MS);

    return () => window.clearInterval(timer);
  }, [adminUnlocked, section, status, title, slug, excerpt, category, tags, coverUrl, richContent, richText, token]);

  function updateHomeSettings(patch: Partial<HomeSettings>) {
    setHomeSettings((current) => ({ ...current, ...patch }));
  }

  function moveHomeSection(section: HomeSection, direction: -1 | 1) {
    setHomeSettings((current) => {
      const order = current.layoutOrder?.length ? current.layoutOrder : defaultHomeLayout;
      const index = order.indexOf(section);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
        return current;
      }

      const next = [...order];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return { ...current, layoutOrder: next };
    });
  }

  function dragHomeSection(section: HomeSection, target: HomeSection) {
    if (section === target) {
      return;
    }

    setHomeSettings((current) => {
      const order = current.layoutOrder?.length ? current.layoutOrder : defaultHomeLayout;
      const next = order.filter((item) => item !== section);
      const targetIndex = next.indexOf(target);

      if (targetIndex < 0) {
        return current;
      }

      next.splice(targetIndex, 0, section);
      return { ...current, layoutOrder: next };
    });
  }

  async function loginAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = loginToken.trim();
    const lockState = readAdminLockState();
    const activeLockState = lockState.lockedUntil && lockState.lockedUntil <= Date.now() ? { attempts: 0, lockedUntil: 0 } : lockState;

    if (activeLockState.lockedUntil > Date.now()) {
      setAdminLockedUntil(activeLockState.lockedUntil);
      setLoginError(t.adminLocked.replace("{minutes}", getLockRemainingText(activeLockState.lockedUntil)));
      return;
    }

    if (!nextToken) {
      setLoginError(t.unlockFailed);
      return;
    }

    setLoginError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ token: nextToken }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        locked?: boolean;
        lockedUntil?: string | null;
        remainingAttempts?: number;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        if (data.locked && data.lockedUntil) {
          const lockedUntil = new Date(data.lockedUntil).getTime();
          writeAdminLockState({ attempts: ADMIN_MAX_ATTEMPTS, lockedUntil });
          setAdminLockedUntil(lockedUntil);
          setLoginError(t.adminLocked.replace("{minutes}", getLockRemainingText(lockedUntil)));
          return;
        }

        if (typeof data.remainingAttempts === "number") {
          writeAdminLockState({ attempts: ADMIN_MAX_ATTEMPTS - data.remainingAttempts, lockedUntil: 0 });
          setLoginError(t.unlockFailedWithAttempts.replace("{count}", String(data.remainingAttempts)));
          return;
        }

        throw new Error(data.detail || data.error || t.unlockFailed);
      }

      setToken(nextToken);
      setLoginToken("");
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, nextToken);
      writeAdminLockState({ attempts: 0, lockedUntil: 0 });
      setAdminLockedUntil(0);
      setAdminUnlocked(true);
      setNotice(t.loggedIn);
      void loadMediaLibrary(nextToken);
    } catch {
      const failedAttempts = activeLockState.attempts + 1;

      if (failedAttempts >= ADMIN_MAX_ATTEMPTS) {
        const lockedUntil = Date.now() + ADMIN_LOCK_MS;
        writeAdminLockState({ attempts: failedAttempts, lockedUntil });
        setAdminLockedUntil(lockedUntil);
        setLoginError(t.adminLocked.replace("{minutes}", getLockRemainingText(lockedUntil)));
      } else {
        writeAdminLockState({ attempts: failedAttempts, lockedUntil: 0 });
        setLoginError(t.unlockFailedWithAttempts.replace("{count}", String(ADMIN_MAX_ATTEMPTS - failedAttempts)));
      }
    } finally {
      setIsSaving(false);
    }
  }

  function logoutAdmin() {
    setAdminUnlocked(false);
    setToken("");
    setLoginToken("");
    setSection("dashboard");
    clearStoredAdminSession();
    window.location.assign("/");
  }

  async function loadCategories(adminMode = false) {
    try {
      const response = await fetch(adminMode ? "/api/categories?admin=1" : "/api/categories", {
        cache: "no-store",
        headers: adminMode
          ? {
              authorization: `Bearer ${token}`,
            }
          : undefined,
      });
      const data = (await response.json()) as { categories?: BlogCategory[]; error?: string; detail?: string; hint?: string };

      if (!response.ok) {
        throw new Error(data.hint || data.detail || data.error || "Could not load categories.");
      }

      if (data.categories?.length) {
        setCategoryItems(data.categories);

        if (!data.categories.some((item) => item.slug === category)) {
          setCategory(data.categories[0].slug);
        }
      }
    } catch (error) {
      if (adminMode) {
        setNotice(`${t.categoryLoadFailed}: ${error instanceof Error ? error.message : "Unknown error"}`);
      } else {
        setCategoryItems(defaultCategories);
      }
    }
  }

  async function loadMediaLibrary(authToken = token) {
    const nextToken = authToken.trim();

    if (!nextToken) {
      return;
    }

    setIsLoadingMedia(true);
    setMediaError("");

    try {
      const response = await fetch("/api/media", {
        cache: "no-store",
        headers: {
          authorization: `Bearer ${nextToken}`,
        },
      });
      const data = (await response.json()) as { media?: MediaItem[]; storage?: MediaStorageInfo; error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || t.mediaLoadFailed);
      }

      setMediaItems((data.media ?? []).filter((item) => item.url));
      setMediaStorage(data.storage ?? null);
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : t.mediaLoadFailed);
    } finally {
      setIsLoadingMedia(false);
    }
  }

  function insertMediaItem(item: MediaItem) {
    if (!item.url) {
      return;
    }

    setInsertRequest({ id: createId(), type: item.type, url: item.url });
    setNotice(t.mediaInserted);
  }

  function setMediaAsCover(item: MediaItem) {
    if (!item.url) {
      return;
    }

    setCoverUrl(item.url);
    setNotice(t.coverSet);
  }

  async function setMediaAsHomeBackground(item: MediaItem) {
    const backgroundImage = item.url ?? "";

    if (!backgroundImage || item.type !== "image") {
      return;
    }

    const nextSettings = { ...homeSettings, backgroundImage };
    setHomeSettings(nextSettings);
    await persistHomeSettings(nextSettings, t.backgroundSet);
  }

  async function updateBackgroundSettings(patch: Pick<Partial<HomeSettings>, "backgroundColor" | "backgroundImage">) {
    const nextSettings = { ...homeSettings, ...patch };
    setHomeSettings(nextSettings);
    await persistHomeSettings(nextSettings, t.backgroundSet);
  }

  async function deleteMediaItem(item: MediaItem) {
    if (!token.trim()) {
      setNotice(`${t.uploadFailed}: ${t.adminToken}`);
      return;
    }

    const deleteToken = window.prompt(`${t.deleteMediaPasswordPrompt}: ${item.name}`)?.trim();

    if (!deleteToken) {
      setNotice(t.deletePasswordMissing);
      return;
    }

    const confirmed = window.confirm(`${t.deleteMediaConfirm}: ${item.name}`);

    if (!confirmed) {
      return;
    }

    setIsLoadingMedia(true);
    setMediaError("");

    try {
      const response = await fetch("/api/media", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: item.key, deleteToken }),
      });
      const data = (await response.json()) as { error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not delete media file.");
      }

      setMediaItems((items) => items.filter((media) => media.key !== item.key));
      setNotice(t.mediaDeleted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete media file.";
      setMediaError(message);
      setNotice(`${t.uploadFailed}: ${message}`);
    } finally {
      setIsLoadingMedia(false);
    }
  }

  function updateCategory(index: number, patch: Partial<BlogCategory>) {
    setCategoryItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              labels: {
                ...item.labels,
                ...(patch.labels ?? {}),
              },
            }
          : item,
      ),
    );
  }

  function addCategory() {
    const label = `${t.newCategory} ${categoryItems.length + 1}`;
    setCategoryItems((items) => [
      ...items,
      {
        slug: makeCategorySlug(label),
        labels: {
          en: label,
          zh: label,
          ko: label,
        },
      },
    ]);
    setNotice(t.categoryAdded);
  }

  function removeCategory(index: number) {
    if (categoryItems.length <= 1) {
      setNotice(t.keepOneCategory);
      return;
    }

    setCategoryItems((items) => {
      const next = items.filter((_, itemIndex) => itemIndex !== index);

      if (!next.some((item) => item.slug === category)) {
        setCategory(next[0].slug);
      }

      return next;
    });
    setNotice(t.categoryRemoved);
  }

  function moveCategory(index: number, direction: -1 | 1) {
    setCategoryItems((items) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= items.length) {
        return items;
      }

      const next = [...items];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
    setNotice(t.categoryMoved);
  }

  async function saveCategories() {
    if (!token.trim()) {
      setNotice(`${t.uploadFailed}: ${t.adminToken}`);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ categories: categoryItems }),
      });
      const data = (await response.json()) as { categories?: BlogCategory[]; error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not save categories.");
      }

      await loadCategories(true);
      setNotice(t.categoriesSaved);
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Could not save categories."}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function persistHomeSettings(settings: HomeSettings, successNotice = t.homeSettingsSaved) {
    saveHomeSettingsLocal(language, settings);

    if (!token.trim()) {
      setNotice(`${successNotice} (${t.adminToken})`);
      setLastSaved(successNotice);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/home-settings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ language, settings }),
      });
      const data = (await response.json()) as { settings?: HomeSettings; error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not save home settings.");
      }

      if (data.settings) {
        setHomeSettings(data.settings);
        saveHomeSettingsLocal(language, data.settings);
      }

      setNotice(successNotice);
      setLastSaved(successNotice);
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Supabase save failed."}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveHomeSettings() {
    await persistHomeSettings(homeSettings);
  }

  async function loadHomeSettings() {
    setIsLoadingHomeSettings(true);

    try {
      const response = await fetch(`/api/home-settings?language=${language}`, { cache: "no-store" });
      const data = (await response.json()) as { settings?: HomeSettings; error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || t.homeSettingsLoadFailed);
      }

      if (data.settings) {
        setHomeSettings(data.settings);
        saveHomeSettingsLocal(language, data.settings);
        setNotice(t.homeSettingsLoaded);
      }
    } catch (error) {
      setNotice(`${t.homeSettingsLoadFailed}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoadingHomeSettings(false);
    }
  }

  function saveHomeSettingsLocal(targetLanguage: Language, settings: HomeSettings) {
    try {
      const saved = window.localStorage.getItem("my-blog-home-settings");
      const current = saved ? (JSON.parse(saved) as Partial<Record<Language, Partial<HomeSettings>>>) : {};
      const next = {
        ...current,
        [targetLanguage]: settings,
      };

      window.localStorage.setItem("my-blog-home-settings", JSON.stringify(next));
    } catch {
      window.localStorage.setItem("my-blog-home-settings", JSON.stringify({ [targetLanguage]: settings }));
    }
  }

  function getDraft(nextStatus: PostStatus = status, options?: { autoSave?: boolean }): DraftPost {
    const fallbackTitle = language === "en" ? "Untitled draft" : language === "ko" ? "제목 없는 초안" : "未命名草稿";
    const draftTitle = title.trim() || (options?.autoSave ? fallbackTitle : title);
    let draftSlug = sanitizeSlug(slug) || makeSlug(draftTitle);

    if (options?.autoSave && !slug.trim() && !title.trim()) {
      if (!autoDraftSlugRef.current) {
        autoDraftSlugRef.current = makeFallbackSlug("autosave");
      }

      draftSlug = autoDraftSlugRef.current;
    }

    return {
      title: draftTitle,
      slug: draftSlug,
      excerpt,
      category,
      tags,
      coverUrl,
      status: nextStatus,
      blocks: [],
      richContent,
      richText,
      updatedAt: new Date().toISOString(),
    };
  }

  function publishToHome(draft: DraftPost) {
    const saved = window.localStorage.getItem("my-blog-published-posts");
    const existing = saved ? (JSON.parse(saved) as DraftPost[]) : [];
    const next = [draft, ...existing.filter((post) => post.slug !== draft.slug)].slice(0, 12);
    window.localStorage.setItem("my-blog-published-posts", JSON.stringify(next));
  }

  async function publishToDatabase(draft: DraftPost) {
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(draft),
    });
    const data = (await response.json()) as { error?: string; detail?: string };

    if (!response.ok) {
      throw new Error(data.detail || data.error || "Could not publish post.");
    }
  }

  function hasDraftContent() {
    return Boolean([title, slug, excerpt, tags, coverUrl, richText].some((value) => value.trim()) || richContent.replace(/<[^>]*>/g, "").trim());
  }

  function getAutoSaveSnapshot() {
    return JSON.stringify({
      title,
      slug,
      excerpt,
      category,
      tags,
      coverUrl,
      richContent,
      richText,
    });
  }

  async function autoSaveDraft() {
    if (!adminUnlocked || !token.trim() || section !== "post" || status !== "Draft" || !hasDraftContent() || autoSaveInFlightRef.current) {
      return;
    }

    const snapshot = getAutoSaveSnapshot();

    if (snapshot === lastAutoSaveSnapshotRef.current) {
      return;
    }

    autoSaveInFlightRef.current = true;
    setIsAutoSaving(true);

    try {
      const draft = getDraft("Draft", { autoSave: true });
      await publishToDatabase(draft);
      lastAutoSaveSnapshotRef.current = snapshot;
      setLastSaved(`${t.autosaved} ${new Date(draft.updatedAt).toLocaleTimeString()}`);
      setNotice(t.draftSavedOnline);
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Auto save failed."}`);
    } finally {
      autoSaveInFlightRef.current = false;
      setIsAutoSaving(false);
    }
  }

  function loadPostIntoEditor(post: DraftPost) {
    autoDraftSlugRef.current = post.slug;
    lastAutoSaveSnapshotRef.current = "";
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt);
    setCategory(post.category);
    setTags(post.tags);
    setCoverUrl(post.coverUrl);
    setStatus(post.status);
    setBlocks([]);
    setRichContent(getStoredRichContent(post, t));
    setRichText(getStoredRichText(post));
    setSelectedBlockId("intro");
    setMode("edit");
    setSection("post");
    setNotice(`${t.postLoaded}: ${post.title}`);
  }

  function previewPostInEditor(post: DraftPost) {
    loadPostIntoEditor(post);
    setMode("preview");
  }

  function startNewDraft() {
    autoDraftSlugRef.current = "";
    lastAutoSaveSnapshotRef.current = "";
    setTitle("");
    setSlug("");
    setExcerpt("");
    setCategory(categoryItems[0]?.slug ?? "Workflow");
    setTags("");
    setCoverUrl("");
    setStatus("Draft");
    setBlocks([]);
    setRichContent("");
    setRichText("");
    setInsertRequest(null);
    setEditorResetKey((key) => key + 1);
    setSelectedBlockId("intro");
    setMode("edit");
    setSection("post");
    setNotice(t.newDraftStarted);
    window.localStorage.removeItem("my-blog-draft");
  }

  async function loadManagedPosts() {
    if (!token.trim()) {
      setNotice(`${t.uploadFailed}: ${t.adminToken}`);
      return;
    }

    setIsLoadingPosts(true);

    try {
      const response = await fetch("/api/posts?admin=1", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as {
        posts?: Array<{
          slug: string;
          title: string;
          excerpt: string;
          category: string;
          tags: string;
          coverUrl: string;
          status: PostStatus;
          blocks: ContentBlock[];
          richContent: string;
          richText: string;
          updatedAt?: string;
          date: string;
          readTime: string;
        }>;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not load posts.");
      }

      setManagedPosts(
        (data.posts ?? []).map((post) => ({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          category: post.category,
          tags: post.tags,
          coverUrl: post.coverUrl,
          status: post.status,
          blocks: post.blocks ?? [],
          richContent: post.richContent,
          richText: post.richText,
          updatedAt: post.updatedAt ?? new Date().toISOString(),
          date: post.date,
          readTime: post.readTime,
        })),
      );
      setNotice(t.postsLoaded);
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Could not load posts."}`);
    } finally {
      setIsLoadingPosts(false);
    }
  }

  async function deleteManagedPost(slugToDelete: string) {
    if (!token.trim()) {
      setNotice(`${t.uploadFailed}: ${t.adminToken}`);
      return;
    }

    const post = managedPosts.find((item) => item.slug === slugToDelete);
    const deleteToken = window.prompt(`${t.deletePasswordPrompt}: ${post?.title ?? slugToDelete}`)?.trim();

    if (!deleteToken) {
      setNotice(t.deletePasswordMissing);
      return;
    }

    const confirmed = window.confirm(`${t.deleteConfirm}: ${post?.title ?? slugToDelete}`);

    if (!confirmed) {
      return;
    }

    setIsLoadingPosts(true);

    try {
      const response = await fetch("/api/posts", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slug: slugToDelete, deleteToken }),
      });
      const data = (await response.json()) as { error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not delete post.");
      }

      setManagedPosts((posts) => posts.filter((item) => item.slug !== slugToDelete));
      setNotice(t.postDeleted);
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Could not delete post."}`);
    } finally {
      setIsLoadingPosts(false);
    }
  }

  async function loadMessages() {
    if (!token.trim()) {
      setNotice(`${t.uploadFailed}: ${t.adminToken}`);
      return;
    }

    setIsLoadingMessages(true);

    try {
      const response = await fetch("/api/messages", {
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as { messages?: SiteMessage[]; error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not load messages.");
      }

      setMessages(data.messages ?? []);
      setNotice(t.manageMessages);
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Could not load messages."}`);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function deleteMessage(id: string) {
    if (!token.trim()) {
      setNotice(`${t.uploadFailed}: ${t.adminToken}`);
      return;
    }

    setIsLoadingMessages(true);

    try {
      const response = await fetch("/api/messages", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Could not delete message.");
      }

      setMessages((items) => items.filter((item) => item.id !== id));
      setNotice(t.messageDeleted);
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Could not delete message."}`);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function saveDraft(nextStatus: PostStatus = status) {
    const draft = getDraft(nextStatus);
    window.localStorage.setItem("my-blog-draft", JSON.stringify(draft));

    if (!token.trim()) {
      const label = nextStatus === "Draft" ? t.draft : t.published;
      setStatus(nextStatus);
      setLastSaved(`${label} ${t.savedAt} ${new Date(draft.updatedAt).toLocaleTimeString()}`);
      setNotice(nextStatus === "Draft" ? t.localDraftSaved : `${t.uploadFailed}: ${t.adminToken}`);
      return nextStatus === "Draft";
    }

    setIsSaving(true);

    try {
      await publishToDatabase(draft);

      if (nextStatus === "Published") {
        publishToHome(draft);
      }
    } catch (error) {
      setNotice(`${t.uploadFailed}: ${error instanceof Error ? error.message : "Supabase save failed."}`);
      setIsSaving(false);
      return false;
    }

    setIsSaving(false);
    setStatus(nextStatus);
    const label = nextStatus === "Draft" ? t.draft : t.published;
    lastAutoSaveSnapshotRef.current = getAutoSaveSnapshot();
    setLastSaved(`${label} ${t.savedAt} ${new Date(draft.updatedAt).toLocaleTimeString()}`);
    setNotice(nextStatus === "Published" ? t.publishedHome : t.draftSavedOnline);
    void loadManagedPosts();
    return true;
  }

  function exportJson() {
    const draft = getDraft(status);
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.slug || "my-blog-post"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(t.exported);
  }

  function commitBlocks(updater: (current: ContentBlock[]) => ContentBlock[], message: string) {
    setBlocks((current) => {
      const next = updater(current);

      if (next === current) {
        return current;
      }

      setHistory((items) => [...items.slice(-24), current]);
      setFuture([]);
      setNotice(message);
      return next;
    });
  }

  function addBlock(type: BlockType, seed = "") {
    const nextBlock = createBlock(type, t, seed);
    commitBlocks((current) => [...current, nextBlock], `${t.blockAdded}: ${t.blockTypes[type]}`);
    setSelectedBlockId(nextBlock.id);
  }

  function updateBlock(id: string, patch: Partial<ContentBlock>) {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  function removeBlock(id: string) {
    commitBlocks((current) => {
      const next = current.filter((block) => block.id !== id);
      setSelectedBlockId(next[0]?.id ?? "");
      return next.length ? next : getStarterBlocks(t);
    }, t.blockRemoved);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    commitBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const copy = [...current];
      const [block] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, block);
      return copy;
    }, t.blockMoved);
  }

  function undoBlocks() {
    setHistory((items) => {
      const previous = items.at(-1);

      if (!previous) {
        setNotice(t.noBlockSelected);
        return items;
      }

      setFuture((futureItems) => [blocks, ...futureItems.slice(0, 24)]);
      setBlocks(previous);
      setSelectedBlockId(previous[0]?.id ?? "");
      setNotice(t.undoDone);
      return items.slice(0, -1);
    });
  }

  function redoBlocks() {
    setFuture((items) => {
      const next = items[0];

      if (!next) {
        setNotice(t.noBlockSelected);
        return items;
      }

      setHistory((historyItems) => [...historyItems.slice(-24), blocks]);
      setBlocks(next);
      setSelectedBlockId(next[0]?.id ?? "");
      setNotice(t.redoDone);
      return items.slice(1);
    });
  }

  function formatSelected(prefix: string, suffix = prefix) {
    const selected = blocks.find((block) => block.id === selectedBlockId);

    if (!selected || selected.type === "image" || selected.type === "video" || selected.type === "audio") {
      setNotice(t.selectBlockHint);
      return;
    }

    commitBlocks(
      (current) =>
        current.map((block) =>
          block.id === selectedBlockId
            ? {
                ...block,
                content: `${prefix}${block.content || ""}${suffix}`,
              }
            : block,
        ),
      t.formatted,
    );
  }

  function makeSelectedHeading() {
    if (!selectedBlockId) {
      setNotice(t.selectBlockHint);
      return;
    }

    commitBlocks(
      (current) => current.map((block) => (block.id === selectedBlockId ? { ...block, type: "heading" } : block)),
      t.formatted,
    );
  }

  async function uploadToR2(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload-media", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data = (await response.json()) as {
      key?: string;
      publicUrl?: string | null;
      error?: string;
      detail?: string;
    };

    if (!response.ok) {
      throw new Error(data.detail || data.error || "Could not upload media file");
    }

    return data.publicUrl ?? "";
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("media") as HTMLInputElement;
    const placement = (form.elements.namedItem("placement") as HTMLSelectElement).value;
    const file = fileInput.files?.[0];

    if (!file) {
      return;
    }

    setUploadState("uploading");
    setUploadError("");

    try {
      const publicUrl = await uploadToR2(file);

      if (!publicUrl) {
        throw new Error("Uploaded, but R2_PUBLIC_URL is missing.");
      }

      setImageUrl(publicUrl);

      if (placement === "cover") {
        setCoverUrl(publicUrl);
        setNotice(t.coverSet);
      } else {
        setInsertRequest({ id: createId(), type: getMediaType(file.type) as MediaInsertType, url: publicUrl });
        setNotice(t.mediaInserted);
      }

      setUploadState("done");
      form.reset();
      void loadMediaLibrary();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      setUploadState("error");
    }
  }

  async function uploadEditorImage(file: File) {
    setUploadState("uploading");
    setUploadError("");

    try {
      const publicUrl = await uploadToR2(file);

      if (!publicUrl) {
        throw new Error("Uploaded, but R2_PUBLIC_URL is missing.");
      }

      setImageUrl(publicUrl);
      setUploadState("done");
      setNotice(t.mediaInserted);
      void loadMediaLibrary();
      return publicUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadError(message);
      setUploadState("error");
      setNotice(`${t.uploadFailed}: ${message}`);
      throw error;
    }
  }

  async function uploadHomeBackground(file: File) {
    if (!file.type.startsWith("image/")) {
      setNotice(`${t.uploadFailed}: ${t.missingImage}`);
      return "";
    }

    setUploadState("uploading");
    setUploadError("");

    try {
      const publicUrl = await uploadToR2(file);

      if (!publicUrl) {
        throw new Error("Uploaded, but R2_PUBLIC_URL is missing.");
      }

      setImageUrl(publicUrl);
      setUploadState("done");
      void loadMediaLibrary();
      setNotice(t.backgroundPreview);
      return publicUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadError(message);
      setUploadState("error");
      setNotice(`${t.uploadFailed}: ${message}`);
      return "";
    }
  }

  if (!adminUnlocked) {
    return (
      <main className="container flex min-h-[70vh] items-center justify-center py-8 md:py-12">
        <form onSubmit={loginAdmin} className="card w-full max-w-md p-5 md:p-8" autoComplete="off">
          <h1 className="text-2xl font-black tracking-tight text-slate-950">{t.adminLoginTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{t.adminLoginIntro}</p>
          <label className="mt-6 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">{t.adminPassword}</span>
            <input
              className="field"
              type="password"
              name="admin-session-passcode"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={loginToken}
              onChange={(event) => setLoginToken(event.target.value)}
              placeholder="ADMIN_UPLOAD_TOKEN"
              disabled={Boolean(adminLockedUntil && adminLockedUntil > Date.now())}
            />
          </label>
          {loginError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{loginError}</p>}
          <button className="button primary mt-5 w-full" type="submit" disabled={isSaving || Boolean(adminLockedUntil && adminLockedUntil > Date.now())}>
            {isSaving ? t.saving : t.enterAdmin}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell grid gap-6 pb-28 pt-4 md:pt-8 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
      <aside className="card admin-sidebar h-fit p-4 md:p-5">
        <h1 className="text-xl font-black text-slate-950">{portalT.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {portalT.intro}
        </p>
        <div className="mt-6 space-y-3 text-sm">
          <MetaRow label={t.status} value={status === "Draft" ? t.draft : t.published} />
          <MetaRow label={t.words} value={String(wordCount)} />
          <MetaRow label={t.media} value={String(mediaCount)} />
        </div>
        <p className="mt-5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-700">
          {isAutoSaving ? `${t.autosaved}...` : lastSaved}
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
          {notice}
        </p>
        <div className="admin-nav mt-5 grid gap-2">
          <div className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold leading-5 text-green-700">
            {t.loggedIn}
          </div>
          <button className={`button ${section === "dashboard" ? "primary" : "secondary"}`} type="button" onClick={() => setSection("dashboard")}>
            {portalT.dashboard}
          </button>
          <button className={`button ${section === "post" ? "primary" : "secondary"}`} type="button" onClick={() => setSection("post")}>
            {portalT.blogEditor}
          </button>
          <button
            className={`button ${section === "manage" ? "primary" : "secondary"}`}
            type="button"
            onClick={() => {
              setSection("manage");
              void loadManagedPosts();
            }}
          >
            {portalT.blogPosts}
          </button>
          <button className={`button ${section === "news" ? "primary" : "secondary"}`} type="button" onClick={() => setSection("news")}>
            {portalT.news}
          </button>
          <button className={`button ${section === "novels" ? "primary" : "secondary"}`} type="button" onClick={() => setSection("novels")}>
            {portalT.novels}
          </button>
          <button className={`button ${section === "shop" ? "primary" : "secondary"}`} type="button" onClick={() => setSection("shop")}>
            {portalT.shop}
          </button>
          <button
            className={`button ${section === "media" ? "primary" : "secondary"}`}
            type="button"
            onClick={() => {
              setSection("media");
              void loadMediaLibrary();
            }}
          >
            {t.manageMedia}
          </button>
          <button
            className={`button ${section === "background" ? "primary" : "secondary"}`}
            type="button"
            onClick={() => {
              setSection("background");
              void loadMediaLibrary();
            }}
          >
            {t.backgroundSettings}
          </button>
          <button
            className={`button ${section === "categories" ? "primary" : "secondary"}`}
            type="button"
            onClick={() => {
              setSection("categories");
              void loadCategories(true);
            }}
          >
            {t.manageCategories}
          </button>
          <button className={`button ${section === "home" ? "primary" : "secondary"}`} type="button" onClick={() => setSection("home")}>
            {t.homeSettings}
          </button>
          <button
            className={`button ${section === "messages" ? "primary" : "secondary"}`}
            type="button"
            onClick={() => {
              setSection("messages");
              void loadMessages();
            }}
          >
            {t.manageMessages}
          </button>
          <button className="button secondary" type="button" onClick={logoutAdmin}>
            {t.logout}
          </button>
        </div>
      </aside>

      {section === "dashboard" ? (
        <PortalAdminDashboard copy={portalT} />
      ) : section === "news" ? (
        <PortalChannelAdminPanel title={portalT.news} description={portalT.comingSoon} href="/news" />
      ) : section === "novels" ? (
        <PortalChannelAdminPanel title={portalT.novels} description={portalT.comingSoon} href="/novels" />
      ) : section === "shop" ? (
        <PortalChannelAdminPanel title={portalT.shop} description={portalT.comingSoon} href="/shop" />
      ) : section === "home" ? (
        <HomeSettingsPanel
          settings={homeSettings}
          copy={t}
          isLoading={isLoadingHomeSettings}
          isSaving={isSaving}
          onChange={updateHomeSettings}
          onMoveSection={moveHomeSection}
          onDropSection={dragHomeSection}
          onRefresh={loadHomeSettings}
          onSave={saveHomeSettings}
        />
      ) : section === "categories" ? (
        <CategorySettingsPanel
          categories={categoryItems}
          copy={t}
          isSaving={isSaving}
          onAdd={addCategory}
          onChange={updateCategory}
          onMove={moveCategory}
          onRemove={removeCategory}
          onSave={saveCategories}
        />
      ) : section === "manage" ? (
        <ManagePostsPanel
          posts={managedPosts}
          copy={t}
          isLoading={isLoadingPosts}
          onRefresh={loadManagedPosts}
          onEdit={loadPostIntoEditor}
          onPreview={previewPostInEditor}
          onDelete={deleteManagedPost}
        />
      ) : section === "media" ? (
        <MediaLibraryPanel
          mediaItems={mediaItems}
          storage={mediaStorage}
          copy={t}
          isLoading={isLoadingMedia}
          error={mediaError}
          onRefresh={loadMediaLibrary}
          onInsert={insertMediaItem}
          onSetCover={setMediaAsCover}
          onSetBackground={setMediaAsHomeBackground}
          onDelete={deleteMediaItem}
        />
      ) : section === "background" ? (
        <BackgroundSettingsPanel
          settings={homeSettings}
          mediaItems={mediaItems}
          copy={t}
          isLoading={isLoadingMedia || isSaving || uploadState === "uploading"}
          error={mediaError || uploadError}
          onRefresh={loadMediaLibrary}
          onChange={updateBackgroundSettings}
          onUpload={uploadHomeBackground}
        />
      ) : section === "messages" ? (
        <MessagesPanel
          messages={messages}
          copy={t}
          isLoading={isLoadingMessages}
          onRefresh={loadMessages}
          onDelete={deleteMessage}
        />
      ) : (
      <section className="grid gap-0">
        <div className="card rounded-b-none border-b-0 p-3 md:p-4">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-950">{t.newPost}</h2>
              <p className="text-xs text-slate-500">{t.richIntro}</p>
            </div>
            <div className="admin-actions flex flex-wrap gap-2">
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  const nextMode = mode === "edit" ? "preview" : "edit";
                  setMode(nextMode);
                  setNotice(nextMode === "preview" ? t.preview : t.edit);
                }}
              >
                {mode === "edit" ? t.preview : t.edit}
              </button>
              <button className="button secondary" type="button" onClick={() => void saveDraft("Draft")} disabled={isSaving}>
                {isSaving ? t.saving : t.saveDraft}
              </button>
              <button className="button secondary" type="button" onClick={startNewDraft} disabled={isSaving}>
                {t.newDraft}
              </button>
              <button
                className="button primary"
                type="button"
                disabled={isSaving}
                onClick={() => {
                  void saveDraft("Published").then((saved) => {
                    if (saved) {
                      setMode("preview");
                    }
                  });
                }}
              >
                {isSaving ? t.saving : t.publish}
              </button>
            </div>
          </div>

          <div className="grid gap-2.5 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">{t.title}</span>
              <input
                className="field compact-field text-lg font-black"
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(event.target.value);
                  if (isAutoSlug(slug)) {
                    setSlug(makeSlug(nextTitle));
                  }
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">{t.slug}</span>
              <input className="field compact-field" value={slug} onChange={(event) => setSlug(sanitizeSlug(event.target.value))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">{t.category}</span>
              <select className="field compact-field" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categoryItems.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {getCategoryLabel(categoryItems, item.slug, language)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">{t.tags}</span>
              <input className="field compact-field" value={tags} onChange={(event) => setTags(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">{t.coverUrl}</span>
              <input className="field compact-field" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder={t.coverPlaceholder} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">{t.excerpt}</span>
              <textarea className="field compact-field min-h-10 resize-y" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} />
            </label>
          </div>
        </div>

        {mode === "edit" ? (
          <div className="grid gap-0">
            <div className="card rounded-t-none p-3 md:p-4">
              <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-950">{t.richEditor}</h2>
                  <p className="text-xs text-slate-500">{t.richPlaceholder}</p>
                </div>
                <button className="button primary min-h-9 px-3 text-xs" type="button" onClick={() => void saveDraft("Draft")} disabled={isSaving}>
                  {isSaving ? t.saving : t.saveDraft}
                </button>
              </div>
              <RichTextEditor
                key={editorResetKey}
                content={richContent}
                insertRequest={insertRequest}
                labels={{
                  paragraph: t.paragraph,
                  heading1: t.heading1,
                  heading2: t.heading2,
                  heading3: t.heading3,
                  bold: t.bold,
                  italic: t.italic,
                  strike: t.strike,
                  inlineCode: t.inlineCode,
                  quote: t.blockTypes.quote,
                  code: t.blockTypes.code,
                  bulletList: t.bulletList,
                  orderedList: t.orderedList,
                  link: t.blockTypes.link,
                  unlink: t.unlink,
                  image: t.insertImageUrl,
                  imageUpload: t.uploadImageFile,
                  imageUploading: t.uploading,
                  imageSmall: t.imageSmall,
                  imageMedium: t.imageMedium,
                  imageFull: t.imageFull,
                  imageCustom: t.imageCustom,
                  imageWidthPrompt: t.imageWidthPrompt,
                  imageCaption: t.imageCaption,
                  imageAlignLeft: t.imageAlignLeft,
                  imageAlignCenter: t.imageAlignCenter,
                  imageAlignRight: t.imageAlignRight,
                  textColor: t.textColor,
                  highlightColor: t.highlightColor,
                  fontSize: t.fontSize,
                  fontFamily: t.fontFamily,
                  alignLeft: t.alignLeft,
                  alignCenter: t.alignCenter,
                  alignRight: t.alignRight,
                  insertTable: t.insertTable,
                  tableAddRow: t.tableAddRow,
                  tableAddColumn: t.tableAddColumn,
                  tableDeleteRow: t.tableDeleteRow,
                  tableDeleteColumn: t.tableDeleteColumn,
                  tableDeleteTable: t.tableDeleteTable,
                  tableMergeRight: t.tableMergeRight,
                  tableSplitCell: t.tableSplitCell,
                  tableToggleWidth: t.tableToggleWidth,
                  findReplace: t.findReplace,
                  fullScreen: t.fullScreen,
                  exitFullScreen: t.exitFullScreen,
                  autosaved: t.autosaved,
                  video: t.insertVideoUrl,
                  audio: t.insertAudioUrl,
                  divider: t.divider,
                  deleteDivider: t.deleteDivider,
                  lineBreak: t.lineBreak,
                  clearFormat: t.clearFormat,
                  undo: t.undo,
                  redo: t.redo,
                  placeholder: t.richPlaceholder,
                }}
                onChange={(html, text) => {
                  setRichContent(html);
                  setRichText(text);
                }}
                onUploadFile={uploadEditorImage}
              />
            </div>
          </div>
        ) : (
          <ArticlePreview
            title={title}
            excerpt={excerpt}
            category={getCategoryLabel(categoryItems, category, language)}
            tags={tags}
            coverUrl={coverUrl}
            richContent={richContent}
            blocks={blocks}
            copy={t}
          />
        )}
      </section>
      )}

      <aside className="grid h-fit gap-6">
        <form onSubmit={handleUpload} className="card p-4 md:p-5">
          <h2 className="text-xl font-black tracking-tight text-slate-950">{t.mediaLibrary}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t.mediaIntro}</p>
          <div className="mt-5 grid gap-4">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">{t.loggedIn}</p>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">{t.placement}</span>
              <select className="field" name="placement">
                <option value="block">{t.insertBlock}</option>
                <option value="cover">{t.setCover}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">{t.mediaFile}</span>
              <input className="field" name="media" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm" />
            </label>
            <button className="button primary" type="submit" disabled={uploadState === "uploading"}>
              {uploadState === "uploading" ? t.uploading : t.uploadMedia}
            </button>
          </div>
          {uploadState === "done" && <p className="mt-4 break-all rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{imageUrl}</p>}
          {uploadState === "error" && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {t.uploadFailed}: {uploadError || "Check R2 settings."}
            </p>
          )}
        </form>

        <div className="card p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-950">{t.mediaRepository}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t.mediaRepositoryIntro}</p>
            </div>
            <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={() => void loadMediaLibrary()} disabled={isLoadingMedia}>
              {isLoadingMedia ? t.loadingMedia : t.refreshMedia}
            </button>
          </div>
          {mediaError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{mediaError}</p>}
          <div className="mt-5 grid max-h-[560px] gap-3 overflow-auto pr-1">
            {mediaItems.length ? (
              mediaItems.map((item) => (
                <article key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="overflow-hidden rounded-md bg-slate-100">
                    {item.type === "image" && item.url ? (
                      <img className="h-28 w-full object-contain" src={item.url} alt={item.name} />
                    ) : null}
                    {item.type === "video" && item.url ? (
                      <video className="h-28 w-full bg-slate-950 object-cover" src={item.url} controls />
                    ) : null}
                    {item.type === "audio" && item.url ? (
                      <div className="grid h-28 place-items-center p-3">
                        <audio className="w-full" src={item.url} controls />
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 line-clamp-2 break-all text-sm font-bold leading-5 text-slate-950">{item.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {item.type} · {formatFileSize(item.size)} {formatMediaDate(item.uploadedAt) ? `· ${formatMediaDate(item.uploadedAt)}` : ""}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="button primary min-h-9 px-3 text-xs" type="button" onClick={() => insertMediaItem(item)}>
                      {t.insertMedia}
                    </button>
                    <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={() => setMediaAsCover(item)} disabled={item.type !== "image"}>
                      {t.setCover}
                    </button>
                    <button className="button secondary col-span-2 min-h-9 px-3 text-xs" type="button" onClick={() => void setMediaAsHomeBackground(item)} disabled={item.type !== "image" || isSaving}>
                      {t.setBackground}
                    </button>
                    <button
                      className="button secondary col-span-2 min-h-9 px-3 text-xs"
                      type="button"
                      onClick={() => void deleteMediaItem(item)}
                      disabled={isLoadingMedia}
                    >
                      {t.deleteMedia}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                {isLoadingMedia ? t.loadingMedia : t.noMedia}
              </div>
            )}
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <h2 className="text-xl font-black tracking-tight text-slate-950">{t.publishingTools}</h2>
          <div className="mt-5 grid gap-3">
            <button className="button secondary" type="button" onClick={exportJson}>
              {t.exportJson}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setRichContent("");
                setRichText("");
                setBlocks([]);
                setEditorResetKey((key) => key + 1);
                setNotice(t.blocksReset);
              }}
            >
              {t.resetBlocks}
            </button>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            {t.toolNote}
          </p>
        </div>
      </aside>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  );
}

function MediaLibraryPanel({
  mediaItems,
  storage,
  copy,
  isLoading,
  error,
  onRefresh,
  onInsert,
  onSetCover,
  onSetBackground,
  onDelete,
}: {
  mediaItems: MediaItem[];
  storage: MediaStorageInfo | null;
  copy: AdminCopy;
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
  onInsert: (item: MediaItem) => void;
  onSetCover: (item: MediaItem) => void;
  onSetBackground: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}) {
  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{copy.manageMedia}</h2>
            <p className="text-sm text-slate-500">{copy.manageMediaIntro}</p>
          </div>
          <button className="button primary" type="button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? copy.loadingMedia : copy.refreshMedia}
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <StorageStat label={copy.storageUsed} value={storage ? formatFileSize(storage.totalSizeBytes) : "--"} />
          <StorageStat label={copy.storageFreeTier} value={storage ? formatFileSize(storage.freeTierBytes) : "10 GB"} />
          <StorageStat label={copy.storageRemaining} value={storage ? formatFileSize(storage.remainingFreeTierBytes) : "--"} />
          <StorageStat label={copy.storageObjects} value={storage ? String(storage.objectCount) : String(mediaItems.length)} />
        </div>
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width: storage ? `${Math.max(0.5, Math.min(100, storage.usagePercent))}%` : "0%" }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {copy.storageUsageNote}: {storage ? formatUsagePercent(storage.usagePercent) : "0%"}
          </p>
        </div>

        {mediaItems.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mediaItems.map((item) => (
              <article key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="overflow-hidden rounded-md bg-slate-100">
                  {item.type === "image" && item.url ? <img className="h-44 w-full object-contain" src={item.url} alt={item.name} /> : null}
                  {item.type === "video" && item.url ? <video className="h-44 w-full bg-slate-950 object-cover" src={item.url} controls /> : null}
                  {item.type === "audio" && item.url ? (
                    <div className="grid h-44 place-items-center p-4">
                      <audio className="w-full" src={item.url} controls />
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 break-all text-sm font-bold leading-5 text-slate-950">{item.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {item.type} · {formatFileSize(item.size)} {formatMediaDate(item.uploadedAt) ? `· ${formatMediaDate(item.uploadedAt)}` : ""}
                </p>
                <p className="mt-2 line-clamp-1 break-all text-xs text-slate-400">{item.key}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="button primary min-h-9 px-3 text-xs" type="button" onClick={() => onInsert(item)}>
                    {copy.insertMedia}
                  </button>
                  <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={() => onSetCover(item)} disabled={item.type !== "image"}>
                    {copy.setCover}
                  </button>
                  <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={() => onSetBackground(item)} disabled={item.type !== "image" || isLoading}>
                    {copy.setBackground}
                  </button>
                  {item.url ? (
                    <>
                      <a className="button secondary min-h-9 px-3 text-xs" href={item.url} target="_blank" rel="noreferrer">
                        {copy.openFile}
                      </a>
                      <a className="button secondary min-h-9 px-3 text-xs" href={item.url} download={item.name} target="_blank" rel="noreferrer">
                        {copy.downloadFile}
                      </a>
                    </>
                  ) : null}
                  <button
                    className="button secondary col-span-2 min-h-9 px-3 text-xs"
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={isLoading}
                  >
                    {copy.deleteMedia}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            {isLoading ? copy.loadingMedia : copy.noMedia}
          </div>
        )}
      </div>
    </section>
  );
}

function StorageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function BackgroundSettingsPanel({
  settings,
  mediaItems,
  copy,
  isLoading,
  error,
  onRefresh,
  onChange,
  onUpload,
}: {
  settings: HomeSettings;
  mediaItems: MediaItem[];
  copy: AdminCopy;
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
  onChange: (patch: Pick<Partial<HomeSettings>, "backgroundColor" | "backgroundImage">) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  const [draftColor, setDraftColor] = useState(settings.backgroundColor || "#ffffff");
  const [draftImage, setDraftImage] = useState(settings.backgroundImage || "");
  const imageItems = mediaItems.filter((item) => item.type === "image" && item.url);
  const previewSettings = {
    backgroundColor: draftColor || "#ffffff",
    backgroundImage: draftImage,
  };

  useEffect(() => {
    setDraftColor(settings.backgroundColor || "#ffffff");
    setDraftImage(settings.backgroundImage || "");
  }, [settings.backgroundColor, settings.backgroundImage]);

  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{copy.backgroundSettings}</h2>
            <p className="text-sm text-slate-500">{copy.backgroundSettingsIntro}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button secondary" type="button" disabled={isLoading}>
              {copy.previewBackground}
            </button>
            <button className="button secondary" type="button" onClick={() => onChange({ backgroundColor: "#ffffff", backgroundImage: "" })} disabled={isLoading}>
              {copy.deleteBackground}
            </button>
            <button className="button primary" type="button" onClick={() => onChange(previewSettings)} disabled={isLoading}>
              {copy.confirmBackground}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-lg font-black text-slate-950">{copy.backgroundColor}</h3>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {backgroundPalette.map((color) => (
                  <button
                    key={color}
                    className={`h-12 rounded-lg border-2 ${settings.backgroundColor === color ? "border-blue-600" : "border-slate-300"}`}
                    type="button"
                    style={{ backgroundColor: color }}
                    title={color}
                    onClick={() => setDraftColor(color)}
                    disabled={isLoading}
                  />
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  key={settings.backgroundColor}
                  className="field"
                  value={draftColor}
                  onChange={(event) => setDraftColor(event.target.value)}
                  placeholder="#ffffff"
                />
                <button className="button secondary" type="button" onClick={() => setDraftColor("#ffffff")} disabled={isLoading}>
                  {copy.clearBackground}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-lg font-black text-slate-950">{copy.backgroundImage}</h3>
              <div className="mt-4 grid gap-3">
                <input
                  key={settings.backgroundImage}
                  className="field"
                  value={draftImage}
                  onChange={(event) => setDraftImage(event.target.value)}
                  placeholder="https://..."
                />
                <input
                  className="field"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];

                    if (file) {
                      void onUpload(file).then((url) => {
                        if (url) {
                          setDraftImage(url);
                        }
                      });
                      event.currentTarget.value = "";
                    }
                  }}
                  disabled={isLoading}
                />
                <button className="button secondary" type="button" onClick={() => setDraftImage("")} disabled={isLoading}>
                  {copy.clearBackground}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            <div
              className="min-h-64 rounded-lg border-2 border-slate-300 p-5 shadow-sm"
              style={{
                backgroundColor: previewSettings.backgroundColor,
                backgroundImage: previewSettings.backgroundImage ? `linear-gradient(rgba(255,255,255,0.74), rgba(255,255,255,0.86)), url("${previewSettings.backgroundImage}")` : undefined,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            >
              <div className="max-w-sm rounded-lg border-2 border-slate-300 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{copy.backgroundPreview}</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">MY Blog</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.backgroundSettingsIntro}</p>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-slate-950">{copy.chooseFromMedia}</h3>
                <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={onRefresh} disabled={isLoading}>
                  {isLoading ? copy.loadingMedia : copy.refreshMedia}
                </button>
              </div>
              <div className="mt-3 grid max-h-[460px] gap-3 overflow-auto sm:grid-cols-2">
                {imageItems.length ? (
                  imageItems.map((item) => (
                    <button
                      key={item.key}
                      className="overflow-hidden rounded-lg border-2 border-slate-300 bg-white text-left shadow-sm transition hover:border-blue-500"
                      type="button"
                      onClick={() => item.url && setDraftImage(item.url)}
                      disabled={isLoading}
                    >
                      <img className="h-28 w-full object-contain" src={item.url ?? ""} alt={item.name} />
                      <span className="block truncate px-3 py-2 text-xs font-bold text-slate-700">{item.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                    {isLoading ? copy.loadingMedia : copy.noMedia}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ManagePostsPanel({
  posts,
  copy,
  isLoading,
  onRefresh,
  onEdit,
  onPreview,
  onDelete,
}: {
  posts: ManagedPost[];
  copy: AdminCopy;
  isLoading: boolean;
  onRefresh: () => void;
  onEdit: (post: DraftPost) => void;
  onPreview: (post: DraftPost) => void;
  onDelete: (slug: string) => void;
}) {
  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{copy.managePosts}</h2>
            <p className="text-sm text-slate-500">{copy.managePostsIntro}</p>
          </div>
          <button className="button primary" type="button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? copy.loadingPosts : copy.refreshPosts}
          </button>
        </div>

        {posts.length ? (
          <div className="grid gap-3">
            {posts.map((post) => (
              <article key={post.slug} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black tracking-tight text-slate-950">{post.title}</p>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                        {post.status === "Published" ? copy.published : copy.draft}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      /posts/{post.slug} · {post.date} · {post.category}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.status === "Published" ? (
                      <a className="button secondary min-h-9 px-3 text-xs" href={`/posts/${post.slug}`} target="_blank" rel="noreferrer">
                        {copy.viewPost}
                      </a>
                    ) : (
                      <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={() => onPreview(post)}>
                        {copy.viewPost}
                      </button>
                    )}
                    <button className="button primary min-h-9 px-3 text-xs" type="button" onClick={() => onEdit(post)}>
                      {copy.editPost}
                    </button>
                    <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={() => onDelete(post.slug)} disabled={isLoading}>
                      {copy.deletePost}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            {isLoading ? copy.loadingPosts : copy.noManagedPosts}
          </div>
        )}
      </div>
    </section>
  );
}

function PortalAdminDashboard({ copy }: { copy: PortalAdminCopy }) {
  const cards = [
    { title: copy.homepage, body: "首页模块、滚动公告、背景、友情链接和联系区域。" },
    { title: copy.content, body: "新闻、小说、博客文章都放在内容频道里统一管理。" },
    { title: copy.commerce, body: "商品展示已经有前台页面，下一步可以接订单和付款。" },
    { title: copy.system, body: "媒体库、分类、留言、后台安全和网站设置继续保留。" },
  ];

  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="mb-5">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{copy.dashboard}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.dashboardIntro}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.title} className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-black text-slate-950">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortalChannelAdminPanel({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <a className="button primary" href={href} target="_blank" rel="noreferrer">
            打开前台页面
          </a>
        </div>
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold leading-6 text-slate-500">
          下一步这里可以增加：新增、编辑、删除、上传封面、设置推荐、排序、发布状态。
        </div>
      </div>
    </section>
  );
}

function MessagesPanel({
  messages,
  copy,
  isLoading,
  onRefresh,
  onDelete,
}: {
  messages: SiteMessage[];
  copy: AdminCopy;
  isLoading: boolean;
  onRefresh: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{copy.manageMessages}</h2>
            <p className="text-sm text-slate-500">{copy.manageMessagesIntro}</p>
          </div>
          <button className="button primary" type="button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? copy.loadingMessages : copy.refreshMessages}
          </button>
        </div>

        {messages.length ? (
          <div className="grid gap-3">
            {messages.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {item.name || "-"} {item.email ? `· ${item.email}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">{item.message}</p>
                  </div>
                  <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={() => onDelete(item.id)} disabled={isLoading}>
                    {copy.deletePost}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            {isLoading ? copy.loadingMessages : copy.noMessages}
          </div>
        )}
      </div>
    </section>
  );
}

function CategorySettingsPanel({
  categories,
  copy,
  isSaving,
  onAdd,
  onChange,
  onMove,
  onRemove,
  onSave,
}: {
  categories: BlogCategory[];
  copy: AdminCopy;
  isSaving: boolean;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<BlogCategory>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
}) {
  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{copy.manageCategories}</h2>
            <p className="text-sm text-slate-500">{copy.manageCategoriesIntro}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button secondary" type="button" onClick={onAdd}>
              {copy.addCategory}
            </button>
            <button className="button primary" type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? copy.saving : copy.saveCategories}
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {categories.map((category, index) => (
            <article key={`${category.slug}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{copy.categoryZh}</span>
                  <input
                    className="field"
                    value={category.labels.zh}
                    onChange={(event) => onChange(index, { labels: { ...category.labels, zh: event.target.value } })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{copy.categoryEn}</span>
                  <input
                    className="field"
                    value={category.labels.en}
                    onChange={(event) => onChange(index, { labels: { ...category.labels, en: event.target.value } })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{copy.categoryKo}</span>
                  <input
                    className="field"
                    value={category.labels.ko}
                    onChange={(event) => onChange(index, { labels: { ...category.labels, ko: event.target.value } })}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="button secondary min-h-10 px-3 text-xs" type="button" disabled={index === 0} onClick={() => onMove(index, -1)}>
                    {copy.up}
                  </button>
                  <button className="button secondary min-h-10 px-3 text-xs" type="button" disabled={index === categories.length - 1} onClick={() => onMove(index, 1)}>
                    {copy.down}
                  </button>
                  <button className="button secondary min-h-10 px-3 text-xs" type="button" onClick={() => onRemove(index)}>
                    {copy.deletePost}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeSettingsPanel({
  settings,
  copy,
  isLoading,
  isSaving,
  onChange,
  onMoveSection,
  onDropSection,
  onRefresh,
  onSave,
}: {
  settings: HomeSettings;
  copy: AdminCopy;
  isLoading: boolean;
  isSaving: boolean;
  onChange: (patch: Partial<HomeSettings>) => void;
  onMoveSection: (section: HomeSection, direction: -1 | 1) => void;
  onDropSection: (section: HomeSection, target: HomeSection) => void;
  onRefresh: () => void;
  onSave: () => void;
}) {
  const friendLinks = settings.friendLinks ?? [];
  const marqueeItems = settings.marqueeItems ?? [];

  function updateMarqueeItems(nextItems: typeof marqueeItems) {
    onChange({
      marqueeItems: nextItems,
      marqueeText: nextItems[0]?.text ?? "",
    });
  }

  return (
    <section className="grid gap-6">
      <div className="card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">门户首页设置</h2>
            <p className="text-sm text-slate-500">设置当前门户首页使用的站点名称、SEO、顶部滚动文字、友情链接和联系区域。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button secondary" type="button" onClick={onRefresh} disabled={isLoading || isSaving}>
              {isLoading ? copy.loadingHomeSettings : copy.refreshHomeSettings}
            </button>
            <button className="button primary" type="button" onClick={onSave} disabled={isLoading || isSaving}>
              {isSaving ? copy.saving : copy.saveHomeSettings}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <HomeField label={copy.siteName} value={settings.siteName} onChange={(value) => onChange({ siteName: value })} />
          <HomeField label={copy.seoTitle} value={settings.seoTitle} onChange={(value) => onChange({ seoTitle: value })} />
          <HomeTextArea label={copy.seoDescription} value={settings.seoDescription} onChange={(value) => onChange({ seoDescription: value })} />
          <HomeField label={copy.contactTitle} value={settings.contactTitle} onChange={(value) => onChange({ contactTitle: value })} />
          <HomeField label={copy.contactButton} value={settings.contactButton} onChange={(value) => onChange({ contactButton: value })} />
          <HomeTextArea label={copy.contactIntro} value={settings.contactIntro} onChange={(value) => onChange({ contactIntro: value })} />
          <HomeField label={copy.friendLinksTitle} value={settings.friendLinksTitle} onChange={(value) => onChange({ friendLinksTitle: value })} />
          <HomeTextArea label={copy.friendLinksIntro} value={settings.friendLinksIntro} onChange={(value) => onChange({ friendLinksIntro: value })} />
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950">{copy.marqueeSettings}</h3>
              <p className="mt-1 text-sm text-slate-500">{copy.marqueeSettingsIntro}</p>
            </div>
            <button
              className="button secondary min-h-9 px-3 text-xs"
              type="button"
              onClick={() => updateMarqueeItems([...marqueeItems, { id: createId(), text: "" }])}
            >
              {copy.addMarqueeItem}
            </button>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <HomeNumberField
              label={copy.marqueeSpeed}
              value={settings.marqueeSpeed}
              min={4}
              max={90}
              onChange={(value) => onChange({ marqueeSpeed: value })}
            />
            <HomeNumberField
              label={copy.marqueeGap}
              value={settings.marqueeGap}
              min={0}
              max={30}
              onChange={(value) => onChange({ marqueeGap: value })}
            />
          </div>

          <div className="grid gap-3">
            {marqueeItems.map((item, index) => (
              <article key={item.id || index} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <HomeTextArea
                    label={`${copy.marqueeItemText} ${index + 1}`}
                    value={item.text}
                    onChange={(value) =>
                      updateMarqueeItems(marqueeItems.map((entry, itemIndex) => (itemIndex === index ? { ...entry, text: value } : entry)))
                    }
                  />
                  <button
                    className="button secondary min-h-11 px-3 text-xs"
                    type="button"
                    onClick={() => updateMarqueeItems(marqueeItems.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    {copy.removeMarqueeItem}
                  </button>
                </div>
              </article>
            ))}
            {!marqueeItems.length && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-bold text-slate-500">
                {copy.noMarqueeItems}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950">{copy.friendLinksManage}</h3>
              <p className="mt-1 text-sm text-slate-500">{copy.friendLinksManageIntro}</p>
            </div>
            <button
              className="button secondary min-h-9 px-3 text-xs"
              type="button"
              onClick={() =>
                onChange({
                  friendLinks: [...friendLinks, { id: createId(), name: "", url: "https://", description: "" }],
                })
              }
            >
              {copy.addFriendLink}
            </button>
          </div>
          <div className="grid gap-3">
            {friendLinks.map((link, index) => (
              <article key={link.id || index} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_1.4fr_auto] md:items-end">
                  <HomeField
                    label={copy.friendLinkName}
                    value={link.name}
                    onChange={(value) =>
                      onChange({
                        friendLinks: friendLinks.map((item, itemIndex) => (itemIndex === index ? { ...item, name: value } : item)),
                      })
                    }
                  />
                  <HomeField
                    label={copy.friendLinkUrl}
                    value={link.url}
                    onChange={(value) =>
                      onChange({
                        friendLinks: friendLinks.map((item, itemIndex) => (itemIndex === index ? { ...item, url: value } : item)),
                      })
                    }
                  />
                  <HomeField
                    label={copy.friendLinkDescription}
                    value={link.description}
                    onChange={(value) =>
                      onChange({
                        friendLinks: friendLinks.map((item, itemIndex) => (itemIndex === index ? { ...item, description: value } : item)),
                      })
                    }
                  />
                  <button
                    className="button secondary min-h-11 px-3 text-xs"
                    type="button"
                    onClick={() => onChange({ friendLinks: friendLinks.filter((_, itemIndex) => itemIndex !== index) })}
                  >
                    {copy.removeFriendLink}
                  </button>
                </div>
              </article>
            ))}
            {!friendLinks.length && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-bold text-slate-500">
                {copy.noFriendLinksAdmin}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeField({
  label,
  value,
  wide,
  onChange,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <input className="field" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function HomeNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value?: number | null;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <input
        className="field"
        type="number"
        min={min}
        max={max}
        value={value ?? min}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
      />
    </label>
  );
}

function HomeTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <textarea className="field min-h-32 resize-y" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function BlockEditor({
  block,
  index,
  isFirst,
  isLast,
  isSelected,
  copy,
  onSelect,
  onChange,
  onMove,
  onRemove,
}: {
  block: ContentBlock;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  copy: AdminCopy;
  onSelect: () => void;
  onChange: (patch: Partial<ContentBlock>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm transition ${isSelected ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-200"}`}
      onClick={onSelect}
    >
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">#{index + 1}</span>
          <select className="field max-w-44 py-2 text-sm" value={block.type} onChange={(event) => onChange(createBlock(event.target.value as BlockType, copy))}>
            {(Object.keys(copy.blockTypes) as BlockType[]).map((type) => (
              <option key={type} value={type}>
                {copy.blockTypes[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="button secondary min-h-9 px-3 text-xs" type="button" disabled={isFirst} onClick={() => onMove(-1)}>
            {copy.up}
          </button>
          <button className="button secondary min-h-9 px-3 text-xs" type="button" disabled={isLast} onClick={() => onMove(1)}>
            {copy.down}
          </button>
          <button className="button secondary min-h-9 px-3 text-xs" type="button" onClick={onRemove}>
            {copy.remove}
          </button>
        </div>
      </div>
      <BlockFields block={block} copy={copy} onChange={onChange} onFocus={onSelect} />
    </article>
  );
}

function BlockFields({
  block,
  copy,
  onChange,
  onFocus,
}: {
  block: ContentBlock;
  copy: AdminCopy;
  onChange: (patch: Partial<ContentBlock>) => void;
  onFocus: () => void;
}) {
  if (block.type === "image" || block.type === "video" || block.type === "audio") {
    return (
      <div className="grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">{copy.mediaUrl}</span>
          <input className="field" value={block.url ?? ""} onFocus={onFocus} onChange={(event) => onChange({ url: event.target.value })} placeholder={copy.mediaUrlPlaceholder} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">{copy.caption}</span>
          <input className="field" value={block.caption ?? ""} onFocus={onFocus} onChange={(event) => onChange({ caption: event.target.value })} />
        </label>
      </div>
    );
  }

  if (block.type === "link") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">{copy.linkText}</span>
          <input className="field" value={block.content} onFocus={onFocus} onChange={(event) => onChange({ content: event.target.value })} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">{copy.url}</span>
          <input className="field" value={block.url ?? ""} onFocus={onFocus} onChange={(event) => onChange({ url: event.target.value })} />
        </label>
      </div>
    );
  }

  if (block.type === "code") {
    return <textarea className="field min-h-72 resize-y font-mono text-sm" value={block.content} onFocus={onFocus} onChange={(event) => onChange({ content: event.target.value })} />;
  }

  return (
    <textarea
      className={`field resize-y ${block.type === "heading" ? "min-h-28 text-3xl font-black" : "min-h-72 text-lg leading-8"}`}
      value={block.content}
      onFocus={onFocus}
      onChange={(event) => onChange({ content: event.target.value })}
    />
  );
}

function ArticlePreview({
  title,
  excerpt,
  category,
  tags,
  coverUrl,
  richContent,
  blocks,
  copy,
}: {
  title: string;
  excerpt: string;
  category: string;
  tags: string;
  coverUrl: string;
  richContent: string;
  blocks: ContentBlock[];
  copy: AdminCopy;
}) {
  return (
    <article className="card overflow-hidden">
      {coverUrl && <img className="h-80 w-full object-cover" src={coverUrl} alt="" />}
      <div className="p-6 md:p-8">
        <p className="text-sm font-bold text-blue-700">{category}</p>
        <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-slate-950">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">{excerpt}</p>
        <p className="mt-4 text-sm font-semibold text-slate-500">{tags}</p>
        <div className="prose-editor mt-8 text-lg leading-8 text-slate-700" dangerouslySetInnerHTML={{ __html: richContent }} />
        <div className="mt-8 space-y-6">
          {blocks.map((block) => (
            <PreviewBlock key={block.id} block={block} copy={copy} />
          ))}
        </div>
      </div>
    </article>
  );
}

function PreviewBlock({ block, copy }: { block: ContentBlock; copy: AdminCopy }) {
  if (block.type === "heading") {
    return <h2 className="text-3xl font-black tracking-tight text-slate-950">{block.content}</h2>;
  }

  if (block.type === "image") {
    return (
      <figure>
        {block.url ? <img className="max-h-[520px] w-full rounded-lg object-cover" src={block.url} alt={block.caption ?? ""} /> : <MediaEmpty label={copy.missingImage} />}
        {block.caption && <figcaption className="mt-2 text-sm text-slate-500">{block.caption}</figcaption>}
      </figure>
    );
  }

  if (block.type === "video") {
    return (
      <figure>
        {block.url ? <video className="w-full rounded-lg bg-slate-950" src={block.url} controls /> : <MediaEmpty label={copy.missingVideo} />}
        {block.caption && <figcaption className="mt-2 text-sm text-slate-500">{block.caption}</figcaption>}
      </figure>
    );
  }

  if (block.type === "audio") {
    return (
      <figure className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        {block.url ? <audio className="w-full" src={block.url} controls /> : <MediaEmpty label={copy.missingAudio} />}
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

  return <p className="text-lg leading-8 text-slate-700">{block.content}</p>;
}

function MediaEmpty({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">{label}</div>;
}
