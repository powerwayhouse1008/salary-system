import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "給与・歩合管理",
  description: "不動産会社向け給与・税金・歩合管理システム"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
