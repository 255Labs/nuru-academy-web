"use client";

import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { HydrateFromServer } from "./HydrateFromServer";
import { useGeoLanguage } from "@/lib/useGeoLanguage";
import { ContentProtection, LearnerWatermark } from "./ContentProtection";

export function Shell({ children }: { children: React.ReactNode }) {
  useGeoLanguage();

  return (
    <>
      {/* Sidebar lives OUTSIDE .app-bg so .app-bg > * { position: relative }
          cannot override its position: fixed */}
      <div
        className="hidden lg:flex fixed top-0 left-0 z-40 h-screen w-[252px] flex-col"
        style={{
          background: "linear-gradient(180deg, #1C1050 0%, #130C3E 40%, #0D0828 100%)",
          borderRight: "1px solid rgba(124,92,255,0.18)",
        }}
      >
        <Sidebar />
      </div>

      <div className="app-bg min-h-screen lg:ml-[252px]">
        <HydrateFromServer />
        <ContentProtection />
        <LearnerWatermark />

        <main className="min-w-0 px-4 sm:px-6 lg:px-8 py-5 lg:py-6 pb-24 lg:pb-8 relative z-10 protected-content">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </>
  );
}
