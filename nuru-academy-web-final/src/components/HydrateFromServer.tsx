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
 * Runs once per session (guarded by a ref, not just `hydrated` in the
 * store) so navigating between pages doesn't re-fetch on every mount.
 */
export function HydrateFromServer() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const attempted = useRef(false);

  useEffect(() => {
    if (hydrated || attempted.current) return;
    attempted.current = true;

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return; // middleware should have already redirected; defensive no-op
      const data = await loadUserGameData(supabase, user.id);
      if (data) {
        hydrate({
          profile: data.profile,
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
      }
    });
  }, [hydrated, hydrate]);

  return null;
}
