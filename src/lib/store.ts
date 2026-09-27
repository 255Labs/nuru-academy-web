"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TRACKS } from "@/data/curriculum";
import type { Quest } from "@/lib/types";

export type TrackId = "beginner" | "intermediate" | "expert";
export type Role = "student" | "admin";
export type ThemeMode = "dark" | "light";
export type AgeTier = "child" | "teen" | "adult" | "professional";
export type DisplayLang = "en" | "sw" | "fr" | "am" | "ha" | "yo" | "zu";

export const LANG_META: Record<DisplayLang, { label: string; native: string; flag: string }> = {
  en: { label: "English",   native: "English",    flag: "🇬🇧" },
  sw: { label: "Swahili",   native: "Kiswahili",  flag: "🇹🇿" },
  fr: { label: "French",    native: "Français",   flag: "🇫🇷" },
  am: { label: "Amharic",   native: "አማርኛ",       flag: "🇪🇹" },
  ha: { label: "Hausa",     native: "Hausa",      flag: "🇳🇬" },
  yo: { label: "Yoruba",    native: "Yorùbá",     flag: "🇳🇬" },
  zu: { label: "Zulu",      native: "isiZulu",    flag: "🇿🇦" },
};

export const AGE_TIER_META: Record<AgeTier, {
  label: string; range: string; icon: string;
  xpMultiplier: number; uiMode: "playful" | "standard" | "focused";
}> = {
  child:        { label: "Explorer",     range: "Ages 6–12",  icon: "🌟", xpMultiplier: 1.5, uiMode: "playful"  },
  teen:         { label: "Challenger",   range: "Ages 13–17", icon: "⚡", xpMultiplier: 1.2, uiMode: "playful"  },
  adult:        { label: "Learner",      range: "Ages 18+",   icon: "📚", xpMultiplier: 1.0, uiMode: "standard" },
  professional: { label: "Professional", range: "Working adult", icon: "🚀", xpMultiplier: 1.0, uiMode: "focused" },
};

export interface Profile {
  username: string;
  displayName: string;
  email: string;
  bio: string;
  language: "English" | "Swahili";
  avatarKey: string;
  role: Role;
  ageTier: AgeTier;
  displayLang: DisplayLang;
  // Extended onboarding fields
  phoneNumber?: string;
  country?: string;
  city?: string;
  learningStyle?: "visual" | "reading" | "hands_on" | "video" | "mixed";
  goal?: "career" | "curiosity" | "business" | "academic" | "other";
  onboardingComplete?: boolean;
}

interface GameState {
  // Onboarding "flying focus" pointer hints — once dismissed, never shown
  // again for that hint id. Persisted so it survives reloads.
  hintsSeen: Record<string, boolean>;
  dismissHint: (hintId: string) => void;
  // Profile / account
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;

  // Set once real data has been loaded from Supabase — until then, the
  // values below are placeholder/demo numbers, not this user's real
  // progress. See src/components/HydrateFromServer.tsx.
  hydrated: boolean;
  hydrate: (data: {
    profile: Partial<Profile>;
    xp: number;
    coins: number;
    gems: number;
    progress: Record<TrackId, number>;
    missionsPassed: Record<string, boolean>;
    quizScores: Record<string, number>;
    studyLog: string[];
    weeklyStudyMins: number;
    allTimeStudyMins: number;
    purchasedTracks: string[];
  }) => void;

  // Theme
  theme: ThemeMode;
  toggleTheme: () => void;

  // Gamification
  xp: number;
  coins: number;
  gems: number;
  level: number;
  activeTrack: TrackId;
  activeModuleIdx: Record<TrackId, number>;
  progress: Record<TrackId, number>;
  missionsPassed: Record<string, boolean>;
  purchasedTracks: string[];
  quizScores: Record<string, number>; // "trackId:moduleId" -> last pct scored

  // Study activity (drives streak + heatmap + weekly hours from real events)
  studyLog: string[]; // ISO date strings (YYYY-MM-DD), one entry per study "session"
  weeklyStudyMins: number;
  weeklyGoalMins: number;
  allTimeStudyMins: number;

  quests: Quest[];
  questsLoadedDate: string | null; // ISO date quests were last loaded from DB

