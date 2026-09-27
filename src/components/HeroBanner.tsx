"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, BookOpen, HelpCircle, Layers, Target, Sparkles } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Nuru, type NuruMood } from "./Nuru";

// Real Unsplash images — African tech/learning themed
const BANNER_IMAGES = [
  "https://images.unsplash.com/photo-1531483245484-5ca8c23a880b?w=1200&q=75&auto=format&fit=crop", // Black tech team
  "https://images.unsplash.com/photo-1528901166007-3784c7dd3653?w=1200&q=75&auto=format&fit=crop", // Black man coding
  "https://images.unsplash.com/photo-1758270705290-62b6294dd044?w=1200&q=75&auto=format&fit=crop", // diverse students laptop
  "https://images.unsplash.com/photo-1531741403586-c19915ad5d0c?w=1200&q=75&auto=format&fit=crop", // African programmer
];

const NURU_MOODS: NuruMood[] = ["wave", "idle", "cheer", "think", "idle", "wave"];

export function HeroBanner() {
  const displayName = useGameStore((s) => s.profile.displayName);
  const xp          = useGameStore((s) => s.xp);
  const level       = useGameStore((s) => s.level);
  const router      = useRouter();
  const t           = useT();
  const [question, setQuestion] = useState("");
  const [hour, setHour]         = useState<number | null>(null);
  const [mood, setMood]         = useState<NuruMood>("wave");
  const [moodIdx, setMoodIdx]   = useState(0);
  const [bobClass, setBobClass] = useState("nuru-float");

  useEffect(() => setHour(new Date().getHours()), []);

  // Cycle Nuru's mood every 4s with a bounce on change
  useEffect(() => {
    const timer = setInterval(() => {
      setMoodIdx((i) => {
        const next = (i + 1) % NURU_MOODS.length;
        setMood(NURU_MOODS[next]);
        setBobClass("nuru-bounce");
        setTimeout(() => setBobClass("nuru-float"), 750);
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const timeGreeting =
    hour === null || hour < 12 ? t("hero.good_morning")
    : hour < 18 ? t("hero.good_afternoon")
    : t("hero.good_evening");

  const imgIdx = new Date().getDay() % BANNER_IMAGES.length;

  const QUICK_ACTIONS = [
    { icon: BookOpen,    labelKey: "hero.quick.explain", href: "/study-room" },
    { icon: HelpCircle,  labelKey: "hero.quick.quiz",    href: "/courses" },
    { icon: Layers,      labelKey: "hero.quick.cards",   href: "/study-room" },
    { icon: Target,      labelKey: "hero.quick.plan",    href: "/study-room" },
  ];

  function askNuru(e: React.FormEvent) {
    e.preventDefault();
    // Nuru cheers when you ask something
    setMood("cheer");
    setBobClass("nuru-bounce");
    setTimeout(() => setBobClass("nuru-float"), 750);
    const q = question.trim();
    setTimeout(() => router.push(q ? `/study-room?q=${encodeURIComponent(q)}` : "/study-room"), 500);
  }

  return (
    <div className="relative rounded-3xl overflow-hidden flex flex-col justify-end"
      style={{ minHeight: 260 }}>

      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BANNER_IMAGES[imgIdx]}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, rgba(62,42,158,0.88) 0%, rgba(107,78,255,0.72) 35%, rgba(26,22,30,0.55) 70%, rgba(245,185,66,0.15) 100%)",
        }}
      />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── Floating Nuru robot — right side ─────────────────────────── */}
      <div className="absolute right-4 md:right-8 bottom-4 z-20 flex flex-col items-center gap-1.5 pointer-events-none select-none">

        {/* Glow halo behind robot */}
        <div className="absolute rounded-full blur-3xl opacity-45 pointer-events-none"
          style={{ background: "radial-gradient(circle, #6B4EFF 0%, transparent 70%)", width: 130, height: 130, top: "50%", left: "50%", transform: "translate(-50%, -55%)" }} />

        {/* The robot itself */}
        <div className={bobClass} style={{ filter: "drop-shadow(0 10px 28px rgba(107,78,255,0.55))" }}>
          <Nuru size={110} mood={mood} />
        </div>

        {/* "Online" badge */}
        <div className="flex items-center gap-1 bg-black/35 backdrop-blur-sm rounded-full px-2.5 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px] font-bold text-white/85 uppercase tracking-wider">Nuru AI</span>
        </div>
      </div>

      {/* Content — padded right so it doesn't overlap Nuru */}
      <div className="relative z-10 p-5 md:p-6 pr-36 md:pr-40">
        {/* XP badge top-right — moved to top-left to avoid overlap */}
        <div className="absolute top-4 left-5 flex items-center gap-1.5 bg-white/10 backdrop-blur border border-white/20 rounded-full px-2.5 py-1">
          <Sparkles size={11} className="text-nuru-gold" />
          <span className="text-white text-[10px] font-bold">Lv.{level} · {xp.toLocaleString()} XP</span>
        </div>

        {/* Greeting */}
        <div className="mb-2 mt-6">
          <div className="text-white/70 text-[11px] font-extrabold uppercase tracking-[0.18em] mb-0.5">
            {timeGreeting} 🌞
          </div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-white leading-tight">
            {displayName || "Learner"} 👋
          </h1>
          <p className="text-white/60 text-[12px] mt-1 max-w-xs">{t("hero.keep_going")}</p>
        </div>

        {/* Search input */}
        <form onSubmit={askNuru} className="relative max-w-md mt-3 mb-3">
          <div className="flex items-center bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl overflow-hidden hover:border-white/40 transition-all focus-within:border-white/50 focus-within:bg-white/20"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onFocus={() => { setMood("think"); }}
              placeholder={t("hero.ask_nuru")}
              className="flex-1 bg-transparent text-white text-[13px] px-4 py-3 outline-none placeholder:text-white/45 font-medium"
            />
            <button type="submit"
              className="px-4 py-3 text-white/70 hover:text-white transition-colors flex items-center">
              <Send size={15} />
            </button>
          </div>
        </form>

        {/* Quick action chips */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map(({ icon: Icon, labelKey, href }) => (
            <button key={labelKey} onClick={() => router.push(href)}
              className="flex items-center gap-1.5 bg-white/12 backdrop-blur-sm hover:bg-white/22 border border-white/20 hover:border-white/38 transition-all rounded-full px-3 py-1.5 text-white text-[11px] font-bold tracking-wide">
              <Icon size={11} className="opacity-80" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
