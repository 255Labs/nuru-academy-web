"use client";

import { useEffect, useState } from "react";
import { Lock, Star, Map, ChevronRight } from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { WorldCanvas } from "@/components/WorldCanvas";
import { createClient } from "@/lib/supabase/client";
import { useGameStore } from "@/lib/store";

interface Region {
  id: string;
  name: string;
  description: string;
  unlock_requires: string | null;
  sort_order: number;
  scene_key: string | null;
  active: boolean;
}

interface RegionProgress {
  region_id: string;
  stars: number;
  unlocked_at: string;
}

// Scene image keys → filenames
const SCENE_IMAGES: Record<string, string> = {
  "scene-future_africa":        "/illustrations/scene-future_africa.png",
  "scene-silicon_savannah":     "/illustrations/scene-silicon_savannah.png",
  "scene-swahili_coast":        "/illustrations/scene-swahili_coast.png",
  "scene-ubuntu_village":       "/illustrations/scene-ubuntu_village.png",
  "scene-great_rift_highlands": "/illustrations/scene-great_rift_highlands.png",
  "scene-timbuktu_library":     "/illustrations/scene-timbuktu_library.png",
};

const TRACK_LABELS: Record<string, string> = {
  beginner: "AI for Everyone",
  intermediate: "LLMs Under the Hood",
  expert: "The Model Landscape",
};

export default function WorldPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [progress, setProgress] = useState<RegionProgress[]>([]);
  const [showMap, setShowMap] = useState(false);
  const missionsPassed = useGameStore((s) => s.missionsPassed);
  const purchasedTracks = useGameStore((s) => s.purchasedTracks);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("map_regions").select("*").order("sort_order"),
      supabase.from("map_progress").select("*"),
    ]).then(([r, p]) => {
      setRegions((r.data ?? []) as Region[]);
      setProgress((p.data ?? []) as RegionProgress[]);
    });
  }, []);

  // Determine if a region is unlocked based on track enrollment
  function isRegionUnlocked(region: Region): boolean {
    if (!region.unlock_requires) return true; // Welcome Camp always open
    // Check if user has passed at least one module in the required track
    const hasProgress = Object.keys(missionsPassed).some((key) =>
      key.startsWith(region.unlock_requires + ":")
    );
    const hasPurchase = purchasedTracks.includes(region.unlock_requires);
    return hasProgress || hasPurchase;
  }

  function getStars(regionId: string): number {
    return progress.find((p) => p.region_id === regionId)?.stars ?? 0;
  }

  return (
    <Shell>
      <TopBar title="World Map" subtitle="Your learning journey across Africa — unlock regions as you master each track." />

      {/* Toggle between region map and overworld canvas */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowMap(false)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            !showMap ? "bg-nuru-purple text-white" : "bg-nuru-lav text-nuru-ink2 hover:bg-nuru-lav"
          }`}
        >
          <Map size={14} /> Region Map
        </button>
        <button
          onClick={() => setShowMap(true)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            showMap ? "bg-nuru-purple text-white" : "bg-nuru-lav text-nuru-ink2 hover:bg-nuru-lav"
          }`}
        >
          Enter World
        </button>
      </div>

      {showMap ? (
        <WorldCanvas />
      ) : (
        <div className="space-y-3">
          {regions.map((region) => {
            const unlocked = isRegionUnlocked(region);
            const stars = getStars(region.id);
            const sceneImg = region.scene_key ? SCENE_IMAGES[region.scene_key] : null;

            return (
              <div
                key={region.id}
                className={`relative flex items-center gap-4 rounded-2xl border-2 overflow-hidden transition-all ${
                  unlocked
                    ? "border-nuru-line bg-nuru-card hover:border-nuru-purple/40 cursor-pointer"
                    : "border-nuru-line bg-nuru-bg opacity-60 cursor-default"
                }`}
              >
                {/* Scene thumbnail */}
                <div
                  className="w-20 h-20 shrink-0 bg-nuru-lav flex items-center justify-center overflow-hidden"
                  style={sceneImg ? {
                    backgroundImage: `url(${sceneImg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  } : undefined}
                >
                  {!sceneImg && (
                    <span className="text-2xl opacity-40">{unlocked ? "🌍" : "🔒"}</span>
                  )}
                </div>

                <div className="flex-1 py-3 pr-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-nuru-muted">
                      Region {region.sort_order}
                    </span>
                    {region.active && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full uppercase">Active</span>
                    )}
                  </div>
                  <div className="font-bold text-nuru-ink text-[15px]">{region.name}</div>
                  <div className="text-xs text-nuru-ink2 mt-0.5">{region.description}</div>

                  {/* Stars */}
                  {unlocked && (
                    <div className="flex gap-0.5 mt-1.5">
                      {[1, 2, 3].map((s) => (
                        <Star key={s} size={12}
                          className={s <= stars ? "text-yellow-400 fill-yellow-400" : "text-nuru-lav"} />
                      ))}
                    </div>
                  )}

                  {/* Unlock requirement */}
                  {!unlocked && region.unlock_requires && (
                    <div className="flex items-center gap-1 mt-1">
                      <Lock size={10} className="text-nuru-muted" />
                      <span className="text-[10px] text-nuru-muted">
                        Complete {TRACK_LABELS[region.unlock_requires] ?? region.unlock_requires} to unlock
                      </span>
                    </div>
                  )}
                </div>

                {unlocked && region.active && (
                  <div className="pr-4 shrink-0">
                    <ChevronRight size={16} className="text-nuru-muted" />
                  </div>
                )}

                {!unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-nuru-bg/40">
                    <Lock size={20} className="text-nuru-muted opacity-50" />
                  </div>
                )}
              </div>
            );
          })}

          {regions.length === 0 && (
            <div className="text-center py-12 text-nuru-muted text-sm">Loading regions…</div>
          )}
        </div>
      )}
    </Shell>
  );
}
