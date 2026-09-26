"use client";

import { Flame, Check } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Nuru } from "./Nuru";

export function StreakCalendar() {
  const currentStreak = useGameStore((s) => s.currentStreak);
  const weekChecksFn  = useGameStore((s) => s.weekChecks);
  const t = useT();
  const streak     = currentStreak();
  const weekChecks = weekChecksFn();

  const DAY_KEYS = ["streak.mon","streak.tue","streak.wed","streak.thu","streak.fri","streak.sat","streak.sun"];

  return (
    <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line relative overflow-hidden">
      <div className="flex items-center gap-1.5 mb-1">
        <Flame size={16} className="text-nuru-gold" fill="currentColor" />
        <h3 className="font-bold text-nuru-ink text-[15px]">{t("streak.title")}</h3>
      </div>
      <div className="flex items-end gap-6">
        <div>
          <div className="font-display font-extrabold text-4xl text-nuru-ink leading-none">{streak}</div>
          <div className="text-xs text-nuru-muted font-medium mt-0.5">{t("streak.days_label")}</div>
        </div>
        <div className="absolute right-3 top-3 opacity-95">
          <Nuru size={64} mood="cheer" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mt-4">
        {DAY_KEYS.map((key, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-nuru-muted">{t(key)}</span>
            {weekChecks[i] ? (
              <div className="w-6 h-6 rounded-full bg-nuru-goldDeep grid place-items-center text-white">
                <Check size={12} strokeWidth={3} />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-nuru-lav border-2 border-dashed border-nuru-purple/40" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
