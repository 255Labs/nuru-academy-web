import { TRACKS } from "@/data/curriculum";
import type { TrackId } from "@/lib/store";
import { trackTotalNodes } from "@/lib/store";
import type { LucideIcon } from "lucide-react";
import { Rocket, Flame, Crown, Heart, BookOpen, Medal, Star, Award } from "lucide-react";

export interface ComputedAchievement {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  earned: boolean;
}

/**
 * Achievements are computed live from real progress data every time
 * they're read — never stored, never a static "earned: true" flag that
 * drifts from reality. This is the single source of truth: the full
 * /achievements page calls this directly (a dashboard preview widget
 * used to call it too, but was removed — this stays the shared logic
 * either way).
 *
 * "Helping Hand" is the one honest exception — it's permanently
 * `earned: false` because there's no real community/guild feature to
 * check against yet. Showing it as locked forever is more honest than
 * either faking it unlocked or removing it and losing the "here's what's
 * still coming" signal.
 */
export function computeAchievements({
  progress,
  missionsPassed,
  quizScores,
  streak,
}: {
  progress: Record<TrackId, number>;
  missionsPassed: Record<string, boolean>;
  quizScores: Record<string, number>;
  streak: number;
}): ComputedAchievement[] {
  const totalLessonsDone = Object.values(progress).reduce((a, b) => a + b, 0);
  const anyMissionPassed = Object.values(missionsPassed).some(Boolean);
  const anyPerfectScore = Object.values(quizScores).some((pct) => pct === 100);

  const allMissionsForATrack = TRACKS.some((t) => {
    const moduleIds = t.modules.filter((m) => m.quiz).map((m) => m.id);
    return moduleIds.length > 0 && moduleIds.every((id) => missionsPassed[`${t.id}:${id}`]);
  });

  const anyTrackComplete = TRACKS.some((t) => progress[t.id as TrackId] >= trackTotalNodes(t.id as TrackId));

  return [
    { id: "quick", label: "Quick Learner", desc: "Complete your first lesson", icon: Rocket, earned: totalLessonsDone >= 1 },
    { id: "streak30", label: "30 Day Streak", desc: "Study 30 days in a row", icon: Flame, earned: streak >= 30 },
    { id: "quizmaster", label: "Quiz Master", desc: "Score 100% on any quiz", icon: Crown, earned: anyPerfectScore },
    { id: "helper", label: "Helping Hand", desc: "Help a guild member", icon: Heart, earned: false },
    { id: "bookworm", label: "Bookworm", desc: "Complete 10 lessons", icon: BookOpen, earned: totalLessonsDone >= 10 },
    { id: "champion", label: "Mission Champion", desc: "Clear your first Mission Quest", icon: Medal, earned: anyMissionPassed },
    { id: "allstar", label: "All-Star", desc: "Clear every Mission Quest in a track", icon: Star, earned: allMissionsForATrack },
    { id: "graduate", label: "Graduate", desc: "Complete every day in a track", icon: Award, earned: anyTrackComplete },
  ];
}
