"use client";

import { useEffect } from "react";

/**
 * Reads the persisted theme from localStorage directly — does NOT import
 * the Zustand store. This avoids the circular dependency that causes the
 * ChunkLoadError on layout.js: store → zustand → layout chunk → store.
 *
 * The inline <script> in layout.tsx handles the very first paint (before
 * React hydrates). This component handles subsequent theme toggles by
 * listening to storage events and a custom "nuru-theme-change" event that
 * the store dispatches whenever the user changes the theme in settings.
 */
export function ThemeSync() {
  useEffect(() => {
    // Apply the stored theme on mount
    function apply() {
      try {
        const raw = localStorage.getItem("nuru-academy-storage");
        const theme = raw ? JSON.parse(raw)?.state?.theme : "light";
        document.documentElement.classList.toggle("dark", theme === "dark");
      } catch {
        // localStorage unavailable — stay on light
      }
    }

    apply();

    // Listen for storage changes (other tabs)
    window.addEventListener("storage", apply);

    // Listen for the custom event dispatched by the store's toggleTheme action
    window.addEventListener("nuru-theme-change", apply);

    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener("nuru-theme-change", apply);
    };
  }, []);

  return null;
}
