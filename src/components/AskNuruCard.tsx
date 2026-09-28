"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, BookOpen, HelpCircle, Zap, Brain, Lock } from "lucide-react";
import { Nuru, type NuruMood } from "./Nuru";
import { useT } from "@/lib/i18n";

// ── Thought bubble prompts Nuru cycles through ─────────────────────────────
const THOUGHTS = [
  "What is a neural network?",
  "Explain AI in Swahili 🇹🇿",
  "How does ChatGPT work?",
  "What is prompt engineering?",
  "Give me a quiz on AI basics",
  "How can AI help my business?",
  "What is machine learning?",
  "Summarise my lesson notes",
  "Create flashcards for Week 1",
  "What is the difference between AI and ML?",
];

// ── Quick action chips ─────────────────────────────────────────────────────
const QUICK = [
  { icon: BookOpen,   label: "Explain a concept",  q: "Explain this concept simply: " },
  { icon: HelpCircle, label: "Quiz me",             q: "Give me a 5-question quiz on AI basics" },
  { icon: Zap,        label: "Daily challenge",     q: "Give me a daily AI challenge I can do in 5 minutes" },
  { icon: Brain,      label: "Study plan",          q: "Create a 7-day AI study plan for a beginner in Tanzania" },
];

// ── Mood cycle: Nuru shifts mood every few seconds when idle ───────────────
const MOOD_CYCLE: NuruMood[] = ["idle", "wave", "think", "cheer", "idle", "idle", "think"];

