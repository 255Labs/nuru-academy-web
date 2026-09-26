"use client";

import { Check, Lock, Swords } from "lucide-react";
import { Nuru } from "./Nuru";
import type { JourneyNode } from "@/lib/types";

function geometry(count: number) {
  const W = 560, TOP = 74, ROW = 104, AMP = 150, cx = W / 2;
  const pts = Array.from({ length: count }, (_, i) => ({ x: cx + AMP * Math.sin(i * 1.05), y: TOP + i * ROW }));
  const height = TOP * 2 + (count - 1) * ROW;
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const my = (a.y + b.y) / 2;
    return ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  };
  let track = pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  for (let i = 1; i < pts.length; i++) track += seg(pts[i - 1], pts[i]);
  return { W, height, pts, track, seg, cx };
}

export function JourneyMap({
  nodes, cur, tone, onNode,
}: {
  nodes: JourneyNode[];
  cur: number;
  tone: string;
  onNode: (i: number, status: "done" | "current" | "locked", node: JourneyNode) => void;
}) {
  const { W, height, pts, track, seg, cx } = geometry(nodes.length);
  let prog = pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  for (let i = 1; i <= Math.min(cur, pts.length - 1); i++) prog += seg(pts[i - 1], pts[i]);
  const curPt = pts[Math.min(cur, pts.length - 1)] || { x: cx, y: 0 };

  return (
    <div className="relative mx-auto" style={{ width: W, height }}>
      <svg width={W} height={height} className="absolute inset-0">
        <path d={track} fill="none" stroke="#E9E6F5" strokeWidth="7" strokeLinecap="round" strokeDasharray="0.5 15" />
        <path d={prog} fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round" style={{ transition: "all .8s ease" }} />
      </svg>

      {nodes.map((lv, i) => {
        const p = pts[i];
        const done = i < cur, isCur = i === cur, locked = i > cur;
        const isQuest = lv.kind === "quest";
        const R = isQuest ? 36 : 27;
        const labelLeft = p.x > cx;
        const label = isQuest ? "Mission Quest" : `Day ${"day" in lv ? lv.day : i + 1}`;
        return (
          <div key={i}>
            <button
              onClick={() => onNode(i, done ? "done" : isCur ? "current" : "locked", lv)}
              title={lv.title}
              className={isCur ? "animate-pop" : ""}
              style={{
                position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)",
                width: R * 2, height: R * 2, borderRadius: "50%", cursor: locked ? "default" : "pointer",
                border: isQuest ? "3px solid #F5B942" : isCur ? `3px solid ${tone}` : "none",
                background: done ? (isQuest ? "#F5B942" : tone) : isCur ? "#fff" : "#EDE9FE",
                boxShadow: isCur ? `0 8px 20px -6px ${tone}88` : done ? "0 6px 14px -8px rgba(80,60,180,.35)" : "none",
                display: "grid", placeItems: "center", padding: 0,
              }}
            >
              {done ? (
                <Check size={22} color="#fff" strokeWidth={2.6} />
              ) : locked ? (
                <Lock size={isQuest ? 20 : 17} color="#8B87A0" />
              ) : isQuest ? (
                <Swords size={22} color="#F5B942" strokeWidth={2.2} />
              ) : (
                <span className="font-display font-bold text-lg" style={{ color: tone }}>
                  {"day" in lv ? lv.day : i + 1}
                </span>
              )}
            </button>
            <div
              style={{
                position: "absolute", top: p.y,
                left: labelLeft ? undefined : p.x + R + 14,
                right: labelLeft ? W - (p.x - R - 14) : undefined,
                transform: "translateY(-50%)", textAlign: labelLeft ? "right" : "left",
                maxWidth: 170, pointerEvents: "none",
              }}
            >
              <div className="text-[9.5px] font-bold tracking-wide uppercase" style={{ color: isQuest ? "#DE9E1F" : "#8B87A0" }}>
                {label}
              </div>
              <div className="font-semibold text-[13px] leading-tight mt-0.5" style={{ color: locked ? "#8B87A0" : "#1F1B2E" }}>
                {isQuest ? "Module Challenge" : lv.title}
              </div>
            </div>
          </div>
        );
      })}

      <div
        className="animate-floaty"
        style={{ position: "absolute", left: curPt.x, top: curPt.y - 72, transform: "translateX(-50%)", transition: "left .8s ease, top .8s ease", pointerEvents: "none" }}
      >
        <Nuru size={56} />
      </div>
    </div>
  );
}
