"use client";

import { useEffect, useState } from "react";
import { X, Swords, BookOpen, Clock, Target, Medal, Loader2 } from "lucide-react";
import { Nuru } from "./Nuru";
import { NuruMoodImg } from "./NuruMoodImg";
import { BattleTrial, type BattleResult } from "./BattleTrial";
import { createClient } from "@/lib/supabase/client";
import { getQuizIdForModule } from "@/lib/supabase/queries";
import { useT } from "@/lib/i18n";
import type { MissionQuiz } from "@/lib/types";

export function MissionQuestModal({
  quiz, moduleId, tone, weekLabel, onClose, onFinish,
}: {
  quiz: MissionQuiz;
  moduleId: string;
  tone: string;
  weekLabel: string;
  onClose: () => void;
  onFinish: (passed: boolean, pct: number) => void;
}) {
  const [stage, setStage] = useState<"intro" | "running" | "result">("intro");
  const [result, setResult] = useState<BattleResult | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    getQuizIdForModule(supabase, moduleId).then((id) => {
      if (cancelled) return;
      if (id) setQuizId(id);
      else setResolveError(true);
    });
    return () => { cancelled = true; };
  }, [moduleId]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm grid place-items-center p-5" onClick={onClose}>
      <div
        className="bg-nuru-card rounded-3xl w-full max-w-[640px] max-h-[92vh] overflow-y-auto shadow-2xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-white relative" style={{ background: `linear-gradient(135deg, ${tone}, #3E2A9E)` }}>
          <button onClick={onClose} className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-white/20 grid place-items-center">
            <X size={16} />
          </button>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-nuru-gold grid place-items-center">
              <Swords size={20} />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest uppercase opacity-85">
                {t("mq.mission")} · {weekLabel}
              </div>
              <div className="font-display font-bold text-xl mt-0.5">{quiz.title}</div>
              <div className="text-[13px] opacity-90 mt-0.5">{quiz.subtitle}</div>
            </div>
          </div>
        </div>

        {stage === "intro" && (
          <div className="p-6">
            <div className="flex gap-3.5 items-start mb-4">
              <Nuru size={56} />
              <div className="text-sm text-nuru-ink2 leading-relaxed">
                {t("mq.prove")}
                {quiz.placeholder && (
                  <div className="mt-1.5 text-xs text-nuru-muted italic">
                    Sample questions in the authored style — swap for the final quiz bank anytime.
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {([
                [BookOpen, t("mq.questions").replace("{n}", ""), quiz.questions.length],
                [Clock, t("mq.time").replace("{n}", ""), "12s"],
                [Target, t("mq.pass_at").replace("{n}", ""), `${quiz.passingPct}%`],
              ] as [typeof BookOpen, string, string | number][]).map(([Icon, l, v]) => (
                <div key={String(l)} className="p-3.5 rounded-xl bg-nuru-bg text-center">
                  <Icon size={18} className="mx-auto mb-1" style={{ color: tone }} />
                  <div className="text-[10px] font-bold tracking-wide text-nuru-muted uppercase">{l}</div>
                  <div className="font-display font-bold text-xl mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            {resolveError && (
              <div className="text-[13px] text-red-500 bg-red-50 p-3 rounded-xl mb-4">
                {t("mq.error")}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-nuru-line text-sm font-semibold">
                {t("mq.close")}
              </button>
              <button
                onClick={() => setStage("running")}
                disabled={!quizId}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60"
                style={{ background: tone }}
              >
                {!quizId && !resolveError ? <Loader2 size={15} className="animate-spin" /> : <Swords size={15} />}
                {t("mq.begin")}
              </button>
            </div>
          </div>
        )}

        {stage === "running" && quizId && (
          <BattleTrial
            quizId={quizId}
            tone={tone}
            onDone={(r) => { setResult(r); setStage("result"); }}
          />
        )}

        {stage === "result" && result && (
          <div className="p-6">
            <div className="text-center py-2.5 mb-3">
              {result.passed ? <NuruMoodImg mood="excited" size={92} /> : <NuruMoodImg mood="sad" size={92} />}
              <div className="font-display font-extrabold text-5xl mt-2.5" style={{ color: result.passed ? tone : "#EF4444" }}>
                {result.pct}%
              </div>
              <div className="text-sm text-nuru-muted font-medium">
                {result.correct} {t("general.of")} {result.total}
              </div>
              <div className={`inline-block mt-3 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                result.passed ? "bg-amber-50 text-nuru-goldDeep" : "bg-red-50 text-red-500"
              }`}>
                {result.passed ? t("mq.passed") : t("mq.failed")}
              </div>
            </div>
            {result.passed ? (
              <div className="bg-amber-50 rounded-xl p-3.5 mb-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-nuru-gold grid place-items-center shrink-0">
                  <Medal size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm text-nuru-goldDeep">{quiz.title}</div>
                  <div className="text-xs text-nuru-goldDeep/80">+500 XP · {t("mq.next_week")}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-nuru-ink2 text-center leading-relaxed mb-2">
                {t("mq.retry")} — {t("mq.failed")}.
              </p>
            )}
            <div className="flex justify-end gap-2.5 mt-5">
              {!result.passed && (
                <button
                  onClick={() => { setResult(null); setStage("intro"); }}
                  className="px-4 py-2.5 rounded-xl border border-nuru-line text-sm font-semibold"
                >
                  {t("mq.retry")}
                </button>
              )}
              <button
                onClick={() => onFinish(result.passed, result.pct)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: result.passed ? tone : "#6B4EFF" }}
              >
                {result.passed ? t("mq.next_week") : t("mq.close")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