export function AskNuruCard() {
  const router   = useRouter();
  const t        = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [question,    setQuestion]    = useState("");
  const [mood,        setMood]        = useState<NuruMood>("wave");
  const [moodIdx,     setMoodIdx]     = useState(0);
  const [thoughtIdx,  setThoughtIdx]  = useState(0);
  const [showThought, setShowThought] = useState(true);
  const [nuruAnim,    setNuruAnim]    = useState<"float" | "bounce" | "wiggle">("float");
  const [typing,      setTyping]      = useState(false);
  const [pulsing,     setPulsing]     = useState(false);

  // ── Cycle mood every 4 seconds ──────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setMoodIdx((i) => {
        const next = (i + 1) % MOOD_CYCLE.length;
        setMood(MOOD_CYCLE[next]);
        // Trigger a short bounce when mood changes
        setNuruAnim("bounce");
        setTimeout(() => setNuruAnim("float"), 750);
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // ── Cycle thought bubble every 3.5 seconds ──────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      // Fade out
      setShowThought(false);
      setTimeout(() => {
        setThoughtIdx((i) => (i + 1) % THOUGHTS.length);
        setShowThought(true);
      }, 350);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  // ── When user focuses input — Nuru looks attentive ─────────────────────
  function onFocus() {
    setMood("think");
    setNuruAnim("wiggle");
    setTimeout(() => setNuruAnim("float"), 650);
    setPulsing(true);
  }

  function onBlur() {
    if (!question) {
      setMood(MOOD_CYCLE[moodIdx]);
      setPulsing(false);
    }
  }

  // ── Submit — Nuru cheers then navigates ────────────────────────────────
  function submit(q?: string) {
    const finalQ = (q ?? question).trim();
    if (!finalQ) {
      // Wiggle to prompt the user to type
      setNuruAnim("wiggle");
      setTimeout(() => setNuruAnim("float"), 650);
      inputRef.current?.focus();
      return;
    }
    setMood("cheer");
    setNuruAnim("bounce");
    setTimeout(() => {
      router.push(`/study-room?q=${encodeURIComponent(finalQ)}`);
    }, 600);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") submit();
  }

  return (
    <div className={`relative rounded-3xl overflow-hidden border transition-all duration-300 ${
      pulsing ? "border-nuru-purple/50 shadow-[0_0_0_3px_rgba(107,78,255,0.08)]" : "border-nuru-line shadow-card"
    }`}
      style={{
        background: "linear-gradient(160deg, #f9f7ff 0%, #f3f0ff 40%, #fff8e8 100%)",
      }}>

      {/* Lock overlay — entire card is premium / coming soon */}
      <div className="absolute inset-0 z-20 bg-black/55 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center gap-3 cursor-not-allowed select-none">
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/25 grid place-items-center backdrop-blur-sm">
          <Lock size={26} className="text-white/90" />
        </div>
        <div className="text-center px-4">
          <div className="font-bold text-white text-sm">Premium Feature</div>
          <div className="text-white/60 text-xs mt-0.5">Unlock a course to access Nuru AI</div>
        </div>
      </div>

      {/* Dark mode */}
      <div className="dark:hidden absolute inset-0 pointer-events-none rounded-3xl"
        style={{ background: "linear-gradient(160deg, rgba(107,78,255,0.04) 0%, rgba(245,185,66,0.03) 100%)" }} />

      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #6B4EFF 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #F5B942 0%, transparent 70%)", transform: "translate(-30%, 30%)" }} />

      <div className="relative z-10 p-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles size={13} className="text-nuru-gold" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-nuru-purple">AI Tutor</span>
            </div>
            <h3 className="font-display font-extrabold text-lg text-nuru-ink leading-tight">Ask Nuru</h3>
            <p className="text-xs text-nuru-muted mt-0.5">Your personal AI learning companion</p>
          </div>

          {/* Nuru robot — animated, floating, mood-shifting */}
          <div className="relative flex flex-col items-center">

            {/* Thought bubble */}
            <div className={`absolute -top-1 right-12 max-w-[140px] transition-all duration-300 ${
              showThought ? "thought-pop" : "thought-fade"
            }`}
              style={{ zIndex: 20 }}>
              <div className="relative bg-white dark:bg-nuru-card border border-nuru-purple/20 rounded-2xl rounded-br-none px-3 py-2 shadow-md">
                <p className="text-[10px] font-semibold text-nuru-ink leading-tight">{THOUGHTS[thoughtIdx]}</p>
                {/* Bubble tail */}
                <div className="absolute bottom-0 right-0 translate-x-1.5 translate-y-1.5">
                  <div className="w-3 h-3 bg-white dark:bg-nuru-card border-r border-b border-nuru-purple/20 rotate-45" />
                </div>
              </div>
              {/* Bubble dots */}
              <div className="flex gap-0.5 justify-end mt-0.5 mr-4">
                <div className="w-1 h-1 rounded-full bg-nuru-purple/30" />
                <div className="w-1.5 h-1.5 rounded-full bg-nuru-purple/20" />
              </div>
            </div>

            {/* Robot with glow ring when pulsing */}
            <div className={`relative rounded-full transition-all duration-300 ${pulsing ? "nuru-pulse-glow" : ""}`}>
              <div className={`nuru-${nuruAnim}`}>
                <Nuru size={72} mood={mood} />
              </div>
            </div>

            {/* Online indicator */}
            <div className="flex items-center gap-1 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-bold text-green-600 uppercase tracking-wide">Online</span>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className={`flex items-center gap-2 bg-white dark:bg-nuru-bg border-2 rounded-2xl px-3 py-2.5 transition-all duration-200 ${
          pulsing ? "border-nuru-purple/60" : "border-nuru-line"
        }`}>
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setTyping(e.target.value.length > 0); }}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKey}
            placeholder="Ask me anything about AI…"
            className="flex-1 bg-transparent text-sm text-nuru-ink placeholder:text-nuru-muted outline-none"
          />
          {typing ? (
            <button onClick={() => submit()}
              className="w-7 h-7 rounded-xl grid place-items-center text-white transition-all"
              style={{ background: "linear-gradient(135deg, #6B4EFF, #5738E8)" }}>
              <Send size={12} />
            </button>
          ) : pulsing ? (
            <div className="flex gap-1 items-center px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-nuru-purple dot-1" />
              <div className="w-1.5 h-1.5 rounded-full bg-nuru-purple dot-2" />
              <div className="w-1.5 h-1.5 rounded-full bg-nuru-purple dot-3" />
            </div>
          ) : (
            <Sparkles size={14} className="text-nuru-muted" />
          )}
        </div>

        {/* Quick action chips */}
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {QUICK.map(({ icon: Icon, label, q }) => (
            <button key={label} onClick={() => submit(q)}
              className="flex items-center gap-1.5 bg-white/70 dark:bg-nuru-bg/70 hover:bg-nuru-lav border border-nuru-line hover:border-nuru-purple/30 rounded-xl px-2.5 py-2 text-left transition-all group">
              <Icon size={11} className="text-nuru-purple shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold text-nuru-ink2 group-hover:text-nuru-purple leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-center text-[10px] text-nuru-muted mt-3">
          Powered by Claude · Answers in Swahili or English
        </p>
      </div>
    </div>
  );
}
