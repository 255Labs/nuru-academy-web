"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NuruMoodImg } from "./NuruMoodImg";

type QType = "mcq" | "tf" | "short";

interface BattleQuestion {
  id: string;
  sort_position: number;
  type: QType;
  question_text: string;
  options: string[] | null;
  displayOptions?: { label: string; originalIndex: number }[];
}

export interface BattleResult {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
}

const QUESTION_SECONDS = 12;
const FAST_WINDOW_SECONDS = 6; // answer within this window = a full hit

function shuffle<T>(a: T[]): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/**
 * Real-time Battle Trial: race against a per-question clock, correct
 * answers deal damage to the "Doubt" enemy, wrong/timeout answers let it
 * counter-hit. Health bars are a visual/motivational layer riding
 * alongside the real score — pass/fail is still decided by the same
 * correct-out-of-total-questions rule battle_finish() enforces (identical
 * to submit_quiz_attempt()'s certification logic), so a rough run of
 * on-screen "damage" can never let someone pass without the real
 * percentage, and a few early misses can never permanently fail them
 * either. The battle always plays through every question.
 */
export function BattleTrial({
  quizId, tone, onDone,
}: {
  quizId: string;
  tone: string;
  onDone: (r: BattleResult) => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qs, setQs] = useState<BattleQuestion[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | boolean | string>>({});
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [nuruHp, setNuruHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [feedback, setFeedback] = useState<"hit" | "miss" | null>(null);
  const [locked, setLocked] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("battle_start", { p_quiz_id: quizId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setLoadError(true);
        return;
      }
      const payload = data as unknown as { session_id: string; questions: BattleQuestion[] };
      const withShuffled = payload.questions.map((q) => ({
        ...q,
        displayOptions: q.type === "mcq" && q.options
          ? shuffle(q.options.map((label, originalIndex) => ({ label, originalIndex })))
          : undefined,
      }));
      setSessionId(payload.session_id);
      setQs(withShuffled.sort((a, b) => a.sort_position - b.sort_position));
      setEndAt(Date.now() + QUESTION_SECONDS * 1000);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    if (endAt === null || locked) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endAt, locked]);

  useEffect(() => {
    if (endAt !== null && now >= endAt && !locked) {
      resolveAnswer(undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  if (loadError) {
    return (
      <div className="p-8 text-center text-sm text-nuru-muted">
        Couldn&apos;t reach this Trial right now. Check your connection and try again.
      </div>
    );
  }
  if (!qs || endAt === null || !sessionId) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-nuru-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Summoning Doubt…
      </div>
    );
  }

  const q = qs[i];
  const remain = Math.max(0, endAt - now);
  const remainSec = remain / 1000;
  const danger = remainSec < 3;

  async function resolveAnswer(value: number | boolean | string | undefined, timedOut: boolean) {
    if (locked || !qs) return;
    const questions = qs;
    setLocked(true);
    if (value !== undefined) setAnswers((a) => ({ ...a, [i]: value }));

    const answeredAtSec = QUESTION_SECONDS - remainSec;
    const { data } = await supabase.rpc("battle_answer", {
      p_session_id: sessionId!,
      p_question_id: q.id,
      p_answer: (value ?? null) as never,
    });
    const result = data as unknown as { ok: boolean } | null;
    const correct = !!result?.ok && !timedOut;

    if (correct) {
      const bigHit = answeredAtSec <= FAST_WINDOW_SECONDS;
      setEnemyHp((hp) => Math.max(0, hp - (bigHit ? 35 : 20)));
      setFeedback("hit");
    } else {
      setNuruHp((hp) => Math.max(8, hp - 20));
      setFeedback("miss");
    }

    setTimeout(async () => {
      setFeedback(null);
      if (i < questions.length - 1) {
        setI((v) => v + 1);
        setEndAt(Date.now() + QUESTION_SECONDS * 1000);
        setLocked(false);
      } else {
        setFinishing(true);
        const { data: finishData } = await supabase.rpc("battle_finish", { p_session_id: sessionId! });
        const r = finishData as unknown as BattleResult | null;
        onDone(r ?? { correct: 0, total: questions.length, pct: 0, passed: false });
      }
    }, 900);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="flex-1 text-center">
          <NuruMoodImg mood={nuruHp < 40 ? "sad" : "helping"} size={44} className="mx-auto mb-1.5" />
          <div className="text-[11px] font-bold text-nuru-muted uppercase tracking-wide mb-1">Nuru</div>
          <div className="h-2.5 rounded-full bg-nuru-lav overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${nuruHp}%`, background: nuruHp < 30 ? "#EF4444" : tone }}
            />
          </div>
        </div>
        <Swords size={20} className="text-nuru-muted shrink-0" />
        <div className="flex-1 text-center">
          <div className="w-11 h-11 rounded-full mx-auto mb-1.5 grid place-items-center text-white text-lg font-bold" style={{ background: "#4A4058" }}>
            ?
          </div>
          <div className="text-[11px] font-bold text-nuru-muted uppercase tracking-wide mb-1">Doubt</div>
          <div className="h-2.5 rounded-full bg-nuru-lav overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ml-auto"
              style={{ width: `${enemyHp}%`, background: "#4A4058" }}
            />
          </div>
        </div>
      </div>

      {finishing ? (
        <div className="flex items-center justify-center gap-2 py-10 text-nuru-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Tallying the trial…
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase">
              Question {i + 1} of {qs.length}
            </span>
            <span className={`flex items-center gap-1 text-sm font-bold ${danger ? "text-nuru-rose" : "text-nuru-muted"}`}>
              <Clock size={13} /> {remainSec.toFixed(1)}s
            </span>
          </div>

          <div className="h-1.5 rounded-full bg-nuru-lav overflow-hidden mb-4">
            <div
              className="h-full rounded-full"
              style={{ width: `${(remainSec / QUESTION_SECONDS) * 100}%`, background: danger ? "#EF4444" : tone, transition: "width 0.1s linear" }}
            />
          </div>

          <div className="font-display font-bold text-lg text-nuru-ink mb-4 leading-snug min-h-[3rem]">
            {q.question_text}
          </div>

          {feedback && (
            <div className={`text-center py-2 mb-3 rounded-xl font-bold text-sm ${
              feedback === "hit" ? "bg-green-50 text-nuru-greenDeep" : "bg-red-50 text-nuru-rose"
            }`}>
              {feedback === "hit" ? "Direct hit! Doubt reels back." : "Doubt strikes back."}
            </div>
          )}

          {!feedback && q.type === "mcq" && q.displayOptions && (
            <div className="grid grid-cols-1 gap-2">
              {q.displayOptions.map((opt) => (
                <button
                  key={opt.originalIndex}
                  onClick={() => resolveAnswer(opt.originalIndex, false)}
                  disabled={locked}
                  className="text-left px-4 py-3 rounded-xl text-sm font-medium bg-nuru-bg hover:bg-nuru-lav transition-colors border-2 border-transparent disabled:opacity-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {!feedback && q.type === "tf" && (
            <div className="grid grid-cols-2 gap-2.5">
              {[["True", true], ["False", false]].map(([lab, v]) => (
                <button
                  key={String(v)}
                  onClick={() => resolveAnswer(v as boolean, false)}
                  disabled={locked}
                  className="py-3.5 rounded-xl font-bold text-[15px] bg-nuru-bg hover:bg-nuru-lav transition-colors disabled:opacity-50"
                >
                  {lab as string}
                </button>
              ))}
            </div>
          )}
          {!feedback && q.type === "short" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = (answers[i] as string) || "";
                resolveAnswer(val, false);
              }}
            >
              <input
                autoFocus
                value={(answers[i] as string) || ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                placeholder="Type your answer, then press enter"
                disabled={locked}
                maxLength={200}
                className="w-full px-4 py-3 rounded-xl text-[15px] bg-nuru-bg border-2 border-transparent focus:border-nuru-purple text-nuru-ink disabled:opacity-50"
              />
            </form>
          )}
        </div>
      )}
    </div>
  );
}
