"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicPost } from "@/lib/blog-db";
import type { Language } from "@/lib/i18n";

type PortalHomeProps = {
  language: Language;
  posts: PublicPost[];
};

const portalCopy = {
  zh: {
    title: "MY Portal",
    subtitle: "综合门户首页",
    intro: "把博客、新闻、小说、商品和联系入口放在一个主页里。现在是第一版门户结构，后面可以继续接商品付款、小说章节和新闻后台。",
    blog: "博客频道",
    news: "新闻区域",
    novels: "小说区域",
    shop: "商品区域",
    latestBlog: "最新博客",
    viewBlog: "进入博客",
    readMore: "查看",
    buy: "查看商品",
    admin: "管理员后台",
    emptyBlog: "还没有博客文章。",
  },
  en: {
    title: "MY Portal",
    subtitle: "Portal Homepage",
    intro: "A single homepage for blog posts, news, novels, products, and contact links. This is the first portal version; payments, chapters, and news publishing can be added next.",
    blog: "Blog",
    news: "News",
    novels: "Novels",
    shop: "Shop",
    latestBlog: "Latest Blog",
    viewBlog: "Open Blog",
    readMore: "View",
    buy: "View Product",
    admin: "Admin",
    emptyBlog: "No blog posts yet.",
  },
  ko: {
    title: "MY Portal",
    subtitle: "포털 홈페이지",
    intro: "블로그, 뉴스, 소설, 상품, 연락 링크를 한 홈에 모은 첫 번째 포털 구조입니다. 다음 단계에서 결제, 소설 회차, 뉴스 관리를 붙일 수 있습니다.",
    blog: "블로그",
    news: "뉴스",
    novels: "소설",
    shop: "상품",
    latestBlog: "최신 블로그",
    viewBlog: "블로그 열기",
    readMore: "보기",
    buy: "상품 보기",
    admin: "관리자",
    emptyBlog: "아직 블로그 글이 없습니다.",
  },
};

const newsItems = [
  { title: "门户网站第一版上线准备", summary: "首页先整合主要频道，后续再逐步接后台管理和数据表。" },
  { title: "新闻频道规划", summary: "新闻内容可以和博客共用编辑器，也可以单独增加新闻管理。" },
  { title: "支付功能下一步", summary: "商品区先展示，后续可接 Stripe、PayPal 或其他支付方式。" },
];

const novelItems = [
  { title: "长篇小说示例", summary: "以后这里可以显示作品封面、简介、章节列表和最新更新。" },
  { title: "短篇故事集", summary: "适合放连续更新的小故事、随笔小说或翻译内容。" },
  { title: "连载专区", summary: "按更新时间排序，读者可以直接进入最新章节。" },
];

const productItems = [
  { title: "数字资料包", price: "$9.90", summary: "适合售卖电子文档、素材、教程或下载资源。" },
  { title: "会员服务", price: "$19.00", summary: "后续可以接订阅、会员权限和订单记录。" },
  { title: "实物商品", price: "$29.00", summary: "可以放商品图、库存、规格和付款按钮。" },
];

export function PortalHome({ language, posts }: PortalHomeProps) {
  const copy = portalCopy[language];
  const latestPosts = posts.slice(0, 4);

  return (
    <main className="portal-page">
      <section className="container portal-hero">
        <div className="portal-hero-copy">
          <p className="portal-subtitle">{copy.subtitle}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
          <div className="portal-actions">
            <Link className="button primary" href="/blog">
              {copy.viewBlog}
            </Link>
            <Link className="button secondary" href="/admin">
              {copy.admin}
            </Link>
          </div>
        </div>
        <div className="portal-channel-panel">
          {[
            { label: copy.news, href: "#news" },
            { label: copy.novels, href: "#novels" },
            { label: copy.shop, href: "#shop" },
            { label: copy.blog, href: "/blog" },
          ].map((item) => (
            <Link key={item.label} className="portal-channel-link" href={item.href}>
              <span>{item.label}</span>
              <strong>{copy.readMore}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section id="news" className="container portal-section">
        <PortalSectionHeader title={copy.news} />
        <div className="portal-grid">
          {newsItems.map((item) => (
            <PortalTextCard key={item.title} title={item.title} summary={item.summary} action={copy.readMore} />
          ))}
        </div>
      </section>

      <section id="novels" className="container portal-section">
        <PortalSectionHeader title={copy.novels} />
        <div className="portal-grid">
          {novelItems.map((item) => (
            <PortalTextCard key={item.title} title={item.title} summary={item.summary} action={copy.readMore} />
          ))}
        </div>
      </section>

      <section id="shop" className="container portal-section">
        <PortalSectionHeader title={copy.shop} />
        <div className="portal-grid">
          {productItems.map((item) => (
            <article key={item.title} className="portal-card">
              <div className="portal-product-image">{item.price}</div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <button className="button secondary" type="button">
                {copy.buy}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="container portal-section portal-section-last">
        <PortalSectionHeader title={copy.latestBlog} action={<Link href="/blog">{copy.viewBlog}</Link>} />
        {latestPosts.length ? (
          <div className="portal-grid portal-blog-grid">
            {latestPosts.map((post) => (
              <Link key={post.slug} className="portal-card portal-blog-card" href={`/posts/${post.slug}`}>
                <span>{post.category}</span>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <small>{post.date}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="portal-empty">{copy.emptyBlog}</div>
        )}
      </section>
    </main>
  );
}

function PortalSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="portal-section-header">
      <h2>{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}

function PortalTextCard({ title, summary, action }: { title: string; summary: string; action: string }) {
  return (
    <article className="portal-card">
      <h3>{title}</h3>
      <p>{summary}</p>
      <button className="button secondary" type="button">
        {action}
      </button>
    </article>
  );
}
