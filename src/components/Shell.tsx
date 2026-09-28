"use client";

import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { HydrateFromServer } from "./HydrateFromServer";
import { useGeoLanguage } from "@/lib/useGeoLanguage";
import { ContentProtection, LearnerWatermark } from "./ContentProtection";

export function Shell({ children }: { children: React.ReactNode }) {
  useGeoLanguage();

  return (
    <div className="app-bg min-h-screen">
      <HydrateFromServer />
      <ContentProtection />
      <LearnerWatermark />

      {/* Sidebar — fixed to viewport; main gets matching left offset so it isn't hidden behind it */}
      <div className="hidden lg:block fixed top-0 left-0 z-40 h-screen w-[252px]">
        <Sidebar />
      </div>

      {/* Main content — fills remaining width, no max-height constraint so it
          scrolls naturally with the page. The right panel inside page.tsx uses
          sticky positioning so it scrolls independently of this column. */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 lg:py-6 pb-24 lg:pb-8 relative z-10 protected-content lg:ml-[252px]">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
