"use client";

import { useGameStore, LANG_META, type DisplayLang } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

const LANGS = Object.entries(LANG_META) as [DisplayLang, typeof LANG_META[DisplayLang]][];

export function LanguageToggle({ compact = false, dropDirection = "up" }: { compact?: boolean; dropDirection?: "up" | "down" }) {
  const displayLang = useGameStore((s) => s.profile.displayLang ?? "en");
  const updateProfile = useGameStore((s) => s.updateProfile);

  async function setLang(lang: DisplayLang) {
    updateProfile({ displayLang: lang });
    try {
      const supabase = createClient();
      await supabase.rpc("upsert_learner_profile", { p_display_lang: lang });
    } catch {
      // Best-effort — UI updates immediately
    }
  }

  if (compact) {
    return (
      <div className="relative group">
        <button className="flex items-center gap-1 text-nuru-muted text-xs font-semibold hover:text-nuru-ink transition-colors px-2 py-1 rounded-lg hover:bg-nuru-lav">
          <span>{LANG_META[displayLang]?.flag ?? "🌍"}</span>
          <span className="uppercase">{displayLang}</span>
        </button>
        <div className={`absolute ${dropDirection === "down" ? "top-full right-0 mt-1" : "bottom-full left-0 mb-1"} hidden group-hover:flex flex-col gap-0.5 bg-nuru-card border border-nuru-line rounded-xl shadow-pop p-2 z-50 min-w-[160px]`}>
          {LANGS.map(([code, meta]) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors w-full ${
                displayLang === code
                  ? "bg-nuru-purple text-white"
                  : "text-nuru-ink2 hover:bg-nuru-lav"
              }`}
            >
              <span>{meta.flag}</span>
              <span>{meta.native}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {LANGS.map(([code, meta]) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            displayLang === code
              ? "bg-nuru-purple text-white border-nuru-purple"
              : "bg-nuru-bg text-nuru-ink2 border-nuru-line hover:border-nuru-purple/40 hover:bg-nuru-lav"
          }`}
        >
          <span className="text-base">{meta.flag}</span>
          <span className="text-left">
            <span className="block text-[11px] opacity-70">{meta.label}</span>
            <span className="block text-xs font-bold">{meta.native}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
