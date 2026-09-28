"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadUserGameData } from "@/lib/supabase/queries";
import { useGameStore } from "@/lib/store";

/**
 * Mounted once inside <Shell>, on every protected page. Replaces the
 * store's placeholder/demo numbers with this signed-in user's real data
 * from Supabase. Renders nothing — it's a data-loading side effect, not UI.
 *
 * IMPORTANT: We intentionally do NOT bail out on `hydrated === true`.
 * Previously that guard meant: if game data was persisted in localStorage
 * from a prior session, Supabase was never re-queried and stale/reset data
 * would linger across deploys. Now localStorage only holds UI preferences
 * (theme, activeTrack, hintsSeen) — all game progress comes from Supabase
 * on every page load, making deploys safe for live users.
 *
 * The `attempted` ref still prevents a double-fetch when navigating between
 * pages within the same browser session.
 */
export function HydrateFromServer() {
  const hydrate = useGameStore((s) => s.hydrate);
  const attempted = useRef(false);

  useEffect(() => {
    // Only skip if we've already fetched in this browser session (SPA navigation).
    // Never skip based on store.hydrated — that would let stale localStorage
    // data block a fresh Supabase fetch.
    if (attempted.current) return;
    attempted.current = true;

    const supabase = createClient();

    const fetchData = async (retries = 2) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // middleware should have already redirected; defensive no-op

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const data = await loadUserGameData(supabase, user.id);
          if (data) {
            hydrate({
              profile: { ...data.profile, email: user.email ?? "" },
              xp: data.xp,
              coins: data.coins,
              gems: data.gems,
              progress: data.progress,
              missionsPassed: data.missionsPassed,
              quizScores: data.quizScores,
              studyLog: data.studyLog,
              weeklyStudyMins: data.weeklyStudyMins,
              allTimeStudyMins: data.allTimeStudyMins,
              purchasedTracks: data.purchasedTracks,
            });
            return; // success — stop retrying
          }
        } catch (err) {
          if (attempt < retries) {
            // Exponential back-off: 500ms, then 1500ms
            await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt)));
          } else {
            console.error("HydrateFromServer: failed after retries", err);
          }
        }
      }
    };

    fetchData();
  }, [hydrate]);

  return null;
}