  setActiveTrack: (t: TrackId) => void;
  setActiveModuleIdx: (t: TrackId, idx: number) => void;
  addXP: (n: number) => void;
  addCoins: (n: number) => void;
  addGems: (n: number) => void;
  logStudyMinutes: (mins: number) => void;
  completeLesson: (trackId: TrackId) => void;
  passMission: (trackId: TrackId, moduleId: string, scorePct: number) => void;
  bumpQuest: (id: string) => void;
  // New: server-driven quest system
  loadTodayQuests: () => Promise<void>;           // fetch from DB, resets if new day
  advanceQuest: (questId: string, by?: number) => Promise<{ justCompleted: boolean }>;
  claimQuestReward: (questId: string) => Promise<{ xp: number; coins: number } | null>;

  // Derived getters (computed on read, not stored, to avoid drift)
  currentStreak: () => number;
  weekChecks: () => boolean[]; // Mon..Sun, today included
  averageQuizScore: () => number;
}

function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayISO(d);
}
// Absolute level formula — one source of truth, used by both hydrate() and
// addXP() so a big XP jump (e.g. hydrating with 6000 XP) lands on the
// correct level rather than the +1-at-a-time rule under-counting it.
function levelForXP(xp: number) {
  return Math.floor(xp / 500) + 1;
}

