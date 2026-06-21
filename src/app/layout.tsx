import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MY Blog",
  description: "Write, publish, and archive ideas with a full-feature blog.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "MY Blog",
    description: "Write, publish, and archive ideas.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
