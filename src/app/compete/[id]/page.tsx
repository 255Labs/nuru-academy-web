"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, Trophy, CheckCircle, XCircle, Clock, Users,
  ChevronLeft, Zap, Monitor, Phone, Timer,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Competition {
  id: string;
  title: string;
  description: string;
  track_id: string;
  quiz_id: string;
  starts_at: string;
  ends_at: string;
  prize_desc: string | null;
  status: string;
}

interface Question {
  id: string;
  question_text: string;
  type: "mcq" | "tf" | "short";
  options: string[] | null;
  sort_position: number;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  phone_number: string;
  score: number;
  answers_given: number;
  completed: boolean;
  entry_source: "web" | "ussd";
  time_taken_secs: number | null;
}

type Phase = "loading" | "ready" | "playing" | "finished" | "error";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompetePlayerPage() {
  const { id: competitionId } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();

  const [phase, setPhase] = useState<Phase>("loading");
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [lastResult, setLastResult] = useState<{ correct: boolean; answer: string } | null>(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [questionStarted, setQuestionStarted] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Start competition ──────────────────────────────────────────────────────
  const startCompetition = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/compete/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competition_id: competitionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");

      setCompetition(data.competition);
      setQuestions((data.questions ?? []).sort(
        (a: Question, b: Question) => a.sort_position - b.sort_position
      ));
      setEntryId(data.entry_id);
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [competitionId]);

  useEffect(() => { startCompetition(); }, [startCompetition]);

  // ── Load leaderboard + subscribe Realtime ──────────────────────────────────
  useEffect(() => {
    if (!competitionId) return;
    const supabase = createClient();

    async function fetchLeaderboard() {
      const { data } = await supabase.rpc("competition_leaderboard", {
        p_competition_id: competitionId,
      });
      setLeaderboard((data ?? []) as LeaderboardEntry[]);
    }

    fetchLeaderboard();

    // Live leaderboard — ussd_entries has Realtime enabled in the schema
    const channel = supabase
      .channel(`competition-${competitionId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ussd_entries",
        filter: `competition_id=eq.${competitionId}`,
      }, () => fetchLeaderboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [competitionId]);

  // ── Question timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    setQuestionStarted(Date.now());
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - questionStarted) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, currentIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Total time timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "playing") {
      totalTimerRef.current = setInterval(() => setTotalTime((t) => t + 1), 1000);
    } else {
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    }
    return () => { if (totalTimerRef.current) clearInterval(totalTimerRef.current); };
  }, [phase]);

  // ── Submit answer ──────────────────────────────────────────────────────────
  async function submitAnswer(answer: string) {
    if (submitting || !entryId) return;
    const q = questions[currentIdx];
    if (!q) return;

    setSubmitting(true);
    const timeSecs = Math.floor((Date.now() - questionStarted) / 1000);

    try {
      const res = await fetch("/api/compete/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: entryId,
          question_id: q.id,
          question_index: currentIdx,
          answer,
          time_secs: timeSecs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed");

      setLastResult({ correct: data.correct, answer });
      setScore(data.new_score);
      setShortAnswer("");

      // Show result briefly then advance
      setTimeout(() => {
        setLastResult(null);
        if (data.is_last) {
          setPhase("finished");
        } else {
          setCurrentIdx((i) => i + 1);
        }
        setSubmitting(false);
      }, 1200);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const q = questions[currentIdx];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push("/compete")}
          className="flex items-center gap-1 text-nuru-muted hover:text-nuru-ink text-sm transition-colors"
        >
          <ChevronLeft size={16} /> {t("compete.title")}
        </button>
      </div>

      <TopBar
        title={competition?.title ?? "Competition"}
        subtitle={competition?.description ?? ""}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ── Left: game area ───────────────────────────────────────────────── */}
        <div>
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 size={28} className="animate-spin text-nuru-purple" />
              <p className="text-nuru-muted text-sm mb-6">{t("general.loading")}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <p className="text-red-700 font-semibold mb-3">{error}</p>
              <button
                onClick={() => router.push("/compete")}
                className="px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl"
              >
                Back to Competitions
              </button>
            </div>
          )}

          {phase === "ready" && (
            <div className="bg-nuru-card rounded-2xl p-8 shadow-card border border-nuru-line text-center">
              <div className="w-16 h-16 rounded-2xl bg-nuru-lav grid place-items-center mx-auto mb-4">
                <Zap size={28} className="text-nuru-purple" />
              </div>
              <h2 className="font-display font-extrabold text-2xl text-nuru-ink mb-2">
                {competition?.title}
              </h2>
              <p className="text-nuru-muted text-sm mb-1">{competition?.description}</p>
              {competition?.prize_desc && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                  <Trophy size={13} className="text-amber-600" />
                  <span className="text-amber-700 text-xs font-bold">{competition.prize_desc}</span>
                </div>
              )}
              <div className="flex justify-center gap-4 mt-4 mb-6 text-xs text-nuru-muted">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {questions.length} questions
                </span>
                <span className="capitalize flex items-center gap-1">
                  <Zap size={12} /> {competition?.track_id} track
                </span>
              </div>
              <button
                onClick={() => {
                  setPhase("playing");
                  setCurrentIdx(0);
                  setScore(0);
                  setTotalTime(0);
                }}
                className="px-8 py-3.5 bg-nuru-purple text-white font-bold rounded-2xl hover:bg-nuru-purpleDeep transition-colors text-base"
              >
                Start Competition →
              </button>
            </div>
          )}

          {phase === "playing" && q && (
            <div className="bg-nuru-card rounded-2xl shadow-card border border-nuru-line overflow-hidden">
              {/* Progress bar */}
              <div className="h-1.5 bg-nuru-lav">
                <div
                  className="h-full bg-nuru-purple transition-all duration-300"
                  style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
                />
              </div>

              <div className="p-6">
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold text-nuru-muted uppercase tracking-wide">
                    Question {currentIdx + 1} of {questions.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-nuru-muted">
                      <Clock size={11} /> {formatTime(elapsed)}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold text-nuru-purple">
                      <Trophy size={11} /> {score} pts
                    </span>
                  </div>
                </div>

                {/* Question */}
                <p className="text-[17px] font-semibold text-nuru-ink leading-snug mb-6">
                  {q.question_text}
                </p>

                {/* Result overlay */}
                {lastResult && (
                  <div className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 ${
                    lastResult.correct
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}>
                    {lastResult.correct
                      ? <CheckCircle size={18} className="text-green-600" />
                      : <XCircle size={18} className="text-red-500" />}
                    <span className={`font-semibold text-sm ${
                      lastResult.correct ? "text-green-700" : "text-red-600"
                    }`}>
                      {lastResult.correct ? "Correct! +1 point" : "Not quite"}
                    </span>
                  </div>
                )}

                {/* MCQ options */}
                {q.type === "mcq" && q.options && !lastResult && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {q.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => submitAnswer(String(i))}
                        disabled={submitting}
                        className="text-left px-4 py-3.5 rounded-xl border-2 border-nuru-line bg-nuru-bg hover:border-nuru-purple hover:bg-nuru-lav/30 transition-all font-medium text-nuru-ink text-sm disabled:opacity-50"
                      >
                        <span className="font-bold text-nuru-purple mr-2">{["A","B","C","D"][i]}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* True/False */}
                {q.type === "tf" && !lastResult && (
                  <div className="grid grid-cols-2 gap-3">
                    {[["true", "True ✓"], ["false", "False ✗"]].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => submitAnswer(val)}
                        disabled={submitting}
                        className="py-4 rounded-xl border-2 border-nuru-line bg-nuru-bg hover:border-nuru-purple hover:bg-nuru-lav/30 transition-all font-bold text-nuru-ink disabled:opacity-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Short answer */}
                {q.type === "short" && !lastResult && (
                  <form onSubmit={(e) => { e.preventDefault(); submitAnswer(shortAnswer); }}>
                    <input
                      value={shortAnswer}
                      onChange={(e) => setShortAnswer(e.target.value)}
                      placeholder="Type your answer…"
                      maxLength={200}
                      disabled={submitting}
                      className="w-full px-4 py-3 rounded-xl border-2 border-nuru-line focus:border-nuru-purple bg-nuru-bg text-nuru-ink text-sm outline-none disabled:opacity-50 mb-3"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={submitting || !shortAnswer.trim()}
                      className="w-full py-3 rounded-xl bg-nuru-purple text-white font-bold text-sm disabled:opacity-50"
                    >
                      {submitting ? "Checking…" : "Submit Answer →"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {phase === "finished" && (
            <div className="bg-nuru-card rounded-2xl p-8 shadow-card border border-nuru-line text-center">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="font-display font-extrabold text-2xl text-nuru-ink mb-1">
                Competition Complete!
              </h2>
              <p className="text-nuru-muted text-sm mb-6">You answered all {questions.length} questions.</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Score", value: `${score}/${questions.length}` },
                  { label: "Accuracy", value: `${questions.length ? Math.round((score / questions.length) * 100) : 0}%` },
                  { label: "Time", value: formatTime(totalTime) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-nuru-lav rounded-xl py-3">
                    <div className="font-display font-bold text-xl text-nuru-ink">{value}</div>
                    <div className="text-[11px] text-nuru-muted mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push("/compete")}
                className="px-6 py-3 bg-nuru-purple text-white font-bold rounded-xl"
              >
                Back to Competitions
              </button>
            </div>
          )}
        </div>

        {/* ── Right: live leaderboard ────────────────────────────────────────── */}
        <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line h-fit">
          <h3 className="font-bold text-nuru-ink text-sm mb-3 flex items-center gap-2">
            <Trophy size={14} className="text-amber-500" />
            Live Leaderboard
            <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {t("compete.live")}
            </span>
          </h3>

          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-nuru-muted text-xs">
              {t("compete.no_entries")}
            </div>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.slice(0, 15).map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${
                    entry.rank <= 3 ? "bg-nuru-lav" : "bg-nuru-bg"
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    entry.rank === 1 ? "bg-yellow-400 text-white"
                    : entry.rank === 2 ? "bg-gray-300 text-gray-700"
                    : entry.rank === 3 ? "bg-amber-600 text-white"
                    : "bg-nuru-line text-nuru-muted"
                  }`}>
                    {entry.rank}
                  </div>

                  {/* Name + source */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-nuru-ink truncate">
                      {entry.display_name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {entry.entry_source === "web"
                        ? <Monitor size={9} className="text-nuru-purple" />
                        : <Phone size={9} className="text-nuru-muted" />}
                      <span className="text-[9px] text-nuru-muted">
                        {entry.entry_source === "web" ? "Web" : "USSD"}
                      </span>
                      {entry.completed && entry.time_taken_secs && (
                        <span className="text-[9px] text-nuru-muted flex items-center gap-0.5 ml-1">
                          <Timer size={8} /> {formatTime(entry.time_taken_secs)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-nuru-ink">{entry.score}</div>
                    <div className="text-[9px] text-nuru-muted">{entry.answers_given} ans</div>
                  </div>

                  {/* Completed badge */}
                  {entry.completed && (
                    <CheckCircle size={12} className="text-green-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-[9px] text-nuru-muted text-center mt-3">
            {t("compete.updates")} · Web &amp; USSD
          </p>
        </div>
      </div>
    </Shell>
  );
}
