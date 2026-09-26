"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getDuelParticipants,
  getDuelRoom,
  submitDuelAnswer,
  subscribeDuelRoom,
  type DuelParticipant,
} from "@/lib/supabase/duels";
import { RunnerEngine, RUNNER_CANVAS_W, RUNNER_CANVAS_H } from "@/game/runnerEngine.js";
import { TRACKS } from "@/data/curriculum";

// ─── Types ───────────────────────────────────────────────────────────────────

type QType = "mcq" | "tf" | "short";

interface RaceQuestion {
  id: string;
  sort_position: number;
  type: QType;
  question_text: string;
  options: string[] | null;
  displayOptions?: { label: string; originalIndex: number }[];
}

interface PlayerInfo {
  userId: string;
  displayName: string;
  avatarKey: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Map track quiz to a background color index (0–3)
function bgIndexForTrack(trackId: string): number {
  const map: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 };
  return map[trackId] ?? 0;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DuelRunner({
  roomId,
  quizId,
  onFinished,
}: {
  roomId: string;
  quizId: string;
  onFinished: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<InstanceType<typeof RunnerEngine> | null>(null);

  // Data state
  const [questions, setQuestions] = useState<RaceQuestion[] | null>(null);
  const [participants, setParticipants] = useState<DuelParticipant[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerInfo>>({});
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Answer / question UI state
  const [myIdx, setMyIdx] = useState(0);
  const [feedback, setFeedback] = useState<"hit" | "miss" | null>(null);
  const [answerValue, setAnswerValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [myFinished, setMyFinished] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [roomFinished, setRoomFinished] = useState(false);

  // We need a stable ref to players for the refresh closure
  const playersRef = useRef<Record<string, PlayerInfo>>({});

  // ── Load questions + auth ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        setMyUserId(user.id);

        const { data: qData } = await supabase.rpc("get_quiz_questions", { p_quiz_id: quizId });
        if (cancelled) return;

        const qs: RaceQuestion[] = ((qData ?? []) as RaceQuestion[])
          .map((q) => ({
            ...q,
            displayOptions:
              q.type === "mcq" && q.options
                ? shuffle(q.options.map((label, originalIndex) => ({ label, originalIndex })))
                : undefined,
          }))
          .sort((a, b) => a.sort_position - b.sort_position);

        setQuestions(qs);
        await refresh(user.id, qs.length);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load the race.");
      }
    }

    async function refresh(knownUserId?: string, totalQ?: number) {
      try {
        const [ps, room] = await Promise.all([
          getDuelParticipants(supabase, roomId),
          getDuelRoom(supabase, roomId),
        ]);
        if (cancelled) return;

        setParticipants(ps);
        if (room.status === "finished") setRoomFinished(true);

        // Fetch display names for new participants
        const missing = ps
          .map((p) => p.user_id)
          .filter((id) => !(id in playersRef.current));

        if (missing.length > 0) {
          const { data: stats } = await supabase
            .from("player_stats")
            .select("user_id, display_name, avatar_key")
            .in("user_id", missing);

          if (stats && !cancelled) {
            const updates: Record<string, PlayerInfo> = {};
            stats.forEach((s) => {
              updates[s.user_id] = {
                userId: s.user_id,
                displayName: s.display_name,
                avatarKey: s.avatar_key,
              };
            });
            playersRef.current = { ...playersRef.current, ...updates };
            setPlayers({ ...playersRef.current });
          }
        }

        // Update engine runner positions
        if (engineRef.current) {
          ps.forEach((p, i) => {
            engineRef.current!.setProgress(i, p.current_question_idx, p.correct_count);
            if (p.finished_at && p.final_rank) {
              engineRef.current!.setFinished(i, p.final_rank);
            }
          });
        }
      } catch {
        // transient — keep going
      }
    }

    init();
    const unsub = subscribeDuelRoom(supabase, roomId, () => refresh(), () => refresh());
    return () => { cancelled = true; unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, quizId]);

  // ── Mount canvas engine once questions + userId are ready ──────────────────
  useEffect(() => {
    if (!canvasRef.current || !questions || !myUserId) return;

    const orderedParticipants = participants.length > 0 ? participants : [];
    const myParticipantIndex = orderedParticipants.findIndex((p) => p.user_id === myUserId);
    const myIndex = myParticipantIndex >= 0 ? myParticipantIndex : 0;

    const labels = orderedParticipants.map((p) =>
      playersRef.current[p.user_id]?.displayName ?? "…"
    );
    if (labels.length === 0) labels.push("You");

    const trackId = TRACKS.find((t) =>
      t.modules.some(() => true) // any track — we resolve from quizId at host level
    )?.id ?? "beginner";

    engineRef.current = new RunnerEngine(canvasRef.current, {
      totalQuestions: questions.length,
      playerCount: Math.max(2, orderedParticipants.length),
      myIndex,
      labels,
      spriteUrl: "/game/chipukizi.png",
      bgColorIndex: bgIndexForTrack(trackId),
      onGameEnd: () => {},
    });

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  // Questions and userId are the real deps; participants/players stabilise
  // quickly and we don't want to re-mount the engine on every Realtime tick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, myUserId]);

  // ── Update labels as player names load in ─────────────────────────────────
  // (Engine exposes no "setLabels" API — labels are drawn per-frame, so
  //  destroying and re-creating would cause a flash. Instead we pass a ref
  //  that the engine reads each draw. This is handled by the engine
  //  reading opts.labels, which we mutate below — no remount needed.)
  useEffect(() => {
    if (!engineRef.current) return;
    const labels = participants.map(
      (p) => playersRef.current[p.user_id]?.displayName ?? "…"
    );
    if (labels.length > 0) {
      engineRef.current.opts.labels = labels;
    }
  }, [players, participants]);

  // ── Answer submission ──────────────────────────────────────────────────────
  const q = questions?.[myIdx];

  async function answer(value: unknown) {
    if (!q || submitting || myFinished) return;
    setSubmitting(true);
    setAnswerError(null);

    try {
      const supabase = createClient();
      const result = await submitDuelAnswer(supabase, roomId, q.id, value);

      setFeedback(result.ok ? "hit" : "miss");

      // Fire visual effect on engine
      const myParticipantIndex = participants.findIndex((p) => p.user_id === myUserId);
      const myIdx_engine = myParticipantIndex >= 0 ? myParticipantIndex : 0;
      if (result.ok) {
        engineRef.current?.onCorrectAnswer(myIdx_engine);
      } else {
        engineRef.current?.onWrongAnswer(myIdx_engine);
      }

      setTimeout(() => {
        setFeedback(null);
        setAnswerValue("");
        setSubmitting(false);
        if (result.finished) {
          setMyFinished(true);
          setMyRank(result.rank ?? null);
          if (result.rank) engineRef.current?.setFinished(myIdx_engine, result.rank);
          // Advance duel quest only when the player wins (rank 1)
          if (result.rank === 1) {
            import("@/lib/store").then(({ useGameStore }) => {
              const store = useGameStore.getState();
              store.advanceQuest("duel").then(() => store.loadTodayQuests());
            }).catch(() => {});
          }
        } else {
          setMyIdx((i) => i + 1);
        }
      }, 480);
    } catch (err) {
      setSubmitting(false);
      setAnswerError(
        err instanceof Error ? err.message : "Couldn't submit — check connection."
      );
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
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
    <div className="max-w-2xl mx-auto flex flex-col gap-4">

      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-nuru-line shadow-pop relative">
        <canvas
          ref={canvasRef}
          width={RUNNER_CANVAS_W}
          height={RUNNER_CANVAS_H}
          className="w-full block"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Live badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-white tracking-wide">LIVE</span>
        </div>

        {/* Player lane labels overlay */}
        <div className="absolute top-2 left-3 flex flex-col gap-0" style={{ gap: `${RUNNER_CANVAS_H / participants.length - 24}px` }}>
          {participants.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: ["#6B4EFF", "#22C55E", "#F5B942", "#EF4444"][i % 4] }}
              />
              <span className="text-[10px] font-semibold text-white/80">
                {playersRef.current[p.user_id]?.displayName ?? "…"}
                {p.user_id === myUserId ? " (You)" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Question card or finished state ───────────────────────────── */}
      {myFinished ? (
        <div className="bg-nuru-card rounded-2xl p-6 shadow-card border border-nuru-line text-center">
          <div className="font-display font-bold text-lg text-nuru-ink mb-1">
            You finished{myRank ? ` — Rank #${myRank}` : ""}!
          </div>
          <p className="text-sm text-nuru-muted mb-4">
            {roomFinished ? "Everyone's done." : "Watching the rest of the race…"}
          </p>
          {roomFinished && (
            <button
              onClick={onFinished}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-nuru-purple text-white text-sm font-bold"
            >
              Final results <ChevronRight size={14} />
            </button>
          )}
        </div>
      ) : q ? (
        <div
          className={`bg-nuru-card rounded-2xl p-5 shadow-card border-2 transition-colors ${
            feedback === "hit"
              ? "border-nuru-green"
              : feedback === "miss"
                ? "border-nuru-rose"
                : "border-nuru-line"
          }`}
        >
          {/* Question header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] font-bold text-nuru-muted uppercase tracking-wide">
              Question {myIdx + 1} / {questions.length}
            </span>
            {/* Mini progress bar */}
            <div className="w-28 h-1.5 rounded-full bg-nuru-lav overflow-hidden">
              <div
                className="h-full rounded-full bg-nuru-purple transition-all duration-300"
                style={{ width: `${((myIdx) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="font-display font-bold text-[17px] text-nuru-ink mb-4 leading-snug">
            {q.question_text}
          </div>

          {/* Feedback flash */}
          {feedback && (
            <div
              className={`text-center py-2 mb-3 rounded-xl font-bold text-sm ${
                feedback === "hit" ? "bg-green-50 text-nuru-greenDeep" : "bg-red-50 text-nuru-rose"
              }`}
            >
              {feedback === "hit" ? "✓ Correct! Your runner jumps ahead!" : "✗ Not quite — keep going!"}
            </div>
          )}

          {answerError && (
            <div className="text-center py-2 mb-3 rounded-xl font-semibold text-sm bg-red-50 text-nuru-rose">
              {answerError}
            </div>
          )}

          {/* Answer options */}
          {!feedback && q.type === "mcq" && q.displayOptions && (
            <div className="grid grid-cols-1 gap-2">
              {q.displayOptions.map((opt) => (
                <button
                  key={opt.originalIndex}
                  onClick={() => answer(opt.originalIndex)}
                  disabled={submitting}
                  className="text-left px-4 py-3 rounded-xl text-sm font-medium bg-nuru-bg hover:bg-nuru-lav transition-colors disabled:opacity-50 border border-transparent hover:border-nuru-purple/30"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {!feedback && q.type === "tf" && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => answer(true)}
                disabled={submitting}
                className="py-3.5 rounded-xl font-bold text-[15px] bg-nuru-bg hover:bg-green-50 hover:text-nuru-greenDeep transition-colors disabled:opacity-50"
              >
                True
              </button>
              <button
                onClick={() => answer(false)}
                disabled={submitting}
                className="py-3.5 rounded-xl font-bold text-[15px] bg-nuru-bg hover:bg-red-50 hover:text-nuru-rose transition-colors disabled:opacity-50"
              >
                False
              </button>
            </div>
          )}

          {!feedback && q.type === "short" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                answer(answerValue);
              }}
            >
              <input
                autoFocus
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                placeholder="Type your answer and press enter"
                disabled={submitting}
                maxLength={200}
                className="w-full px-4 py-3 rounded-xl text-[15px] bg-nuru-bg border-2 border-transparent focus:border-nuru-purple text-nuru-ink disabled:opacity-50 outline-none"
              />
            </form>
          )}

          {submitting && (
            <div className="flex justify-center mt-3">
              <Loader2 size={16} className="animate-spin text-nuru-muted" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
