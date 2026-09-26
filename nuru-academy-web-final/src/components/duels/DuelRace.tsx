"use client";

import { useEffect, useMemo, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getDuelParticipants, getDuelRoom, submitDuelAnswer, subscribeDuelRoom, type DuelParticipant,
} from "@/lib/supabase/duels";

type QType = "mcq" | "tf" | "short";
interface RaceQuestion {
  id: string;
  sort_position: number;
  type: QType;
  question_text: string;
  options: string[] | null;
  displayOptions?: { label: string; originalIndex: number }[];
}

const RUNNER_COLORS = ["#6B4EFF", "#22C55E", "#F5B942", "#EF4444"];

function shuffle<T>(a: T[]): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/**
 * The real "runner" visual: one lane per participant, each runner
 * positioned along the track at current_question_idx / total — driven
 * entirely by real data from duel_participants, refreshed live via the
 * Realtime subscription every time ANY participant's row changes
 * (including your own answers, which land the same way as everyone
 * else's — no special-cased local state pretending to be synced).
 *
 * There's no per-question timer here on purpose: the backend doesn't
 * enforce one (submit_duel_answer never checks timing), so racing is
 * purely "how fast you personally answer, and how many you get right" —
 * adding a client-side countdown that the server doesn't actually
 * enforce would be a fake constraint, not a real one.
 */
