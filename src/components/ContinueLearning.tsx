"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronRight, Clock } from "lucide-react";
import { useGameStore, trackTotalNodes, isTrackUnlocked } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useTracks } from "@/lib/curriculum-db";
import type { TrackId } from "@/lib/store";

// Real reference thumbnail images, mapped thematically to our actual 3
// tracks (there's no separate course catalog behind this — still our
// real curriculum, just with real imagery instead of abstract icons).
const THUMBNAIL: Record<string, string> = {
  beginner: "/images/course-ai-africa.jpg",
  intermediate: "/images/course-ml.jpg",
  expert: "/images/course-ds.jpg",
};

export function ContinueLearning() {
  const router = useRouter();
  const t = useT();
  const { tracks: TRACKS } = useTracks();
  const progress = useGameStore((s) => s.progress);
  const missionsPassed = useGameStore((s) => s.missionsPassed);
  const purchasedTracks = useGameStore((s) => s.purchasedTracks);
  const setActiveTrack = useGameStore((s) => s.setActiveTrack);

  // Guard: wait until tracks are fully loaded and valid before mapping.
  // useTracks() can return an array with undefined elements or an empty
  // array before the curriculum resolves — either crashes t.name / t.modules.
  if (!TRACKS || TRACKS.length === 0 || TRACKS.some((tr) => !tr)) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-nuru-ink text-lg">{t("continue.title")}</h2>
        </div>
        <p className="text-sm text-nuru-muted">Loading…</p>
      </div>
    );
  }

  // Only tracks that are genuinely accessible right now — earned via
  // Emberfall or paid for — not every track that merely exists in the
  // curriculum. With one real course today, this correctly shows just one
  // card instead of implying Intermediate/Expert are equally available.
  const cards = TRACKS.filter((tr) => isTrackUnlocked(tr.id as TrackId, missionsPassed, purchasedTracks)).map((tr) => {
    const total = trackTotalNodes(tr.id as TrackId);
    const done = progress[tr.id as TrackId];
    const pct = Math.min(100, Math.round((done / total) * 100));
    const remaining = Math.max(1, total - done);
    const moduleIdx = Math.min(
      tr.modules.length - 1,
      Math.floor(done / (tr.modules[0].lessons.length + 1))
    );
    return { track: tr, pct, moduleIdx, minLeft: remaining * 4 };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-nuru-ink text-lg">{t("continue.title")}</h2>
      </div>
      {cards.length === 0 && (
        <p className="text-sm text-nuru-muted">{t("continue.no_tracks")}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ track, pct, moduleIdx, minLeft }) => {
          const mod = track.modules[moduleIdx];
          return (
            <button
              key={track.id}
              onClick={() => {
                setActiveTrack(track.id as TrackId);
                router.push("/courses");
              }}
              className="rounded-2xl overflow-hidden shadow-card border border-nuru-line text-left hover:shadow-pop transition-shadow bg-nuru-card"
            >
              <div className="relative w-full h-24">
                <Image src={THUMBNAIL[track.id] ?? THUMBNAIL.beginner} alt="" fill sizes="300px" className="object-cover" />
                <span className="absolute top-2 left-2 text-[10px] font-bold tracking-wide text-white uppercase bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {track.subtitle}
                </span>
              </div>
              <div className="p-4">
                <div className="font-semibold text-nuru-ink text-[15px] leading-snug mb-3">{mod.name}</div>
                <div className="h-1.5 rounded-full bg-nuru-lav overflow-hidden mb-2.5">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: track.tone }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-nuru-muted">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {t("continue.min_left").replace("{n}", String(minLeft))}
                  </span>
                  <span className="font-semibold text-nuru-goldDeep">
                    {pct < 100 ? t("continue.xp_reward").replace("{n}", "100") : "✓"}
                  </span>
                </div>
                <div className="mt-3 w-full bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white text-xs font-bold rounded-lg py-2 flex items-center justify-center gap-1">
                  {t("continue.btn")} <ChevronRight size={14} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
