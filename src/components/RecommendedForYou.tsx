"use client";

import { useRouter } from "next/navigation";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { useGameStore, isTrackUnlocked } from "@/lib/store";
import { useTracks } from "@/lib/curriculum-db";
import type { TrackId } from "@/lib/store";

/**
 * Each recommended course has its own distinct cover image — thematically
 * matched to the course content, NOT the same images used in ContinueLearning.
 */
const REC_COVER: Record<string, string> = {
  beginner:     "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80&auto=format&fit=crop", // person at laptop learning
  intermediate: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop", // AI interface on screen
  expert:       "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80&auto=format&fit=crop", // server / data infrastructure
};

export function RecommendedForYou() {
  const router = useRouter();
  const { tracks: TRACKS } = useTracks();
  const activeTrack = useGameStore((s) => s.activeTrack);
  const setActiveTrack = useGameStore((s) => s.setActiveTrack);
  const missionsPassed = useGameStore((s) => s.missionsPassed);
  const purchasedTracks = useGameStore((s) => s.purchasedTracks);

  if (!TRACKS || TRACKS.length === 0 || TRACKS.some((tr) => !tr)) {
    return null;
  }

  // Show tracks the user hasn't unlocked yet (locked = recommended to explore)
  // BUT also show them if they're unlocked but not the active track (cross-sell)
  const recommended = TRACKS.filter(
    (t) => t.id !== activeTrack && !isTrackUnlocked(t.id as TrackId, missionsPassed, purchasedTracks)
  );

  if (recommended.length === 0) {
    return (
      <section>
        <h2 className="font-bold text-nuru-ink text-lg mb-2">Recommended for You</h2>
        <div className="bg-nuru-card rounded-2xl border border-nuru-line p-6 text-center text-sm text-nuru-muted">
          🎉 You&apos;ve unlocked all available courses! More coming soon.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-nuru-ink text-lg leading-tight">Recommended for You</h2>
          <p className="text-xs text-nuru-muted mt-0.5">Based on your progress, interests and learning goals.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {recommended.map((t) => {
          const firstModule = t.modules[0];
          if (!firstModule) return null;

          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTrack(t.id as TrackId);
                router.push("/courses");
              }}
              className="group relative rounded-2xl overflow-hidden border border-nuru-line text-left transition-all duration-200 hover:shadow-[0_8px_32px_-8px_rgba(107,78,255,0.25)] hover:-translate-y-0.5 bg-nuru-card"
            >
              {/* Cover image */}
              <div className="relative w-full h-32 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={REC_COVER[t.id] ?? REC_COVER.beginner}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

                {/* Track badge */}
                <span
                  className="absolute top-3 left-3 text-[10px] font-bold tracking-wider uppercase text-white px-2.5 py-1 rounded-full"
                  style={{ background: t.tone + "cc" }}
                >
                  {t.subtitle}
                </span>

                {/* "First lesson free" badge */}
                <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-nuru-gold/90 text-nuru-ink">
                  <Sparkles size={9} /> Free Trial
                </span>

                {/* Lock overlay at bottom of image */}
                <div className="absolute bottom-2 right-3 flex items-center gap-1 text-white/70">
                  <Lock size={12} />
                  <span className="text-[10px] font-semibold">TZS {(t.priceTZS ?? 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="font-semibold text-nuru-ink text-[14px] leading-snug mb-1 line-clamp-2">
                  {firstModule.name}
                </div>
                <div className="text-[11px] text-nuru-muted mb-3">{t.name}</div>

                {/* First lesson free callout */}
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                  <Sparkles size={11} className="text-amber-600 shrink-0" />
                  <span className="text-[11px] font-semibold text-amber-700">First lesson is free — no payment needed</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-nuru-muted">
                  <span>{t.modules.length} modules</span>
                  <span>{t.passingPct}% to pass</span>
                </div>

                {/* CTA */}
                <div className="mt-3 w-full bg-nuru-lav text-nuru-purple text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-1.5 transition-colors group-hover:bg-nuru-purple group-hover:text-white">
                  Try First Lesson Free
                  <ArrowRight size={13} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