const initialQuests: Quest[] = [
  { id: "lesson",    label: "Complete 1 Lesson",        done: false, rewarded: false, target: 1,  progress: 0, icon: "book",  xpReward: 100, coinsReward: 50  },
  { id: "quiz",      label: "Pass a Mission Quest",      done: false, rewarded: false, target: 1,  progress: 0, icon: "quiz",  xpReward: 500, coinsReward: 250 },
  { id: "duel",      label: "Win an Arena Duel",         done: false, rewarded: false, target: 1,  progress: 0, icon: "duel",  xpReward: 200, coinsReward: 100 },
  { id: "study20",   label: "Study for 20 minutes",      done: false, rewarded: false, target: 20, progress: 0, icon: "clock", xpReward: 150, coinsReward: 75  },
  { id: "challenge", label: "Answer a Daily Challenge",  done: false, rewarded: false, target: 1,  progress: 0, icon: "zap",   xpReward: 50,  coinsReward: 25  },
];

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      profile: {
        username: "balati",
        displayName: "Balati",
        email: "balati@example.com",
        bio: "Building Nuru AI Academy — Head of IT, BMG Group.",
        language: "English",
        avatarKey: "B",
        role: "admin",
        ageTier: "adult",
        displayLang: "en",
      },
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      hydrated: false,
      hydrate: (data) =>
        set((s) => ({
          hydrated: true,
          profile: { ...s.profile, ...data.profile },
          xp: data.xp,
          coins: data.coins,
          gems: data.gems,
          level: levelForXP(data.xp),
          progress: data.progress,
          missionsPassed: data.missionsPassed,
          quizScores: data.quizScores,
          // Always trust the real, hydrated data — including a genuinely
          // empty log for a brand-new account. Previously this fell back
          // to stale local state when the real log was empty, which is
          // exactly the pattern that let fake seeded data linger.
          studyLog: data.studyLog,
          weeklyStudyMins: data.weeklyStudyMins,
          allTimeStudyMins: data.allTimeStudyMins,
          purchasedTracks: data.purchasedTracks,
        })),

      theme: "light",
      toggleTheme: () => {
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" }));
        // Notify ThemeSync (which no longer imports this store) to re-apply
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("nuru-theme-change"));
        }
      },

      hintsSeen: {},
      dismissHint: (hintId) => set((s) => ({ hintsSeen: { ...s.hintsSeen, [hintId]: true } })),

      xp: 4250,
      coins: 12450,
      gems: 320,
      level: 27,
      activeTrack: "beginner",
      activeModuleIdx: { beginner: 0, intermediate: 0, expert: 0 },
      progress: { beginner: 2, intermediate: 0, expert: 0 },
      missionsPassed: {},
      quizScores: {},
      purchasedTracks: [],

      // Honest zero defaults — no fake seeded history. A brand-new (or
      // not-yet-hydrated) account genuinely has 0 study minutes and an
      // empty log; hydrate() below replaces these with the real numbers
      // from Supabase as soon as it loads, never a fabricated baseline.
      studyLog: [],
      weeklyStudyMins: 0,
      weeklyGoalMins: 900,
      allTimeStudyMins: 0,

      quests: initialQuests,
      questsLoadedDate: null,

      setActiveTrack: (t) => set({ activeTrack: t }),
      setActiveModuleIdx: (t, idx) =>
        set((s) => ({ activeModuleIdx: { ...s.activeModuleIdx, [t]: idx } })),

      addXP: (n) =>
        set((s) => {
          const xp = s.xp + n;
          return { xp, level: levelForXP(xp) };
        }),
      addCoins: (n) => set((s) => ({ coins: s.coins + n })),
      addGems: (n) => set((s) => ({ gems: s.gems + n })),
      // ── GEM SHOP ACTIVATION POINTS ──────────────────────────────────────
      // When activating the gem shop, call addGems() at these points:
      //
      // 1. completeLesson() → if track completion detected:
      //      addGems(GEM_GRANTS.complete_track_beginner) etc.
      //
      // 2. passMission() → if score === 100:
      //      addGems(GEM_GRANTS.perfect_quiz_score)
      //
      // 3. After competition result received:
      //      addGems(GEM_GRANTS.competition_first_place) etc.
      //
      // 4. Daily login streak checks (in HydrateFromServer or cron):
      //      addGems(GEM_GRANTS.daily_login_streak_7) etc.
      //
      // Import GEM_GRANTS from "@/lib/gems" (uncomment gems.ts first).
      // ─────────────────────────────────────────────────────────────────────

      logStudyMinutes: (mins) =>
        set((s) => {
          const today = todayISO();
          const studyLog = s.studyLog.includes(today) ? s.studyLog : [...s.studyLog, today];
          return {
            studyLog,
            weeklyStudyMins: s.weeklyStudyMins + mins,
            allTimeStudyMins: s.allTimeStudyMins + mins,
            // study20 quest advance handled by advanceQuest() RPC separately
          };
        }),

      completeLesson: (trackId) =>
        set((s) => {
          const today = todayISO();
          const studyLog = s.studyLog.includes(today) ? s.studyLog : [...s.studyLog, today];
          // Update progress. Quest advance is handled by advanceQuest() RPC separately.
          return {
            studyLog,
            progress: { ...s.progress, [trackId]: s.progress[trackId] + 1 },
          };
        }),

      passMission: (trackId, moduleId, scorePct) => {
        const key = `${trackId}:${moduleId}`;
        const today = todayISO();
        set((s) => ({
          missionsPassed: { ...s.missionsPassed, [key]: true },
          quizScores: { ...s.quizScores, [key]: scorePct },
          progress: { ...s.progress, [trackId]: s.progress[trackId] + 1 },
          studyLog: s.studyLog.includes(today) ? s.studyLog : [...s.studyLog, today],
          // Quest advance handled by advanceQuest() RPC separately
        }));

        // Fix #7: issue certificate when the final module of a track is passed.
        // TRACKS is imported at the top of this file. We check whether this
        // moduleId is the last module in the track — if so, call issue_certificate.
        const track = TRACKS.find((t) => t.id === trackId);
        if (track) {
          const lastModule = track.modules[track.modules.length - 1];
          if (lastModule && lastModule.id === moduleId) {
            // Fire-and-forget — certificate failure must never block the learner.
            import("@/lib/supabase/client").then(({ createClient }) => {
              const supabase = createClient();
              supabase
                .rpc("issue_certificate", { p_track_id: trackId })
                .then(({ error }) => {
                  if (error) console.error("issue_certificate failed:", error);
                });
            });
          }
        }
      },

      bumpQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) => (q.id === id ? { ...q, done: true, progress: q.target } : q)),
        })),

      // ── Server-driven quest actions ─────────────────────────────────────────

      loadTodayQuests: async () => {
        const today = todayISO();
        // Only reload once per day — or if the store date is stale
        const loaded = get().questsLoadedDate;
        if (loaded === today) return;
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data, error } = await supabase.rpc("get_today_quests");
          if (error || !data) return;
          const quests: Quest[] = (data as Array<{
            quest_id: string; label: string; icon: string;
            target: number; progress: number;
            completed: boolean; rewarded: boolean;
            xp_reward: number; coins_reward: number;
          }>).map((row) => ({
            id: row.quest_id,
            label: row.label,
            icon: row.icon as Quest["icon"],
            target: row.target,
            progress: row.progress,
            done: row.completed,
            rewarded: row.rewarded,
            xpReward: row.xp_reward,
            coinsReward: row.coins_reward,
          }));
          set({ quests, questsLoadedDate: today });
        } catch {
          // Network failure — keep client state, don't crash
        }
      },

      advanceQuest: async (questId, by = 1) => {
        // Optimistic local update first for instant feedback
        set((s) => ({
          quests: s.quests.map((q) => {
            if (q.id !== questId || q.done) return q;
            const progress = Math.min(q.target, q.progress + by);
            return { ...q, progress, done: progress >= q.target };
          }),
        }));
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data, error } = await supabase.rpc("advance_quest", {
            p_quest_id: questId,
            p_increment: by,
          });
          if (error) {
            console.error("advance_quest failed:", error.message);
            return { justCompleted: false };
          }
          const result = data as { just_completed: boolean; progress: number; target: number };
          // Sync exact DB progress back to client
          set((s) => ({
            quests: s.quests.map((q) =>
              q.id === questId
                ? { ...q, progress: result.progress, done: result.progress >= result.target }
                : q
            ),
          }));
          return { justCompleted: result.just_completed };
        } catch {
          return { justCompleted: false };
        }
      },

      claimQuestReward: async (questId) => {
        // Guard: must be done and not already rewarded
        const quest = get().quests.find((q) => q.id === questId);
        if (!quest?.done || quest.rewarded) return null;
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data, error } = await supabase.rpc("claim_quest_reward", {
            p_quest_id: questId,
          });
          if (error) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("claim_quest_reward failed:", error.message);
            }
            return null;
          }
          const result = data as { xp: number; coins: number };
          // Apply reward locally — XP/coins come from the DB, not hardcoded
          set((s) => ({
            xp: s.xp + result.xp,
            level: levelForXP(s.xp + result.xp),
            coins: s.coins + result.coins,
            quests: s.quests.map((q) =>
              q.id === questId ? { ...q, rewarded: true } : q
            ),
          }));
          return { xp: result.xp, coins: result.coins };
        } catch {
          return null;
        }
      },

      currentStreak: () => {
        const log = new Set(get().studyLog);
        let streak = 0;
        for (let i = 0; ; i++) {
          const day = daysAgoISO(i);
          if (log.has(day)) streak++;
          else break;
        }
        return streak;
      },

      weekChecks: () => {
        const log = new Set(get().studyLog);
        const now = new Date();
        const dow = (now.getDay() + 6) % 7; // 0 = Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() - dow);
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          return d > now ? false : log.has(todayISO(d));
        });
      },

      averageQuizScore: () => {
        const scores = Object.values(get().quizScores);
        if (!scores.length) return 0;
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      },
    }),
    {
      name: "nuru-academy-storage",
      partialize: (s) => ({
        profile: s.profile,
        theme: s.theme,
        hintsSeen: s.hintsSeen,
        xp: s.xp,
        coins: s.coins,
        gems: s.gems,
        level: s.level,
        activeTrack: s.activeTrack,
        activeModuleIdx: s.activeModuleIdx,
        progress: s.progress,
        missionsPassed: s.missionsPassed,
        purchasedTracks: s.purchasedTracks,
        quizScores: s.quizScores,
        studyLog: s.studyLog,
        weeklyStudyMins: s.weeklyStudyMins,
        weeklyGoalMins: s.weeklyGoalMins,
        allTimeStudyMins: s.allTimeStudyMins,
        quests: s.quests,
      }),
    }
  )
);

