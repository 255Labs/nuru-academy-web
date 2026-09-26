/**
 * curriculum-db.ts
 *
 * Single source of truth: the DATABASE.
 * The static curriculum.ts file is only used as a one-time seed.
 * After seeding, all reads go through these functions.
 *
 * Server components use the server client (cookies).
 * Client components use the client singleton.
 * Both use the same public RPC / select queries.
 */

import type { Track, CourseModule, Lesson, MissionQuiz, LessonBlock, DailyChallenge } from "@/lib/types";

export type DbTrack = {
  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  description: string | null;
  price_tzs: number;
  passing_pct: number;
  tone_hex: string;
  tone_deep_hex: string;
  requires: string | null;
  hero_image: string | null;
  sort_order: number;
  is_published: boolean;
};

export type DbModule = {
  id: string;
  track_id: string;
  week: number;
  name: string;
  tagline: string;
  description: string | null;
  sort_order: number;
};

export type DbLesson = {
  id: string;
  module_id: string;
  day: number;
  title: string;
  objective: string;
  block1_topic: string;
  block1_points: string[];
  block2_topic: string;
  block2_points: string[];
  demo: string | null;
  homework: string | null;
  notes: string | null;
  video_title: string | null;
  sort_order: number;
};

export type DbQuiz = {
  id: string;
  module_id: string;
  title: string;
  subtitle: string;
  minutes: number;
  passing_pct: number;
  is_placeholder: boolean;
};

export type DbQuestion = {
  id: string;
  quiz_id: string;
  sort_position: number;
  type: "mcq" | "tf" | "short";
  question_text: string;
  options: string[] | null;
  correct: number | boolean | string[];
  explain: string;
};

// ── Convert DB rows to the Track[] shape the app expects ──────────────────────

function dbLessonToLesson(l: DbLesson): Lesson {
  return {
    day: l.day,
    title: l.title,
    objective: l.objective,
    block1: { topic: l.block1_topic, points: l.block1_points } as LessonBlock,
    block2: { topic: l.block2_topic, points: l.block2_points } as LessonBlock,
    demo: l.demo ?? undefined,
    homework: l.homework ?? undefined,
    notes: l.notes ?? undefined,
    videoTitle: l.video_title ?? undefined,
    // videoId and dailyChallenge loaded separately when needed
  };
}

function dbQuizToMissionQuiz(q: DbQuiz, questions: DbQuestion[]): MissionQuiz {
  return {
    title: q.title,
    subtitle: q.subtitle,
    minutes: q.minutes,
    passingPct: q.passing_pct,
    placeholder: q.is_placeholder,
    questions: questions.map((qq) => ({
      type: qq.type,
      q: qq.question_text,
      options: qq.options ?? undefined,
      correct: qq.correct as never,
      explain: qq.explain,
      accept: Array.isArray(qq.correct) ? (qq.correct as string[]) : undefined,
    })),
  };
}

export function dbRowsToTracks(
  dbTracks: DbTrack[],
  dbModules: DbModule[],
  dbLessons: DbLesson[],
  dbQuizzes: DbQuiz[],
  dbQuestions: DbQuestion[],
): Track[] {
  return dbTracks
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => {
      const modules = dbModules
        .filter((m) => m.track_id === t.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => {
          const lessons = dbLessons
            .filter((l) => l.module_id === m.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(dbLessonToLesson);
          const quiz = dbQuizzes.find((q) => q.module_id === m.id);
          const questions = quiz
            ? dbQuestions
                .filter((q) => q.quiz_id === quiz.id)
                .sort((a, b) => a.sort_position - b.sort_position)
            : [];
          return {
            id: m.id,
            name: m.name,
            week: m.week,
            tagline: m.tagline,
            lessons,
            quiz: quiz ? dbQuizToMissionQuiz(quiz, questions) : null,
          } as CourseModule;
        });
      return {
        id: t.id as Track["id"],
        name: t.name,
        subtitle: t.subtitle,
        tagline: t.tagline,
        priceTZS: t.price_tzs.toLocaleString(),
        passingPct: t.passing_pct,
        tone: t.tone_hex,
        toneDeep: t.tone_deep_hex,
        cardGradient: [t.tone_hex, t.tone_deep_hex] as [string, string],
        modules,
        enrolled: true,
        requires: t.requires ?? undefined,
      } as Track;
    });
}

// ── Server-side fetch is in curriculum-db-server.ts ───────────────────────────
// Do NOT add any next/headers imports here — this file is also bundled client-side.

// ── Client-side hook ───────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRACKS as STATIC_TRACKS } from "@/data/curriculum";

let _cachedTracks: Track[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useTracks(): { tracks: Track[]; loading: boolean; reload: () => void } {
  const [tracks, setTracks] = useState<Track[]>(_cachedTracks ?? STATIC_TRACKS);
  const [loading, setLoading] = useState(!_cachedTracks);

  async function load() {
    if (_cachedTracks && Date.now() - _cacheTime < CACHE_TTL) {
      setTracks(_cachedTracks);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = createClient();
      const [t, m, l, q] = await Promise.all([
        s.from("tracks").select("*").eq("is_published", true).order("sort_order"),
        s.from("modules").select("*").order("sort_order"),
        s.from("lessons").select("id,module_id,day,title,objective,block1_topic,block1_points,block2_topic,block2_points,demo,homework,notes,video_title,sort_order").order("sort_order"),
        s.from("quizzes").select("*"),
      ]);
      // Questions are not fetched client-side (answer key stays server-side only)
      if (!t.error && t.data?.length) {
        const result = dbRowsToTracks(
          t.data as DbTrack[], m.data as DbModule[],
          l.data as DbLesson[], q.data as DbQuiz[], [],
        );
        _cachedTracks = result;
        _cacheTime = Date.now();
        setTracks(result);
      }
    } catch {
      // Keep static fallback
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { tracks, loading, reload: () => { _cachedTracks = null; load(); } };
}

// Invalidate cache (call from CMS after a save)
export function invalidateTrackCache() {
  _cachedTracks = null;
  _cacheTime = 0;
}
