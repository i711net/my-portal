import type { Language } from "@/lib/i18n";

export type BlogCategory = {
  slug: string;
  labels: Record<Language, string>;
};

export const defaultCategories: BlogCategory[] = [
  { slug: "Workflow", labels: { en: "Workflow", zh: "工作流", ko: "워크플로" } },
  { slug: "Engineering", labels: { en: "Engineering", zh: "工程", ko: "엔지니어링" } },
  { slug: "Publishing", labels: { en: "Publishing", zh: "发布", ko: "발행" } },
  { slug: "Design", labels: { en: "Design", zh: "设计", ko: "디자인" } },
];

export function getCategoryLabel(categories: BlogCategory[], slug: string, language: Language) {
  return categories.find((category) => category.slug === slug)?.labels[language] ?? slug;
}

export function makeCategorySlug(label: string) {
  return label
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}