export function trackTotalNodes(trackId: TrackId) {
  const track = TRACKS.find((t) => t.id === trackId)!;
  return track.modules.reduce((a, m) => a + m.lessons.length + (m.quiz ? 1 : 0), 0);
}

/**
 * Real prerequisite gating — not the cosmetic `t.requires &&` checks used
 * elsewhere before this, which only ever controlled a lock *icon*, never
 * actually stopped anyone from playing a track. This checks the genuine,
 * Supabase-hydrated `missionsPassed` record for whether the prerequisite
 * track's Emberfall (its 5th and final module) was actually passed.
 *
 * A track with no `requires` (Beginner) is always unlocked.
 */
/**
 * A track is unlocked by EITHER path: earning it (passing the
 * prerequisite track's Emberfall) or paying for it directly (a real,
 * webhook-confirmed ClickPesa payment — see src/lib/clickpesa.ts and
 * supabase/schema.sql's track_purchases table). Both are genuine data
 * checks, not cosmetic flags.
 */
export function isTrackUnlocked(
  trackId: TrackId,
  missionsPassed: Record<string, boolean>,
  purchasedTracks: string[] = []
): boolean {
  const track = TRACKS.find((t) => t.id === trackId);`n  if (!track) return true; // unknown track � don't hard-lock`n  if (!track.requires) return true;
  if (purchasedTracks.includes(trackId)) return true;

  const prereqTrack = TRACKS.find((t) => t.subtitle === track.requires);
  if (!prereqTrack) return true; // misconfigured data shouldn't hard-lock the app

  const emberfall = prereqTrack.modules[prereqTrack.modules.length - 1];
  return !!missionsPassed[`${prereqTrack.id}:${emberfall.id}`];
}

