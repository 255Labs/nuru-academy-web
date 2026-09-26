"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Check, Clock, ArrowRight, ArrowLeft, PlayCircle, Sparkles, Trophy } from "lucide-react";
import type { Lesson, LessonBlock } from "@/lib/types";

type CheckData = { options: { label: string; originalIndex: number }[]; correctIndex: number };

type Step =
  | { kind: "intro" }
  | { kind: "content"; block: LessonBlock; label: string }
  | { kind: "check"; block: LessonBlock; label: string; check: CheckData }
  | { kind: "recap" }
  | { kind: "complete" };

const CHECK_SECONDS = 45;

function shuffle<T>(a: T[]): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function buildCheck(block: LessonBlock) {
  const options = shuffle(block.points.map((label, originalIndex) => ({ label, originalIndex })));
  const correctIndex = options.findIndex((o) => o.originalIndex === 0);
  return { options, correctIndex };
}

export function LevelPlayer({
  lesson, tone, trackLabel, moduleLabel, done, onClose, onComplete, inline = false,
}: {
  lesson: Lesson;
  tone: string;
  trackLabel: string;
  moduleLabel: string;
  done?: boolean;
  onClose: () => void;
  onComplete: (elapsedMinutes: number) => void;
  inline?: boolean;
}) {
  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [{ kind: "intro" }];
    s.push({ kind: "content", block: lesson.block1, label: "Block 1" });
    s.push({ kind: "check",   block: lesson.block1, label: "Block 1", check: buildCheck(lesson.block1) });
    s.push({ kind: "content", block: lesson.block2, label: "Block 2" });
    s.push({ kind: "check",   block: lesson.block2, label: "Block 2", check: buildCheck(lesson.block2) });
    if (lesson.demo || lesson.homework) s.push({ kind: "recap" });
    s.push({ kind: "complete" });
    return s;
  }, [lesson]);

  const [i, setI]               = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow]             = useState(Date.now());
  const [answers, setAnswers]     = useState<Record<number, number | "timeout">>({});
  const [checkEndAt, setCheckEndAt] = useState<number | null>(null);

  const step       = steps[i];
  const alreadyDone = !!done;

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (step.kind !== "check") return;
    if (answers[i] !== undefined) return;
    setCheckEndAt(Date.now() + CHECK_SECONDS * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, step.kind]);

  useEffect(() => {
    if (step.kind !== "check" || checkEndAt === null || answers[i] !== undefined) return;
    if (now >= checkEndAt) setAnswers((a) => ({ ...a, [i]: "timeout" }));
  }, [now, checkEndAt, step.kind, i, answers]);

  const elapsedSec = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);
  const elapsedMM  = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const elapsedSS  = String(elapsedSec % 60).padStart(2, "0");
  const checkRemain  = checkEndAt !== null ? Math.max(0, checkEndAt - now) : 0;
  const checkMM      = String(Math.floor(checkRemain / 60000)).padStart(2, "0");
  const checkSS      = String(Math.floor((checkRemain % 60000) / 1000)).padStart(2, "0");
  const checkDanger  = checkRemain < 10000;

  function begin()    { setStartedAt(Date.now()); setI(1); }
  function answerCheck(idx: number) { if (answers[i] !== undefined) return; setAnswers((a) => ({ ...a, [i]: idx })); }
  function next()     { if (i < steps.length - 1) setI(i + 1); }
  function back()     { if (steps[i - 1]?.kind === "check") return; setI((v) => Math.max(0, v - 1)); }
  function finish()   { onComplete(Math.max(1, Math.round(elapsedSec / 60) || 1)); }

  const canGoNext = step.kind !== "check" || answers[i] !== undefined;

  // ── Body content (shared between inline and modal) ──────────────────────────
  function renderBody() {
    return (
      <>
        {step.kind === "intro" && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-2xl grid place-items-center mb-4" style={{ background: `${tone}18` }}>
              <PlayCircle size={28} style={{ color: tone }} />
            </div>
            <div className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase mb-2">Today&apos;s objective</div>
            <p className="text-lg text-nuru-ink font-medium leading-relaxed max-w-md">{lesson.objective}</p>
            <div className="grid grid-cols-3 gap-2.5 mt-6 w-full max-w-sm">
              <MiniStat label="Blocks" value="2" tone={tone} />
              <MiniStat label="Quick checks" value="2" tone={tone} />
              <MiniStat label="Reward" value="+100 XP" tone={tone} />
            </div>
            <button onClick={begin} className="mt-7 flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold" style={{ background: tone }}>
              Begin lesson <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step.kind === "content" && (
          <div>
            <Eyebrow tone={tone}>{step.label}</Eyebrow>
            <h3 className="font-display font-bold text-xl text-nuru-ink mt-1 mb-4">{step.block.topic}</h3>
            <div className="flex flex-col gap-2.5">
              {step.block.points.map((p, k) => (
                <div key={k} className="flex items-start gap-3 p-3.5 rounded-xl bg-nuru-bg">
                  <span className="w-6 h-6 rounded-full grid place-items-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: k === 0 ? tone : "#B9B4C9" }}>
                    {k + 1}
                  </span>
                  <p className="text-sm text-nuru-ink2 leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step.kind === "check" && (
          <CheckStep
            stepLabel={step.label} tone={tone} check={step.check}
            answer={answers[i]} danger={checkDanger} mm={checkMM} ss={checkSS}
            showTimer={answers[i] === undefined} onAnswer={answerCheck}
          />
        )}

        {step.kind === "recap" && (
          <div className="flex flex-col gap-3">
            {lesson.demo && (
              <div className="p-4 rounded-xl bg-amber-50 border-l-4 border-nuru-gold">
                <Eyebrow tone="#B98A2E">Live demo</Eyebrow>
                <p className="text-sm text-nuru-ink2 mt-1.5 leading-relaxed">{lesson.demo}</p>
              </div>
            )}
            {lesson.homework && (
              <div className="p-4 rounded-xl bg-green-50 border-l-4 border-nuru-green">
                <Eyebrow tone="#1F8A4C">Homework</Eyebrow>
                <p className="text-sm text-nuru-ink2 mt-1.5 leading-relaxed">{lesson.homework}</p>
              </div>
            )}
          </div>
        )}

        {step.kind === "complete" && (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 rounded-2xl grid place-items-center mb-4" style={{ background: `${tone}18` }}>
              <Trophy size={30} style={{ color: tone }} />
            </div>
            <h3 className="font-display font-bold text-2xl text-nuru-ink">Level complete</h3>
            <p className="text-sm text-nuru-muted mt-2 max-w-sm leading-relaxed">
              {elapsedMM}:{elapsedSS} spent on this lesson. That&apos;s logged to your study streak.
            </p>
            <div className="flex items-center gap-2 mt-5 px-4 py-2 rounded-full bg-nuru-lav text-nuru-purpleDeep font-bold text-sm">
              <Sparkles size={15} /> +100 XP · +50 coins
            </div>
            <button onClick={finish} className="mt-6 flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold" style={{ background: tone }}>
              <Check size={16} /> Claim reward
            </button>
          </div>
        )}
      </>
    );
  }

  // ── Nav footer (shared) ─────────────────────────────────────────────────────
  function renderNav(px = "px-6") {
    if (step.kind === "intro" || step.kind === "complete") return null;
    return (
      <div className={`flex justify-between items-center gap-2.5 ${px} py-4 border-t border-nuru-line`}>
        <button onClick={back} disabled={steps[i - 1]?.kind === "check"}
          className="px-4 py-2.5 rounded-xl border border-nuru-line text-sm font-semibold text-nuru-ink disabled:opacity-30 flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back
        </button>
        <button onClick={next} disabled={!canGoNext}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center gap-1.5"
          style={{ background: tone }}>
          {step.kind === "check" && answers[i] === undefined ? "Answer to continue" : "Continue"}
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  // ── Inline mode — renders inside the parent modal ───────────────────────────
  if (inline) {
    return (
      <div className="flex flex-col">
        {/* Inline progress bar */}
        <div className="h-1 bg-nuru-lav rounded-full mb-5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(i / (steps.length - 1)) * 100}%`, background: tone }} />
        </div>
        {/* Elapsed timer */}
        {startedAt !== null && step.kind !== "complete" && (
          <div className="flex items-center gap-1 text-[11px] text-nuru-muted mb-3">
            <Clock size={11} /> {elapsedMM}:{elapsedSS} elapsed
          </div>
        )}
        <div className="flex-1">{renderBody()}</div>
        {renderNav("px-0")}
      </div>
    );
  }

  // ── Modal mode — the original fixed overlay ─────────────────────────────────
  return (
    <div className="fixed inset-0 z-[80] bg-nuru-ink/60 backdrop-blur-sm grid place-items-center p-5" onClick={onClose}>
      <div className="bg-nuru-card rounded-3xl w-full max-w-[760px] max-h-[92vh] overflow-y-auto shadow-2xl animate-pop flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-6 text-white relative shrink-0" style={{ background: `linear-gradient(135deg, ${tone}, #241033)` }}>
          <button onClick={onClose} className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-white/15 grid place-items-center hover:bg-white/25 transition-colors">
            <X size={16} />
          </button>
          <div className="text-[11px] font-bold tracking-widest uppercase opacity-80">{trackLabel} · {moduleLabel} · Day {lesson.day}</div>
          <div className="font-display font-bold text-2xl mt-1 leading-tight pr-8">{lesson.title}</div>
          {startedAt !== null && step.kind !== "complete" && (
            <div className="flex items-center gap-1.5 mt-2 text-[12.5px] font-semibold opacity-90">
              <Clock size={13} /> {elapsedMM}:{elapsedSS} elapsed
            </div>
          )}
          {alreadyDone && (
            <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 tracking-wide uppercase">
              Previously completed
            </div>
          )}
        </div>
        <div className="h-1.5 bg-nuru-lav shrink-0">
          <div className="h-full transition-all duration-500" style={{ width: `${(i / (steps.length - 1)) * 100}%`, background: tone }} />
        </div>
        <div className="p-6 flex-1">{renderBody()}</div>
        {renderNav()}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Eyebrow({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <div className="text-[11px] font-bold tracking-wide uppercase" style={{ color: tone }}>{children}</div>;
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-nuru-bg text-center">
      <div className="font-display font-bold text-base" style={{ color: tone }}>{value}</div>
      <div className="text-[10px] text-nuru-muted font-semibold uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function CheckStep({
  stepLabel, tone, check, answer, danger, mm, ss, showTimer, onAnswer,
}: {
  stepLabel: string; tone: string;
  check: { options: { label: string; originalIndex: number }[]; correctIndex: number };
  answer: number | "timeout" | undefined;
  danger: boolean; mm: string; ss: string; showTimer: boolean;
  onAnswer: (i: number) => void;
}) {
  const answered = answer !== undefined;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Eyebrow tone={tone}>Quick check · {stepLabel}</Eyebrow>
        {showTimer && (
          <span className={`flex items-center gap-1 text-xs font-bold ${danger ? "text-nuru-rose" : "text-nuru-muted"}`}>
            <Clock size={12} /> {mm}:{ss}
          </span>
        )}
      </div>
      <h3 className="font-bold text-lg text-nuru-ink mb-4 leading-snug">
        Which of these was the big idea of {stepLabel}?
      </h3>
      <div className="flex flex-col gap-2">
        {check.options.map((opt, k) => {
          const isCorrect = k === check.correctIndex;
          const isPicked  = answer === k;
          let style = "bg-nuru-bg text-nuru-ink border-transparent hover:border-nuru-purple/25";
          if (answered) {
            if (isCorrect) style = "bg-green-50 text-nuru-greenDeep border-nuru-green";
            else if (isPicked) style = "bg-red-50 text-nuru-rose border-nuru-rose";
            else style = "bg-nuru-bg text-nuru-muted border-transparent opacity-60";
          }
          return (
            <button key={k} onClick={() => onAnswer(k)} disabled={answered}
              className={`text-left px-4 py-3 rounded-xl text-sm font-medium border-2 transition-colors ${style}`}>
              {opt.label}
            </button>
          );
        })}
      </div>
      {answer === "timeout" && (
        <p className="text-xs text-nuru-muted mt-3 italic">Time&apos;s up — the big idea is highlighted above. Continue when ready.</p>
      )}
    </div>
  );
}