export function DuelRace({ roomId, quizId, onFinished }: { roomId: string; quizId: string; onFinished: () => void }) {
  const [questions, setQuestions] = useState<RaceQuestion[] | null>(null);
  const [participants, setParticipants] = useState<DuelParticipant[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; avatar: string }>>({});
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myIdx, setMyIdx] = useState(0);
  const [feedback, setFeedback] = useState<"hit" | "miss" | null>(null);
  const [answerValue, setAnswerValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [roomFinished, setRoomFinished] = useState(false);
  const [myResult, setMyResult] = useState<{ finished: boolean; rank?: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        setMyUserId(user.id);

        const { data: qData } = await supabase.rpc("get_quiz_questions", { p_quiz_id: quizId });
        if (cancelled) return;
        const withShuffled = ((qData ?? []) as RaceQuestion[])
          .map((q) => ({
            ...q,
            displayOptions: q.type === "mcq" && q.options
              ? shuffle(q.options.map((label, originalIndex) => ({ label, originalIndex })))
              : undefined,
          }))
          .sort((a, b) => a.sort_position - b.sort_position);
        setQuestions(withShuffled);

        await refresh();
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Couldn't load this duel.");
        }
      }
    }

    async function refresh() {
      try {
        const [ps, r] = await Promise.all([getDuelParticipants(supabase, roomId), getDuelRoom(supabase, roomId)]);
        if (cancelled) return;
        setParticipants(ps);
        if (r.status === "finished") setRoomFinished(true);

        const missingIds = ps.map((p) => p.user_id).filter((id) => !(id in namesRef.current));
        if (missingIds.length > 0) {
          const { data: stats } = await supabase.from("player_stats").select("user_id, display_name, avatar_key").in("user_id", missingIds);
          if (stats) {
            const additions: Record<string, { name: string; avatar: string }> = {};
            stats.forEach((s) => { additions[s.user_id] = { name: s.display_name, avatar: s.avatar_key }; });
            namesRef.current = { ...namesRef.current, ...additions };
            setNames({ ...namesRef.current });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Lost connection to the duel — try refreshing.");
        }
      }
    }

    init();
    const unsubscribe = subscribeDuelRoom(supabase, roomId, refresh, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, quizId]);

  // Ref-backed cache so the async refresh() closure always sees latest
  // names without re-subscribing.
  const namesRef = useMemo(() => ({ current: {} as Record<string, { name: string; avatar: string }> }), []);

  const totalQuestions = questions?.length ?? 0;
  const q = questions?.[myIdx];

  async function answer(value: unknown) {
    if (!q || submitting) return;
    setSubmitting(true);
    setAnswerError(null);
    try {
      const supabase = createClient();
      const result = await submitDuelAnswer(supabase, roomId, q.id, value);
      setFeedback(result.ok ? "hit" : "miss");
      setTimeout(() => {
        setFeedback(null);
        setAnswerValue("");
        setSubmitting(false);
        if (result.finished) {
          setMyResult({ finished: true, rank: result.rank });
        } else {
          setMyIdx((i) => i + 1);
        }
      }, 500);
    } catch (err) {
      setSubmitting(false);
      setAnswerError(
        err instanceof Error ? err.message : "Couldn't submit that answer — check your connection and try again."
      );
    }
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-sm text-nuru-rose">{loadError}</p>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-nuru-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading the race…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* The track — one lane per real participant */}
      <div className="bg-nuru-card rounded-2xl2 p-5 shadow-card border border-nuru-line mb-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-nuru-muted uppercase tracking-wide mb-3">
          <Flag size={13} /> Live race
        </div>
        <div className="flex flex-col gap-3">
          {participants.map((p, i) => {
            const pct = Math.min(100, Math.round((p.current_question_idx / Math.max(totalQuestions, 1)) * 100));
            const isMe = p.user_id === myUserId;
            const color = RUNNER_COLORS[i % RUNNER_COLORS.length];
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                  <span className={isMe ? "text-nuru-purpleDeep" : "text-nuru-ink2"}>
                    {names[p.user_id]?.name ?? "…"}{isMe ? " (You)" : ""}
                    {p.finished_at && ` — finished${p.final_rank ? ` #${p.final_rank}` : ""}`}
                  </span>
                  <span className="text-nuru-muted">{p.correct_count} correct</span>
                </div>
                <div className="h-3 rounded-full bg-nuru-lav overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${pct}%`, background: color }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full grid place-items-center text-white text-[10px] font-bold shadow transition-all duration-500 ease-out"
                    style={{ left: `calc(${pct}% - 10px)`, background: color }}
                  >
                    {names[p.user_id]?.avatar ?? "?"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* My question card, or a waiting state once I've finished */}
      {myResult?.finished ? (
        <div className="bg-nuru-card rounded-2xl2 p-6 shadow-card border border-nuru-line text-center">
          <div className="font-display font-bold text-lg text-nuru-ink mb-1">
            You finished{myResult.rank ? ` — rank #${myResult.rank}` : ""}!
          </div>
          <p className="text-sm text-nuru-muted mb-4">
            {roomFinished ? "Everyone's done." : "Watching the rest of the race live…"}
          </p>
          {roomFinished && (
            <button onClick={onFinished} className="px-5 py-2.5 rounded-xl bg-nuru-purple text-white text-sm font-bold">
              See final results
            </button>
          )}
        </div>
      ) : q ? (
        <div className="bg-nuru-card rounded-2xl2 p-6 shadow-card border border-nuru-line">
          <div className="text-[11px] font-bold text-nuru-muted uppercase tracking-wide mb-2">
            Question {myIdx + 1} of {totalQuestions}
          </div>
          <div className="font-display font-bold text-lg text-nuru-ink mb-4 leading-snug">{q.question_text}</div>

          {feedback && (
            <div className={`text-center py-2 mb-3 rounded-xl font-bold text-sm ${feedback === "hit" ? "bg-green-50 text-nuru-greenDeep" : "bg-red-50 text-nuru-rose"}`}>
              {feedback === "hit" ? "Correct!" : "Not quite."}
            </div>
          )}

          {answerError && (
            <div className="text-center py-2 mb-3 rounded-xl font-semibold text-sm bg-red-50 text-nuru-rose">
              {answerError}
            </div>
          )}

          {!feedback && q.type === "mcq" && q.displayOptions && (
            <div className="grid grid-cols-1 gap-2">
              {q.displayOptions.map((opt) => (
                <button
                  key={opt.originalIndex}
                  onClick={() => answer(opt.originalIndex)}
                  disabled={submitting}
                  className="text-left px-4 py-3 rounded-xl text-sm font-medium bg-nuru-bg hover:bg-nuru-lav transition-colors disabled:opacity-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {!feedback && q.type === "tf" && (
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => answer(true)} disabled={submitting} className="py-3.5 rounded-xl font-bold text-[15px] bg-nuru-bg hover:bg-nuru-lav transition-colors disabled:opacity-50">True</button>
              <button onClick={() => answer(false)} disabled={submitting} className="py-3.5 rounded-xl font-bold text-[15px] bg-nuru-bg hover:bg-nuru-lav transition-colors disabled:opacity-50">False</button>
            </div>
          )}
          {!feedback && q.type === "short" && (
            <form onSubmit={(e) => { e.preventDefault(); answer(answerValue); }}>
              <input
                autoFocus
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                placeholder="Type your answer, then press enter"
                disabled={submitting}
                className="w-full px-4 py-3 rounded-xl text-[15px] bg-nuru-bg border-2 border-transparent focus:border-nuru-purple text-nuru-ink disabled:opacity-50"
              />
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
