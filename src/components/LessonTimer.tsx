"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

interface LessonTimerProps {
  durationMinutes: number;
  onExpire?: () => void;
  mode?: "countdown" | "countup";
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(Math.abs(totalSeconds) / 60);
  const s = Math.abs(totalSeconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const CIRCUMFERENCE = 2 * Math.PI * 54; // radius = 54

export function LessonTimer({
  durationMinutes,
  onExpire,
  mode = "countdown",
}: LessonTimerProps) {
  const t = useT();
  const totalSeconds = durationMinutes * 60;

  const [elapsed, setElapsed] = useState(0); // single source of truth; always counts up
  const [running, setRunning] = useState(true);
  const [expired, setExpired] = useState(false);
  const expiredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const remaining = totalSeconds - elapsed;
  const displaySeconds = mode === "countdown" ? Math.max(remaining, 0) : elapsed;

  const progress =
    mode === "countdown"
      ? Math.max(remaining, 0) / totalSeconds
      : Math.min(elapsed / totalSeconds, 1);

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const underFive = mode === "countdown" && remaining <= 300 && remaining > 60;
  const underOne = mode === "countdown" && remaining <= 60 && !expired;

  let ringColor = "stroke-nuru-purple";
  let textColor = "text-nuru-ink dark:text-white";
  if (underOne) {
    ringColor = "stroke-nuru-rose";
    textColor = "text-nuru-rose";
  } else if (underFive) {
    ringColor = "stroke-nuru-gold";
    textColor = "text-nuru-gold";
  }

  const tick = useCallback(() => {
    setElapsed((prev) => {
      const next = prev + 1;
      if (mode === "countdown" && next >= totalSeconds && !expiredRef.current) {
        expiredRef.current = true;
        setExpired(true);
        setRunning(false);
        onExpire?.();
      }
      return next;
    });
  }, [mode, totalSeconds, onExpire]);

  useEffect(() => {
    if (running && !expired) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, expired, tick]);

  const handlePauseResume = () => {
    if (expired) return;
    setRunning((r) => !r);
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    expiredRef.current = false;
    setElapsed(0);
    setExpired(false);
    setRunning(true);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-white dark:bg-nuru-ink shadow-pop w-fit">
      {/* SVG progress ring */}
      <div className="relative w-32 h-32">
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full -rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="8"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            className={`${ringColor} transition-all duration-1000 ease-linear`}
          />
        </svg>

        {/* Time display, centered over the ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          {expired ? (
            <span
              className="text-sm font-display font-bold text-nuru-rose text-center leading-tight px-1"
              aria-live="assertive"
            >
              {t("timer.time_up")}
            </span>
          ) : (
            <span
              className={`font-display text-2xl font-bold tabular-nums ${textColor} ${
                underOne ? "animate-pop" : ""
              }`}
              aria-live="off"
              aria-label={formatTime(displaySeconds)}
            >
              {formatTime(displaySeconds)}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePauseResume}
          disabled={expired}
          aria-label={running ? t("timer.pause") : t("timer.resume")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
            bg-nuru-purple text-white hover:bg-nuru-purple/90 active:scale-95
            disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {running ? (
            <Pause className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4" aria-hidden="true" />
          )}
          {running ? t("timer.pause") : t("timer.resume")}
        </button>

        <button
          type="button"
          onClick={handleReset}
          aria-label={t("timer.reset")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
            bg-gray-100 dark:bg-gray-800 text-nuru-ink dark:text-white
            hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {t("timer.reset")}
        </button>
      </div>
    </div>
  );
}

// ADD TO i18n_additions.ts
// ─────────────────────────────────────────────────────────────────────────────
// "timer.pause": {
//   en: "Pause",
//   sw: "Simamisha",
//   fr: "Pause",
//   am: "አቁም",
//   ha: "Tsaya",
//   yo: "Dúró",
//   zu: "Misa",
// },
// "timer.resume": {
//   en: "Resume",
//   sw: "Endelea",
//   fr: "Reprendre",
//   am: "ቀጥል",
//   ha: "Ci gaba",
//   yo: "Tẹ̀síwájú",
//   zu: "Qhubeka",
// },
// "timer.reset": {
//   en: "Reset",
//   sw: "Anza upya",
//   fr: "Réinitialiser",
//   am: "ዳግም አስጀምር",
//   ha: "Sake saita",
//   yo: "Tún ṣe",
//   zu: "Qala kabusha",
// },
// "timer.time_up": {
//   en: "Time's up",
//   sw: "Muda umekwisha",
//   fr: "Temps écoulé",
//   am: "ጊዜው አልቋል",
//   ha: "Lokaci ya ƙare",
//   yo: "Àkókò ti parí",
//   zu: "Isikhathi siphelile",
// },
