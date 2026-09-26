"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, BookOpen, HelpCircle, Swords,
  Clock, Zap, Loader2, Sparkles, Lock,
} from "lucide-react";
import { useGameStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import type { Quest } from "@/lib/types";

const ICONS: Record<string, typeof BookOpen> = {
  book: BookOpen,
  quiz: HelpCircle,
  duel: Swords,
  clock: Clock,
  zap: Zap,
};

export function QuestList() {
  const quests           = useGameStore((s) => s.quests);
  const loadTodayQuests  = useGameStore((s) => s.loadTodayQuests);
  const claimQuestReward = useGameStore((s) => s.claimQuestReward);
  const t = useT();

  const [claiming, setClaiming]   = useState<string | null>(null);
  const [justRewarded, setJustRewarded] = useState<{ id: string; xp: number; coins: number } | null>(null);

  // Load today's quests from DB on mount (resets if new day)
  useEffect(() => { loadTodayQuests(); }, [loadTodayQuests]);

  async function handleClaim(quest: Quest) {
    if (!quest.done || quest.rewarded || claiming) return;
    setClaiming(quest.id);
    const result = await claimQuestReward(quest.id);
    setClaiming(null);
    if (result) {
      setJustRewarded({ id: quest.id, xp: result.xp, coins: result.coins });
      setTimeout(() => setJustRewarded(null), 3000);
    }
  }

  const allDone    = quests.every((q) => q.done);
  const allClaimed = quests.every((q) => q.rewarded);

  return (
    <div className="bg-nuru-card rounded-2xl shadow-card border border-nuru-line overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-nuru-line">
        <div>
          <h3 className="font-bold text-nuru-ink text-[15px]">{t("quests.title")}</h3>
          <p className="text-[11px] text-nuru-muted mt-0.5">
            Resets at midnight · {quests.filter((q) => q.done).length}/{quests.length} done
          </p>
        </div>
        <Link href="/courses" className="text-xs font-semibold text-nuru-purple hover:underline">
          {t("quests.view_all")}
        </Link>
      </div>

      {/* All-done banner */}
      {allDone && allClaimed && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 bg-nuru-lav rounded-xl px-3 py-2.5">
          <Sparkles size={14} className="text-nuru-purple shrink-0" />
          <span className="text-xs font-semibold text-nuru-purple">
            All quests done and rewarded! Come back tomorrow.
          </span>
        </div>
      )}

      {/* Quest rows */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {quests.map((q) => {
          const Icon        = ICONS[q.icon] ?? Zap;
          const isRewarding = claiming === q.id;
          const didReward   = justRewarded?.id === q.id;
          const pct         = q.target > 1 ? Math.round((q.progress / q.target) * 100) : 100;

          return (
            <div
              key={q.id}
              className={`rounded-xl border transition-all ${
                q.rewarded
                  ? "bg-nuru-bg border-nuru-line opacity-60"
                  : q.done
                  ? "bg-nuru-lav/60 border-nuru-purple/40"
                  : "bg-nuru-bg border-nuru-line"
              }`}
            >
              <div className="flex items-center gap-3 px-3.5 py-3">
                {/* State icon */}
                <div className="shrink-0">
                  {q.rewarded ? (
                    <CheckCircle2 size={20} className="text-nuru-green" />
                  ) : q.done ? (
                    <div className="w-5 h-5 rounded-full bg-nuru-purple grid place-items-center">
                      <CheckCircle2 size={13} className="text-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-nuru-lav grid place-items-center">
                      <Icon size={11} className="text-nuru-purple" />
                    </div>
                  )}
                </div>

                {/* Label + progress */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium leading-tight ${
                    q.rewarded ? "text-nuru-muted line-through" : "text-nuru-ink"
                  }`}>
                    {q.label}
                  </div>

                  {/* Progress bar for multi-step quests */}
                  {q.target > 1 && !q.rewarded && (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-nuru-line rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-nuru-purple transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-nuru-muted tabular-nums shrink-0">
                          {q.progress}/{q.target}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reward preview */}
                  {!q.rewarded && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-nuru-muted">
                        +{q.xpReward} XP · +{q.coinsReward} coins
                      </span>
                    </div>
                  )}
                </div>

                {/* Action area */}
                <div className="shrink-0">
                  {q.rewarded ? (
                    <span className="text-[10px] font-bold text-nuru-green bg-green-50 px-2 py-0.5 rounded-full">
                      Claimed
                    </span>
                  ) : q.done ? (
                    <button
                      onClick={() => handleClaim(q)}
                      disabled={!!claiming}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white text-[11px] font-bold disabled:opacity-60"
                    >
                      {isRewarding
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Sparkles size={11} />}
                      {isRewarding ? "…" : "Claim"}
                    </button>
                  ) : (
                    <Lock size={14} className="text-nuru-muted" />
                  )}
                </div>
              </div>

              {/* Reward flash */}
              {didReward && (
                <div className="px-3.5 pb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-nuru-purple animate-fade-in">
                    <Sparkles size={12} />
                    +{justRewarded!.xp} XP and +{justRewarded!.coins} coins added to your account!
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-5 pb-3 pt-0">
        <p className="text-[10px] text-nuru-muted text-center leading-relaxed">
          Complete each quest then tap <strong>Claim</strong> to collect your XP and coins.
          Unclaimed rewards expire at midnight.
        </p>
      </div>
    </div>
  );
}
