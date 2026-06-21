import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

type PortalChannel = "news" | "novels" | "shop";

const channelData: Record<
  PortalChannel,
  {
    title: string;
    intro: string;
    items: Array<{ title: string; summary: string; meta: string }>;
  }
> = {
  news: {
    title: "新闻区域",
    intro: "这里是门户网站的新闻频道。后续可以接入新闻后台、分类、推荐和搜索。",
    items: Array.from({ length: 12 }, (_, index) => ({
      title: `新闻内容 ${index + 1}`,
      summary: "新闻频道分页已经建立，后续可以把这里换成数据库里的真实新闻内容。",
      meta: "News",
    })),
  },
  novels: {
    title: "小说区域",
    intro: "这里是小说频道。后续可以建立作品、章节、连载状态和阅读页面。",
    items: Array.from({ length: 12 }, (_, index) => ({
      title: `小说作品 ${index + 1}`,
      summary: "小说分页已经建立，后续可以把这里换成作品封面、简介和章节入口。",
      meta: "Novel",
    })),
  },
  shop: {
    title: "商品区域",
    intro: "这里是商品频道。现在先做展示页，后续再接商品后台、订单和支付。",
    items: Array.from({ length: 12 }, (_, index) => ({
      title: `商品展示 ${index + 1}`,
      summary: "商品分页已经建立，后续可以接价格、库存、商品图和付款按钮。",
      meta: `$${(index + 1) * 5}.00`,
    })),
  },
};

export function PortalChannelPage({ channel }: { channel: PortalChannel }) {
  const data = channelData[channel];

  return (
    <div className="page-shell">
      <SiteHeader siteName="MY Portal" />
      <main className="portal-page">
        <section className="container portal-channel-hero">
          <Link className="portal-back-link" href="/">
            返回门户首页
          </Link>
          <h1>{data.title}</h1>
          <p>{data.intro}</p>
        </section>
        <section className="container portal-section portal-section-last">
          <div className="portal-image-grid">
            {data.items.map((item) => (
              <article key={item.title} className="portal-card portal-compact-card">
                <div className="portal-image-thumb">{item.meta}</div>
                <span>{item.meta}</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
