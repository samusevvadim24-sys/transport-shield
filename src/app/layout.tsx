import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthSync from "@/components/auth/AuthSync";
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
  title: "Транспортный щит",
  description: "Цифровая система предрейсового контроля",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
