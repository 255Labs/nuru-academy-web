"use client";

import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { HydrateFromServer } from "./HydrateFromServer";
import { useGeoLanguage } from "@/lib/useGeoLanguage";
import { ContentProtection, LearnerWatermark } from "./ContentProtection";

export function Shell({ children }: { children: React.ReactNode }) {
  useGeoLanguage();

  return (
    <div className="app-bg flex min-h-screen">
      <HydrateFromServer />
      <ContentProtection />
      <LearnerWatermark />
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 min-w-0 px-5 lg:px-8 py-6 pb-24 lg:pb-6 relative z-10 protected-content">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
