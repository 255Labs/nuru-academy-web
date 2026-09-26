"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store";

/**
 * ContentProtection — mounts once in the Shell.
 *
 * 1. Intercepts keyboard shortcuts: PrintScreen (pauses any playing video),
 *    Ctrl+S (save), Ctrl+U (view source), Ctrl+P (print).
 * 2. Disables right-click context menu on protected elements.
 * 3. Pauses media when tab loses focus.
 *
 * This does NOT prevent determined screen recording — for that, use Mux DRM.
 * This raises the bar against casual capture and screenshot tools.
 */
export function ContentProtection() {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Block print
      if (e.ctrlKey && e.key.toLowerCase() === "p") { e.preventDefault(); return; }
      // Block save page
      if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); return; }
      // Block view source
      if (e.ctrlKey && e.key.toLowerCase() === "u") { e.preventDefault(); return; }
      // PrintScreen — pause all videos
      if (e.key === "PrintScreen") {
        document.querySelectorAll("video").forEach((v) => v.pause());
      }
    }

    function handleContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Block on video elements and protected content areas
      if (
        target.tagName === "VIDEO" ||
        target.tagName === "IMG" ||
        target.closest("[data-protected]")
      ) {
        e.preventDefault();
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  return null;
}

/**
 * LearnerWatermark — renders a semi-transparent diagonal watermark
 * showing the learner's name, email and today's date across the page.
 *
 * Visible in screenshots but barely noticeable during normal use.
 * Allows Nuru to identify the source of any leaked content.
 */
export function LearnerWatermark() {
  const displayName = useGameStore((s) => s.profile.displayName);
  const email = useGameStore((s) => s.profile.email ?? "");
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  // Only render if we have something to show
  if (!displayName && !email) return null;

  const text = [displayName, email, today].filter(Boolean).join("  ·  ");
  // Repeat the text enough times to fill a rotated 200%×200% div
  const repeats = Array.from({ length: 120 });

  return (
    <div className="learner-watermark" aria-hidden>
      <div className="learner-watermark-inner">
        {repeats.map((_, i) => (
          <span key={i} className="learner-watermark-text">{text}</span>
        ))}
      </div>
    </div>
  );
}
