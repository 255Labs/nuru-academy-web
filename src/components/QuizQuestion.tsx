"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  options: Option[];
  correctId: string;
  explanation?: string;
}

interface QuizQuestionProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (optionId: string, correct: boolean) => void;
  showExplanation?: boolean;
  disabled?: boolean;
}

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

type OptionState = "idle" | "correct" | "wrong";

export function QuizQuestion({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  showExplanation = true,
  disabled = false,
}: QuizQuestionProps) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  const handleSelect = (optionId: string) => {
    if (answered || disabled) return;
    setSelected(optionId);
    onAnswer(optionId, optionId === question.correctId);
  };

  const getOptionState = (optionId: string): OptionState => {
    if (!answered) return "idle";
    if (optionId === question.correctId) return "correct";
    if (optionId === selected) return "wrong";
    return "idle";
  };

  const stateClasses: Record<OptionState, string> = {
    idle: "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-nuru-purple/60 hover:bg-nuru-purple/5",
    correct:
      "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    wrong:
      "border-nuru-rose bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  };

  const labelStateClasses: Record<OptionState, string> = {
    idle: "bg-gray-100 dark:bg-gray-800 text-nuru-ink dark:text-gray-300",
    correct: "bg-green-500 text-white",
    wrong: "bg-nuru-rose text-white",
  };

  // Progress fills up to (but not including) the current question
  const progressPct = ((questionNumber - 1) / totalQuestions) * 100;

  // Interpolate the "Question X of Y" string with {{current}} / {{total}} tokens
  const progressLabel = t("quiz.question_of")
    .replace("{{current}}", String(questionNumber))
    .replace("{{total}}", String(totalQuestions));

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl">
      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {progressLabel}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {questionNumber}&thinsp;/&thinsp;{totalQuestions}
          </span>
        </div>
        <div
          className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
          role="progressbar"
          aria-valuenow={questionNumber}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-label={progressLabel}
        >
          <div
            className="h-full rounded-full bg-nuru-purple transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question text */}
      <p className="text-base font-display font-semibold text-nuru-ink dark:text-white leading-snug">
        {question.text}
      </p>

      {/* Options list */}
      <ol className="flex flex-col gap-3">
        {question.options.map((option, idx) => {
          const state = getOptionState(option.id);
          const label = OPTION_LABELS[idx] ?? String(idx + 1);
          const isSelected = selected === option.id;

          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => handleSelect(option.id)}
                disabled={answered || disabled}
                aria-pressed={isSelected}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left
                  font-medium text-sm transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuru-purple focus-visible:ring-offset-2
                  disabled:cursor-not-allowed
                  ${stateClasses[state]}`}
              >
                {/* Letter badge */}
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                    text-xs font-bold transition-colors duration-200
                    ${labelStateClasses[state]}`}
                  aria-hidden="true"
                >
                  {label}
                </span>

                {/* Option text */}
                <span className="flex-1">{option.text}</span>

                {/* State icon — screen-reader text embedded alongside */}
                {state === "correct" && (
                  <>
                    <CheckCircle2
                      className="w-5 h-5 text-green-500 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="sr-only">{t("quiz.correct")}</span>
                  </>
                )}
                {state === "wrong" && (
                  <>
                    <XCircle
                      className="w-5 h-5 text-nuru-rose flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="sr-only">{t("quiz.incorrect")}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Inline feedback summary */}
      {answered && (
        <p
          className={`text-sm font-semibold ${
            selected === question.correctId
              ? "text-green-600 dark:text-green-400"
              : "text-nuru-rose"
          }`}
          role="status"
          aria-live="polite"
        >
          {selected === question.correctId
            ? t("quiz.correct")
            : t("quiz.incorrect")}
        </p>
      )}

      {/* Explanation card */}
      {answered && showExplanation && question.explanation && (
        <div
          className="flex gap-3 p-4 rounded-xl bg-nuru-gold/10 border border-nuru-gold/30"
          role="note"
        >
          <Lightbulb
            className="w-5 h-5 text-nuru-gold flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-nuru-gold uppercase tracking-wide">
              {t("quiz.explanation")}
            </span>
            <p className="text-sm text-nuru-ink dark:text-gray-200 leading-relaxed">
              {question.explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ADD TO i18n_additions.ts
// ─────────────────────────────────────────────────────────────────────────────
// "quiz.question_of": {
//   en: "Question {{current}} of {{total}}",
//   sw: "Swali la {{current}} kati ya {{total}}",
//   fr: "Question {{current}} sur {{total}}",
//   am: "ጥያቄ {{current}} ከ {{total}}",
//   ha: "Tambaya ta {{current}} daga {{total}}",
//   yo: "Ìbéèrè {{current}} nínú {{total}}",
//   zu: "Umbuzo {{current}} ku {{total}}",
// },
// "quiz.correct": {
//   en: "Correct",
//   sw: "Sahihi",
//   fr: "Correct",
//   am: "ትክክል",
//   ha: "Daidai",
//   yo: "Tọ́",
//   zu: "Kulungile",
// },
// "quiz.incorrect": {
//   en: "Incorrect",
//   sw: "Makosa",
//   fr: "Incorrect",
//   am: "ስህተት",
//   ha: "Kuskure",
//   yo: "Àìtọ́",
//   zu: "Akunjalo",
// },
// "quiz.explanation": {
//   en: "Explanation",
//   sw: "Maelezo",
//   fr: "Explication",
//   am: "ማብራሪያ",
//   ha: "Bayani",
//   yo: "Àlàyé",
//   zu: "Incazelo",
// },
