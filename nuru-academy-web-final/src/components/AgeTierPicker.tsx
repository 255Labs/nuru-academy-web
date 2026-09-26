"use client";

import { useGameStore, AGE_TIER_META, type AgeTier } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

const TIERS = Object.entries(AGE_TIER_META) as [AgeTier, typeof AGE_TIER_META[AgeTier]][];

export function AgeTierPicker({ onPick }: { onPick?: (tier: AgeTier) => void }) {
  const ageTier = useGameStore((s) => s.profile.ageTier ?? "adult");
  const updateProfile = useGameStore((s) => s.updateProfile);
  const t = useT();

  async function setTier(tier: AgeTier) {
    updateProfile({ ageTier: tier });
    onPick?.(tier);
    try {
      const supabase = createClient();
      const meta = AGE_TIER_META[tier];
      await supabase.rpc("upsert_learner_profile", {
        p_age_tier: tier,
        p_ui_mode: meta.uiMode,
      });
    } catch {
      // Best-effort
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {TIERS.map(([tier, meta]) => (
        <button
          key={tier}
          onClick={() => setTier(tier)}
          className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
            ageTier === tier
              ? "border-nuru-purple bg-nuru-lav"
              : "border-nuru-line bg-nuru-bg hover:border-nuru-purple/40"
          }`}
        >
          <span className="text-2xl mt-0.5">{meta.icon}</span>
          <div className="flex-1">
            <div className="font-bold text-sm text-nuru-ink">{t(`tier.${tier}`)}</div>
            <div className="text-[11px] text-nuru-muted mt-0.5">{meta.range}</div>
            {meta.xpMultiplier > 1 && (
              <div className="text-[10px] font-bold text-nuru-purple mt-1">
                {t(tier === "child" ? "tier.child.xp" : "tier.teen.xp")}
              </div>
            )}
          </div>
          {ageTier === tier && (
            <div className="w-4 h-4 rounded-full bg-nuru-purple flex items-center justify-center shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
