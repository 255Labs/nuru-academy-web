import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type { TrackId } from "@/lib/store";

type TypedClient = SupabaseClient<Database>;

export interface HydratedGameData {
  profile: {
    username: string;
    displayName: string;
    email: string;
    bio: string;
    language: "English" | "Swahili";
    role: "student" | "admin";
    avatarKey: string;
  };
  xp: number;
  coins: number;
  gems: number;
  level: number;
  progress: Record<TrackId, number>;
  missionsPassed: Record<string, boolean>;
  quizScores: Record<string, number>;
  studyLog: string[];
  /** Real sums computed from study_log.minutes — not a fake incremented
   * baseline. See the "no fake seed data" fix in store.ts. */
  weeklyStudyMins: number;
  allTimeStudyMins: number;
  /** Track IDs with a real, webhook-confirmed successful payment — the
   * "pay to unlock directly" path, separate from earning it via Emberfall. */
  purchasedTracks: string[];
}

/**
 * Loads everything the dashboard/courses/missions pages need for the
 * signed-in user, in four parallel requests. Every table here is scoped by
 * RLS to the caller's own rows (verified in supabase/local_test_rls.sql),
 * so no explicit .eq("user_id", ...) is strictly required for the
 * user-owned tables — it's included anyway as defense-in-depth and to make
 * the intent obvious to the next person reading this file.
 */
export async function loadUserGameData(
  supabase: TypedClient,
  userId: string
): Promise<HydratedGameData | null> {
  const [profileRes, statsRes, enrollRes, attemptsRes, studyRes, quizzesRes, purchasesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("player_stats").select("*").eq("user_id", userId).single(),
    supabase.from("enrollments").select("track_id, progress").eq("user_id", userId),
    supabase
      .from("quiz_attempts")
      .select("quiz_id, score_pct, passed, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("study_log").select("study_date, minutes").eq("user_id", userId),
    supabase.from("quizzes").select("id, module_id"),
    supabase.from("track_purchases").select("track_id, status").eq("user_id", userId).eq("status", "success"),
  ]);

  if (profileRes.error || statsRes.error) {
    // A brand-new user's profiles/player_stats rows are created by the
    // handle_new_user() trigger at signup, so this should only happen if
    // that trigger failed — surface it rather than silently falling back
    // to fake data.
    console.error("loadUserGameData: failed to load profile/stats", profileRes.error, statsRes.error);
    return null;
  }

  const profile = profileRes.data;
  const stats = statsRes.data;

  const progress: Record<TrackId, number> = { beginner: 0, intermediate: 0, expert: 0 };
  for (const row of enrollRes.data ?? []) {
    const trackId = row.track_id as string;
    if (trackId === "beginner" || trackId === "intermediate" || trackId === "expert") {
      progress[trackId as TrackId] = row.progress;
    }
  }

  // quizzes.module_id is already formatted exactly like "beginner:b1" —
  // the same string the UI uses as its missionsPassed/quizScores key — so
  // no reformatting is needed, just a quiz_id -> module_id lookup table.
  const moduleIdByQuizId = new Map<string, string>();
  for (const q of quizzesRes.data ?? []) {
    moduleIdByQuizId.set(q.id, q.module_id);
  }

  const missionsPassed: Record<string, boolean> = {};
  const quizScores: Record<string, number> = {};
  for (const attempt of attemptsRes.data ?? []) {
    const moduleId = moduleIdByQuizId.get(attempt.quiz_id);
    if (!moduleId) continue;
    quizScores[moduleId] = attempt.score_pct; // last attempt wins (rows are ascending by time)
    if (attempt.passed) missionsPassed[moduleId] = true;
  }

  const studyLog = (studyRes.data ?? []).map((r) => r.study_date);

  const todayMs = Date.now();
  let weeklyStudyMins = 0;
  let allTimeStudyMins = 0;
  for (const row of studyRes.data ?? []) {
    allTimeStudyMins += row.minutes;
    const rowMs = new Date(row.study_date + "T00:00:00Z").getTime();
    const daysAgo = Math.floor((todayMs - rowMs) / 86_400_000);
    if (daysAgo >= 0 && daysAgo < 7) weeklyStudyMins += row.minutes;
  }

  return {
    profile: {
      username: profile.username,
      displayName: stats.display_name,
      email: profile.email,
      bio: profile.bio,
      language: profile.language,
      role: profile.role,
      avatarKey: stats.avatar_key,
    },
    xp: stats.xp,
    coins: stats.coins,
    gems: stats.gems,
    level: stats.level,
    progress,
    missionsPassed,
    quizScores,
    studyLog,
    weeklyStudyMins,
    allTimeStudyMins,
    purchasedTracks: (purchasesRes.data ?? []).map((r) => r.track_id),
  };
}

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  avatarKey: string;
  xp: number;
  level: number;
}

/** Real leaderboard — top N by XP. Any authenticated user may read any
 * row in player_stats (see schema.sql), which is exactly what this needs. */
export async function loadLeaderboard(supabase: TypedClient, limit = 10): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("player_stats")
    .select("user_id, display_name, avatar_key, xp, level")
    .order("xp", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("loadLeaderboard failed", error);
    return [];
  }

  return (data ?? []).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatarKey: r.avatar_key,
    xp: r.xp,
    level: r.level,
  }));
}

/**
 * The caller's real rank, even when they're outside the visible top N —
 * previously the leaderboard only ever showed the top 10 with no
 * indication of where you actually stand if you weren't in it. Computed
 * as "how many players have strictly more XP than me, plus one" — a
 * genuine rank, not an estimate.
 */
export async function loadMyRank(
  supabase: TypedClient,
  userId: string
): Promise<{ rank: number; xp: number; totalPlayers: number } | null> {
  const { data: mine, error: mineError } = await supabase
    .from("player_stats")
    .select("xp")
    .eq("user_id", userId)
    .single();

  if (mineError || !mine) return null;

  const { count: ahead, error: aheadError } = await supabase
    .from("player_stats")
    .select("user_id", { count: "exact", head: true })
    .gt("xp", mine.xp);

  const { count: total, error: totalError } = await supabase
    .from("player_stats")
    .select("user_id", { count: "exact", head: true });

  if (aheadError || totalError) return null;

  return { rank: (ahead ?? 0) + 1, xp: mine.xp, totalPlayers: total ?? 0 };
}

/** Resolves the Supabase quizzes.id (uuid) for a given "trackId:moduleId"
 * string, so the client can call get_quiz_questions()/submit_quiz_attempt()
 * without hardcoding UUIDs anywhere in curriculum.ts. */
export async function getQuizIdForModule(supabase: TypedClient, moduleId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id")
    .eq("module_id", moduleId)
    .single();
  if (error || !data) {
    console.error("getQuizIdForModule failed", moduleId, error);
    return null;
  }
  return data.id;
}
