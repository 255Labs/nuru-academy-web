"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { TRACKS } from "@/data/curriculum";
import { useGameStore, isTrackUnlocked } from "@/lib/store";
import type { TrackId } from "@/lib/store";

// Real reference thumbnails, mapped to our actual tracks by theme.
const THUMBNAIL: Record<string, string> = {
  beginner: "/images/rec-history.jpg",
  intermediate: "/images/rec-deep.jpg",
  expert: "/images/rec-cloud.jpg",
};

/**
 * Only recommends tracks that are genuinely unlocked (earned via Emberfall
 * or paid for) and not the one already active — with one real accessible
 * course today, that's usually nothing, so this shows an honest "more
 * courses coming soon" note rather than promoting locked tracks as if
 * they were recommendable content.
 */
export function RecommendedForYou() {
  const router = useRouter();
  const activeTrack = useGameStore((s) => s.activeTrack);
  const setActiveTrack = useGameStore((s) => s.setActiveTrack);
  const missionsPassed = useGameStore((s) => s.missionsPassed);
  const purchasedTracks = useGameStore((s) => s.purchasedTracks);

  const others = TRACKS.filter(
    (t) => t.id !== activeTrack && isTrackUnlocked(t.id as TrackId, missionsPassed, purchasedTracks)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-nuru-ink text-lg">Recommended for You</h2>
      </div>
      {others.length === 0 ? (
        <div className="bg-nuru-card rounded-2xl2 border border-nuru-line shadow-card p-5 text-center text-sm text-nuru-muted">
          More courses coming soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {others.map((t) => {
            const firstModule = t.modules[0];
            if (!firstModule) return null;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTrack(t.id as TrackId);
                  router.push("/courses");
                }}
                className="rounded-2xl2 overflow-hidden shadow-card border border-nuru-line text-left hover:shadow-pop transition-shadow bg-nuru-card"
              >
                <div className="relative h-24">
                  <Image src={THUMBNAIL[t.id] ?? THUMBNAIL.beginner} alt="" fill sizes="300px" className="object-cover" />
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-bold tracking-wide uppercase mb-1" style={{ color: t.tone }}>
                    {t.subtitle}
                  </div>
                  <div className="font-semibold text-nuru-ink text-sm leading-snug">{firstModule.name}</div>
                  <div className="text-[11px] text-nuru-muted mt-1">TZS {t.priceTZS} · {t.modules.length} weeks</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
