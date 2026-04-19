import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "十円 Coin Vote — Party Game",
  description: "Vote with a 10-yen coin hidden under a handkerchief!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#1a1a2e]">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
