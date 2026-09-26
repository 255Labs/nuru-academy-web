"use client";

import { Skull, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { TRACKS } from "@/data/curriculum";
import { useGameStore } from "@/lib/store";

export function BossBattleCard() {
  const router = useRouter();
  const activeTrack = useGameStore((s) => s.activeTrack);
  const activeModuleIdx = useGameStore((s) => s.activeModuleIdx[activeTrack]);
  const track = TRACKS.find((t) => t.id === activeTrack)!;
  const mod = track.modules[activeModuleIdx];

  return (
    <div className="rounded-2xl2 p-5 bg-gradient-to-br from-[#241033] to-[#3A1750] text-white relative overflow-hidden shadow-pop">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-7 h-7 rounded-lg bg-white/10 grid place-items-center shrink-0">
            <Skull size={15} className="text-nuru-gold" />
          </span>
          <h3 className="font-bold text-[15px]">Mission Boss</h3>
        </div>
        <span className="text-[10px] font-bold tracking-wide uppercase text-white/50">Week {mod.week}</span>
      </div>
      <div className="font-display font-bold text-lg mt-2 leading-snug">{mod.quiz?.title ?? "Module Challenge"}</div>
      <div className="text-white/65 text-xs mt-1.5 leading-relaxed">
        Clear it to keep your streak bonus and unlock next week.
      </div>

      <button
        onClick={() => router.push("/courses")}
        className="mt-4 bg-nuru-rose hover:bg-red-600 transition-colors text-white text-sm font-bold rounded-xl px-4 py-2.5 flex items-center gap-1"
      >
        Fight now <ChevronRight size={15} />
      </button>
    </div>
  );
}
