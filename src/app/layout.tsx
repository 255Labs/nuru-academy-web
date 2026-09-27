import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { ThemeSync } from "@/components/ThemeSync";

// NOTE: This starter ships without next/font/google so it builds in any
// sandboxed/offline environment. On your machine (with normal internet),
// swap this back to next/font/google for optimized, self-hosted font
// loading — see PRODUCT_SETUP.md -> "Restoring Google Fonts".
//
// import { Baloo_2, Inter } from "next/font/google";
// const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", weight: ["500","600","700","800"] });
// const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400","500","600","700"] });
// Then set className={`${baloo.variable} ${inter.variable}`} below.

export const metadata: Metadata = {
  title: "Nuru AI Academy",
  description: "Tanzania's AI Powered, gamified skill-building academy — AI & Business Automation, Airbnb & Booking.com Operations, IT Fundamentals and more.",
};

// Runs synchronously before hydration so the correct theme class is present
// on <html> for the very first paint — avoids a flash of the wrong theme.
// Defaults to light when nothing is stored yet (light is this app's default).
const NO_FLASH_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("nuru-academy-storage");
    var theme = raw ? JSON.parse(raw).state.theme : "light";
    if (theme !== "light") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {/* Preload Nuru assets so they're ready before any component needs them */}
        <link rel="preload" href="/nuru/sprites.png" as="image" />
        <link rel="preload" href="/nuru/hero.png" as="image" />
      </head>
      <body className="font-body bg-nuru-bg text-nuru-ink antialiased">
        {/* Mux player web component — loaded async, only activates when MuxVideoPlayer is used */}
        <script async src="https://cdn.jsdelivr.net/npm/@mux/mux-player" />
        <Suspense fallback={null}>
          <ThemeSync />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
