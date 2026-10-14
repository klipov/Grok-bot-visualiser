import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grok / Office",
  description:
    "A pixel office for your Grok team. Follow the work, one desk visit at a time.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
