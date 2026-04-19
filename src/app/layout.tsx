import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "十円 Coin Vote — Party Game",
  description: "Vote with a 10-yen coin hidden under a handkerchief!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#1a1a2e]">{children}</body>
    </html>
  );
}
