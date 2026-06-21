export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  image?: string;
  featured?: boolean;
};

export const posts: Post[] = [
  {
    slug: "building-a-calm-writing-system",
    title: "Building a calm writing system",
    excerpt: "A practical note on turning scattered drafts into a publishing rhythm.",
    category: "Workflow",
    date: "2026-06-19",
    readTime: "5 min read",
    featured: true,
  },
  {
    slug: "cloudflare-r2-for-blog-images",
    title: "Cloudflare R2 for blog images",
    excerpt: "How direct browser uploads keep image publishing fast and inexpensive.",
    category: "Engineering",
    date: "2026-06-18",
    readTime: "7 min read",
  },
  {
    slug: "why-github-first-publishing-works",
    title: "Why GitHub-first publishing works",
    excerpt: "Use branches, previews, and history to make writing feel safer.",
    category: "Publishing",
    date: "2026-06-17",
    readTime: "4 min read",
  },
  {
    slug: "designing-a-readable-homepage",
    title: "Designing a readable homepage",
    excerpt: "The homepage should help readers choose, not make them decode your layout.",
    category: "Design",
    date: "2026-06-15",
    readTime: "6 min read",
  },
];

export const categories = ["All", "Workflow", "Engineering", "Publishing", "Design"];
