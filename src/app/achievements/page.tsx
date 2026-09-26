"use client";

import { Lock } from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { useGameStore } from "@/lib/store";
import { computeAchievements } from "@/lib/achievements";

export default function AchievementsPage() {
  const xp = useGameStore((s) => s.xp);
  const progress = useGameStore((s) => s.progress);
  const missionsPassed = useGameStore((s) => s.missionsPassed);
  const quizScores = useGameStore((s) => s.quizScores);
  const currentStreak = useGameStore((s) => s.currentStreak);

  const ALL = computeAchievements({ progress, missionsPassed, quizScores, streak: currentStreak() });
  const earnedCount = ALL.filter((a) => a.earned).length;

  return (
    <Shell>
      <TopBar title="Achievements" subtitle={`${earnedCount} of ${ALL.length} badges earned — ${xp.toLocaleString()} total XP`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ALL.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.id} className="bg-nuru-card rounded-2xl2 p-5 shadow-card border border-nuru-line flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-xl grid place-items-center mb-3"
                style={{ background: a.earned ? "rgba(107,78,255,0.1)" : "rgb(var(--c-lav))" }}
              >
                {a.earned ? <Icon size={22} className="text-nuru-purple" strokeWidth={2} /> : <Lock size={18} className="text-nuru-muted" />}
              </div>
              <div className="font-semibold text-sm text-nuru-ink">{a.label}</div>
              <div className="text-[11.5px] text-nuru-muted mt-1 leading-snug">{a.desc}</div>
              {!a.earned && <div className="text-[10px] font-bold text-nuru-muted mt-2 uppercase tracking-wide">Locked</div>}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
