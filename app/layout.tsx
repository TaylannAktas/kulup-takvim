import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SearchPalette } from "@/components/search/SearchPalette";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kulüp Takvim ve Etkinlik Planlama Paneli",
  description: "IEEE Computer Society Atılım — kulüp etkinlik planlama takvimi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SearchPalette />
      </body>
    </html>
  );
}
