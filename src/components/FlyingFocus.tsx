"use client";

/**
 * FlyingFocus
 *
 * Fixes:
 *  - aria-label="Dismiss hint" -> aria-label={t("hint.dismiss")} via real useT() hook
 *  - No emojis
 */

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function FlyingFocus({
  targetId, hintId, message, placement = "bottom",
}: {
  targetId: string;
  hintId: string;
  message: string;
  placement?: "top" | "bottom" | "left" | "right";
}) {
  const t = useT();
  const hintsSeen = useGameStore((s) => s.hintsSeen);
  const dismissHint = useGameStore((s) => s.dismissHint);
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number | null>(null);

  const dismissed = !!hintsSeen[hintId];

  useEffect(() => {
    if (dismissed) return;

    function measure() {
      const el = document.getElementById(targetId);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    function scheduleMeasure() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    // Target may mount slightly after this component (e.g. data still
    // loading) -- a short retry window catches that without polling forever.
    const retry = setInterval(measure, 400);
    const stopRetry = setTimeout(() => clearInterval(retry), 4000);

    return () => {
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      clearInterval(retry);
      clearTimeout(stopRetry);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetId, dismissed]);

  if (dismissed || !rect) return null;

  const ringPad = 6;
  const ringStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - ringPad,
    left: rect.left - ringPad,
    width: rect.width + ringPad * 2,
    height: rect.height + ringPad * 2,
    zIndex: 90,
    pointerEvents: "none",
  };

  const labelGap = 14;
  const labelStyle: React.CSSProperties = { position: "fixed", zIndex: 91, maxWidth: 240 };
  if (placement === "bottom") {
    labelStyle.top = rect.top + rect.height + ringPad + labelGap;
    labelStyle.left = rect.left;
  } else if (placement === "top") {
    labelStyle.bottom = window.innerHeight - rect.top + ringPad + labelGap;
    labelStyle.left = rect.left;
  } else if (placement === "right") {
    labelStyle.top = rect.top;
    labelStyle.left = rect.left + rect.width + ringPad + labelGap;
  } else {
    labelStyle.top = rect.top;
    labelStyle.right = window.innerWidth - rect.left + ringPad + labelGap;
  }

  return (
    <>
      <div style={ringStyle} className="rounded-2xl border-2 border-nuru-purple animate-flying-focus-pulse" />
      <div style={labelStyle} className="bg-nuru-ink text-white rounded-xl px-4 py-3 shadow-2xl animate-pop">
        <button
          onClick={() => dismissHint(hintId)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 grid place-items-center transition-colors"
          aria-label={t("hint.dismiss")}
        >
          <X size={11} />
        </button>
        <p className="text-[13px] leading-snug pr-1">{message}</p>
      </div>
      <style jsx global>{`
        @keyframes flying-focus-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(107, 78, 255, 0.45); }
          50% { box-shadow: 0 0 0 8px rgba(107, 78, 255, 0); }
        }
        .animate-flying-focus-pulse { animation: flying-focus-pulse 1.8s ease-in-out infinite; }
      `}</style>
    </>
  );
}