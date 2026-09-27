"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, Clock, Lock, CheckCircle2, PlayCircle } from "lucide-react";
import { useGameStore, trackTotalNodes, isTrackUnlocked } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useTracks } from "@/lib/curriculum-db";
import type { TrackId } from "@/lib/store";

/**
 * Curated, high-quality cover image per track.
 * Each image is distinct and thematically matched to the course content.
 */
const COURSE_COVER: Record<string, string> = {
  beginner:     "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&q=80&auto=format&fit=crop", // African students laptops
  intermediate: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&q=80&auto=format&fit=crop", // AI / neural network
  expert:       "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80&auto=format&fit=crop", // cloud / data center
};

export function ContinueLearning() {
  const router = useRouter();
  const t = useT();
  const { tracks: TRACKS } = useTracks();
  const progress = useGameStore((s) => s.progress);
  const missionsPassed = useGameStore((s) => s.missionsPassed);
  const purchasedTracks = useGameStore((s) => s.purchasedTracks);
  const setActiveTrack = useGameStore((s) => s.setActiveTrack);

  // Guard: wait for tracks to load
  if (!TRACKS || TRACKS.length === 0 || TRACKS.some((tr) => !tr)) {
    return (
      <section>
        <SectionHeader title={t("continue.title")} subtitle="Pick up where you left off and keep your momentum going." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-nuru-card border border-nuru-line h-[280px] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  // Only tracks the user has actually unlocked (free beginner OR paid/Emberfall)
  const unlockedTracks = TRACKS.filter((tr) =>
    isTrackUnlocked(tr.id as TrackId, missionsPassed, purchasedTracks)
  );

  if (unlockedTracks.length === 0) {
    return null; // Nothing to show — RecommendedForYou handles the locked state
  }

  const cards = unlockedTracks.map((tr) => {
    const total = trackTotalNodes(tr.id as TrackId);
    const done = progress[tr.id as TrackId] ?? 0;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const remaining = Math.max(1, total - done);

    // Which module the user is currently in
    const firstModLessons = tr.modules[0]?.lessons?.length ?? 0;
    const moduleIdx = tr.modules.length === 0 ? 0 : Math.min(
      tr.modules.length - 1,
      firstModLessons > 0 ? Math.floor(done / (firstModLessons + 1)) : 0
    );

    const isStarted = done > 0;

    return { track: tr, pct, moduleIdx, minLeft: remaining * 4, isStarted };
  });

  return (
    <section>
      <SectionHeader
        title={t("continue.title")}
        subtitle="Pick up where you left off and keep your momentum going."
        action={cards.length > 1 ? { label: "View all", href: "/courses" } : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map(({ track, pct, moduleIdx, minLeft, isStarted }) => {
          const mod = track.modules[moduleIdx];
          if (!mod) return null;

          return (
            <button
              key={track.id}
              onClick={() => {
                setActiveTrack(track.id as TrackId);
                router.push("/courses");
              }}
              className="group relative rounded-2xl overflow-hidden border border-nuru-line text-left transition-all duration-200 hover:shadow-[0_8px_32px_-8px_rgba(107,78,255,0.25)] hover:-translate-y-0.5 bg-nuru-card"
            >
              {/* Course cover image */}
              <div className="relative w-full h-36 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={COURSE_COVER[track.id] ?? COURSE_COVER.beginner}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                {/* Track badge — top left */}
                <span
                  className="absolute top-3 left-3 text-[10px] font-bold tracking-wider uppercase text-white px-2.5 py-1 rounded-full"
                  style={{ background: track.tone + "cc" }}
                >
                  {track.subtitle}
                </span>

                {/* Status badge — top right */}
                <span className={`absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                  isStarted
                    ? "bg-nuru-green/90 text-white"
                    : "bg-white/20 backdrop-blur-sm text-white"
                }`}>
                  {isStarted
                    ? <><CheckCircle2 size={10} /> In progress</>
                    : <><PlayCircle size={10} /> Start</>
                  }
                </span>
              </div>

              {/* Card body */}
              <div className="p-4">
                {/* Module name */}
                <div className="font-semibold text-nuru-ink text-[15px] leading-snug mb-1 line-clamp-2">
                  {mod.name}
                </div>
                <div className="text-[11px] text-nuru-muted mb-3">{track.name}</div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-nuru-lav overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: track.tone }}
                  />
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] text-nuru-muted">
                    <Clock size={11} />
                    {isStarted ? `${minLeft} min left` : `${minLeft} min`}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: track.tone }}>
                    {pct < 100
                      ? isStarted ? `${pct}% done` : "Free first lesson"
                      : "✓ Completed"
                    }
                  </span>
                </div>

                {/* CTA button */}
                <div
                  className="mt-3 w-full text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-1.5 transition-opacity group-hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${track.tone}, ${track.toneDeep ?? track.tone})` }}
                >
                  {isStarted ? t("continue.btn") : "Start Course"}
                  <ChevronRight size={14} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}) {
  const router = useRouter();
  return (
    <div className="flex items-start justify-between mb-4 gap-4">
      <div className="min-w-0">
        <h2 className="font-bold text-nuru-ink text-lg leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-nuru-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={() => router.push(action.href)}
          className="text-xs font-semibold text-nuru-purple hover:underline shrink-0"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
