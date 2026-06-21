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
    openNews: "进入新闻",
    openNovels: "进入小说",
    openShop: "进入商品",
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
    openNews: "Open News",
    openNovels: "Open Novels",
    openShop: "Open Shop",
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
    openNews: "뉴스 열기",
    openNovels: "소설 열기",
    openShop: "상품 열기",
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
  { title: "网站后台升级", summary: "管理员入口会变成整个门户的控制台，而不是单一博客后台。" },
  { title: "移动端优化", summary: "首页模块会保持紧凑，让手机浏览也能快速看到重点内容。" },
  { title: "媒体库复用", summary: "R2 媒体库后续可同时服务新闻、小说封面、商品图片和博客。" },
  { title: "分类系统准备", summary: "不同频道可以拥有各自分类，也可以使用统一标签体系。" },
  { title: "SEO 页面规划", summary: "频道分页会有独立地址，便于搜索引擎收录。" },
  { title: "订单功能预留", summary: "商品展示先完成，订单和付款放到下一阶段接入。" },
  { title: "小说章节结构", summary: "小说频道后续会增加作品、卷、章节和连载状态。" },
  { title: "门户首页布局", summary: "首页先以模块方式展示，各区块后续可后台控制排序。" },
  { title: "安全设置沿用", summary: "后台登录、删除确认和媒体上传继续复用已有安全设置。" },
];

const novelItems = [
  { title: "长篇小说示例", summary: "以后这里可以显示作品封面、简介、章节列表和最新更新。" },
  { title: "短篇故事集", summary: "适合放连续更新的小故事、随笔小说或翻译内容。" },
  { title: "连载专区", summary: "按更新时间排序，读者可以直接进入最新章节。" },
  { title: "都市故事", summary: "适合日常生活、人物关系和现实题材连载。" },
  { title: "科幻世界", summary: "可以做设定集、章节更新和角色资料。" },
  { title: "悬疑短篇", summary: "适合按系列整理，读者可以一篇篇阅读。" },
  { title: "历史架空", summary: "后续可加入年代表、人物表和地图资料。" },
  { title: "奇幻冒险", summary: "适合展示封面、连载进度和最新章节。" },
  { title: "随笔小说", summary: "短内容也可以按小说频道收纳。" },
  { title: "翻译作品", summary: "预留来源、授权和章节说明的位置。" },
  { title: "完结作品", summary: "后续可以单独筛选已完结内容。" },
  { title: "新作预告", summary: "用来展示准备连载的新作品和简介。" },
];

const productItems = [
  { title: "数字资料包", price: "$9.90", summary: "适合售卖电子文档、素材、教程或下载资源。" },
  { title: "会员服务", price: "$19.00", summary: "后续可以接订阅、会员权限和订单记录。" },
  { title: "实物商品", price: "$29.00", summary: "可以放商品图、库存、规格和付款按钮。" },
  { title: "电子书", price: "$6.90", summary: "小说合集、教程或资料可以作为电子书出售。" },
  { title: "图片素材", price: "$4.90", summary: "适合售卖壁纸、设计素材和可下载资源。" },
  { title: "视频课程", price: "$49.00", summary: "后续可结合会员或单独购买功能。" },
  { title: "咨询服务", price: "$99.00", summary: "可以展示服务说明、时间和预约入口。" },
  { title: "模板文件", price: "$12.00", summary: "适合卖网站模板、文档模板和配置包。" },
  { title: "会员月卡", price: "$7.00", summary: "后续接入订阅付款和会员内容权限。" },
  { title: "赞助支持", price: "$3.00", summary: "可以作为读者打赏或网站支持入口。" },
  { title: "实体周边", price: "$18.00", summary: "适合展示库存、规格和物流说明。" },
  { title: "组合套餐", price: "$59.00", summary: "多个数字产品或服务可以打包销售。" },
];

export function PortalHome({ language, posts }: PortalHomeProps) {
  const copy = portalCopy[language];
  const latestPosts = posts.slice(0, 12);

  return (
    <main className="portal-page">
      <section id="news" className="container portal-section portal-first-section">
        <PortalSectionHeader title={copy.news} action={<Link href="/news">{copy.openNews}</Link>} />
        <div className="portal-image-grid">
          {newsItems.map((item) => (
            <PortalImageCard key={item.title} title={item.title} summary={item.summary} href="/news" />
          ))}
        </div>
      </section>

      <section id="novels" className="container portal-section">
        <PortalSectionHeader title={copy.novels} action={<Link href="/novels">{copy.openNovels}</Link>} />
        <div className="portal-image-grid">
          {novelItems.map((item) => (
            <PortalImageCard key={item.title} title={item.title} summary={item.summary} href="/novels" />
          ))}
        </div>
      </section>

      <section id="shop" className="container portal-section">
        <PortalSectionHeader title={copy.shop} action={<Link href="/shop">{copy.openShop}</Link>} />
        <div className="portal-image-grid">
          {productItems.map((item) => (
            <Link key={item.title} className="portal-card portal-compact-card" href="/shop">
              <div className="portal-product-image">{item.price}</div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container portal-section portal-section-last">
        <PortalSectionHeader title={copy.latestBlog} action={<Link href="/blog">{copy.viewBlog}</Link>} />
        {latestPosts.length ? (
          <div className="portal-image-grid">
            {latestPosts.map((post) => (
              <Link key={post.slug} className="portal-card portal-compact-card portal-blog-card" href={`/posts/${post.slug}`}>
                <div className="portal-image-thumb">{post.title.slice(0, 1).toUpperCase()}</div>
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

function PortalImageCard({ title, summary, href }: { title: string; summary: string; href: string }) {
  return (
    <Link className="portal-card portal-compact-card" href={href}>
      <div className="portal-image-thumb">{title.slice(0, 1)}</div>
      <h3>{title}</h3>
      <p>{summary}</p>
    </Link>
  );
}
