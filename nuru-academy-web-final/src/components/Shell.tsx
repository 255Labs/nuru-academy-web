"use client";

import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { HydrateFromServer } from "./HydrateFromServer";
import { useGeoLanguage } from "@/lib/useGeoLanguage";

export function Shell({ children }: { children: React.ReactNode }) {
  // Silently detect location and apply regional language on first load
  useGeoLanguage();

  return (
    <div className="app-bg flex min-h-screen">
      <HydrateFromServer />
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 min-w-0 px-5 lg:px-8 py-6 pb-24 lg:pb-6 relative z-10">{children}</main>
      <BottomNav />
    </div>
  );
}
