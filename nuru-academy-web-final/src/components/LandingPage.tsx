"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, Star, Brain, BookOpen, Award, Users, Zap, Globe } from "lucide-react";
import { Nuru } from "@/components/Nuru";
import { useTracks } from "@/lib/curriculum-db";
import { detectGeoLanguage, countryToLang } from "@/lib/useGeoLanguage";
import type { DisplayLang } from "@/lib/store";

const HERO_BG    = "https://images.unsplash.com/photo-1531483245484-5ca8c23a880b?w=1600&q=80&auto=format&fit=crop";
const STUDENT_IMG = "https://images.unsplash.com/photo-1528901166007-3784c7dd3653?w=600&q=80&auto=format&fit=crop";

// ── Bilingual hero copy — keyed by language ─────────────────────────────────
const HERO_COPY: Record<string, { headline: string; sub: string; cta: string }> = {
  en: {
    headline: "Learn AI. Use AI. Powered by AI.",
    sub:      "Nuru teaches you what AI is, how to use it in your work and life, and uses AI itself to tutor you through every lesson — all in one structured curriculum built for East Africa.",
    cta:      "Start learning free",
  },
  sw: {
    headline: "Jifunza AI. Tumia AI. Inayofanywa na AI.",
    sub:      "Nuru inakufundisha AI ni nini, jinsi ya kuitumia katika kazi na maisha yako, na inatumia AI yenyewe kukufundisha katika kila somo — yote katika mtaala mmoja ulioundwa kwa Afrika Mashariki.",
    cta:      "Anza kujifunza bure",
  },
  fr: {
    headline: "Apprenez l'IA. Utilisez l'IA. Propulsé par l'IA.",
    sub:      "Nuru vous enseigne ce qu'est l'IA, comment l'utiliser dans votre travail, et utilise l'IA pour vous guider à travers chaque leçon — dans un programme structuré pour l'Afrique de l'Est.",
    cta:      "Commencer gratuitement",
  },
  am: {
    headline: "AI ይማሩ። AI ይጠቀሙ። በ AI ይሰለጥኑ።",
    sub:      "Nuru AI ምን እንደሆነ፣ በሥራዎ እንዴት እንደሚጠቀሙበት ያስተምርዎታል — እናም AI ራሱ በእያንዳንዱ ትምህርት ይመራዎታል።",
    cta:      "ነፃ ትምህርት ጀምሩ",
  },
  ha: {
    headline: "Koyi AI. Yi amfani da AI. Tare da AI.",
    sub:      "Nuru yana koyar da ku abin da AI yake, yadda ake amfani da shi a aikinku, kuma yana amfani da AI don koyar da ku a kowace darasi.",
    cta:      "Fara koyo kyauta",
  },
  yo: {
    headline: "Kọ́ AI. Lò AI. Àgbára AI.",
    sub:      "Nuru kọ́ ọ nípa ohun tí AI jẹ́, bí o ṣe lè lò ó nínú iṣẹ́ rẹ, tí ó sì ń lò AI fúnrarẹ̀ láti kọ́ ọ ní gbogbo ẹ̀kọ́.",
    cta:      "Bẹ̀rẹ̀ kíkẹ́kọ̀ọ́ lọ́fẹ̀ẹ́",
  },
  zu: {
    headline: "Funda I-AI. Sebenzisa I-AI. Amandla e-AI.",
    sub:      "Nuru ikufundisa ukuthi i-AI iyini, ukuthi ungayisebenzisa kanjani emsebenzini wakho, futhi isebenzisa i-AI ukuze ikufundise kuwo wonke umfundo.",
    cta:      "Qala ukufunda mahhala",
  },
};

// ── Features — what Nuru actually is ────────────────────────────────────────
const PLATFORM_FEATURES = [
  { icon: BookOpen, label: "Learn what AI is",         desc: "Understand how AI works, what LLMs are, and why it matters — from first principles" },
  { icon: Zap,      label: "Learn to use AI daily",    desc: "Prompting, automation, image generation, business tools — real skills you use tomorrow" },
  { icon: Brain,    label: "AI tutors you through it", desc: "Nuru AI explains every concept, quizzes you, and adapts to how you learn — 24/7" },
  { icon: Award,    label: "Earn verified certificates", desc: "Complete a track, pass the quest, earn a certificate you can share anywhere" },
  { icon: Users,    label: "Compete with peers",       desc: "Arena duels, leaderboards, and USSD competitions via *278# — no smartphone needed" },
  { icon: Globe,    label: "7 African languages",      desc: "Swahili, Hausa, Yoruba, Amharic, Zulu, French and English — switch any time" },
];

// ── Bilingual crossfade hook ─────────────────────────────────────────────────
function useBilingualHero(detectedLang: DisplayLang | null) {
  const [primary,   setPrimary]   = useState<string>("en");
  const [secondary, setSecondary] = useState<string | null>(null);
  const [showPrimary, setShowPrimary] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!detectedLang || detectedLang === "en") {
      setPrimary("en");
      setSecondary(null);
      return;
    }
    // Show detected language as primary, cycle with English
    setPrimary(detectedLang);
    setSecondary("en");

    // Crossfade every 10 seconds so both languages get read comfortably
    timerRef.current = setInterval(() => {
      setShowPrimary((v) => !v);
    }, 10000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [detectedLang]);

  const activeLang = showPrimary ? primary : (secondary ?? primary);
  const copy = HERO_COPY[activeLang] ?? HERO_COPY.en;

  return { copy, showPrimary, activeLang };
}

// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const { tracks: TRACKS } = useTracks();
  const [detectedLang, setDetectedLang] = useState<DisplayLang | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string>("");
  const { copy, showPrimary, activeLang } = useBilingualHero(detectedLang);

  // Detect location on mount — no permission prompt on landing page,
  // only trigger if browser already has cached permission
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.permissions?.query({ name: "geolocation" }).then((perm) => {
      // Only auto-detect if already granted — don't prompt uninvited on landing
      if (perm.state === "granted") {
        detectGeoLanguage().then((result) => {
          if (result) {
            setDetectedLang(result.lang);
            setDetectedCountry(result.country);
          }
        });
      } else if (perm.state === "prompt") {
        // Ask after 2s delay — user has had time to read the page
        setTimeout(() => {
          detectGeoLanguage().then((result) => {
            if (result) {
              setDetectedLang(result.lang);
              setDetectedCountry(result.country);
            }
          });
        }, 2000);
      }
    }).catch(() => {
      // permissions API not supported — try anyway
      detectGeoLanguage().then((result) => {
        if (result) {
          setDetectedLang(result.lang);
          setDetectedCountry(result.country);
        }
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#09090F] text-white overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative min-h-screen flex flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, rgba(107,78,255,0.65) 0%, rgba(9,9,15,0.85) 55%, rgba(245,185,66,0.15) 100%)",
        }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="absolute top-20 left-[8%] w-72 h-72 rounded-full blur-[90px] pointer-events-none opacity-30"
          style={{ background: "#6B4EFF" }} />
        <div className="absolute bottom-20 right-[8%] w-96 h-96 rounded-full blur-[110px] pointer-events-none opacity-15"
          style={{ background: "#F5B942" }} />

        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Nav */}
          <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl grid place-items-center"
                style={{ background: "linear-gradient(135deg, #6B4EFF, #3E2A9E)" }}>
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <span className="font-display font-extrabold text-lg tracking-tight">Nuru</span>
                <span className="text-white/50 text-sm ml-1.5">Learning Hub</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {detectedCountry && (
                <span className="text-white/40 text-xs hidden md:block">📍 {detectedCountry}</span>
              )}
              <Link href="/login" className="px-4 py-2 rounded-xl text-white/70 text-sm font-semibold hover:text-white transition-colors">
                Sign in
              </Link>
              <Link href="/login" className="px-4 py-2 rounded-xl text-sm font-bold text-white border border-white/20 hover:bg-white/10 transition-all"
                style={{ background: "rgba(107,78,255,0.35)", backdropFilter: "blur(8px)" }}>
                Get started →
              </Link>
            </div>
          </header>

          {/* Hero content */}
          <main className="flex-1 flex items-center w-full max-w-6xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center w-full">

              {/* Left: copy */}
              <div>
                {/* "What we actually are" badge */}
                <div className="flex flex-wrap gap-2 mb-5">
                  <div className="inline-flex items-center gap-2 bg-nuru-gold/15 border border-nuru-gold/30 rounded-full px-3.5 py-1.5">
                    <Star size={11} className="text-nuru-gold" fill="currentColor" />
                    <span className="text-nuru-gold text-xs font-bold tracking-wide">Tanzania&apos;s Learning Hub</span>
                  </div>
                  <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 rounded-full px-3.5 py-1.5">
                    <Brain size={11} className="text-purple-300" />
                    <span className="text-purple-300 text-xs font-bold tracking-wide">Teaches AI · Uses AI to Teach</span>
                  </div>
                </div>

                {/* Bilingual headline — crossfades every 4s */}
                <div className="relative mb-5" style={{ minHeight: "7rem" }}>
                  <h1
                    key={activeLang}
                    className="font-display font-extrabold text-4xl md:text-5xl xl:text-[3.25rem] leading-[1.08] transition-opacity duration-700"
                    style={{ opacity: 1 }}
                  >
                    {copy.headline}
                  </h1>
                  {/* Language toggle indicator */}
                  {detectedLang && detectedLang !== "en" && (
                    <div className="absolute -bottom-2 left-0 flex items-center gap-1.5 mt-2">
                      <div className={`w-2 h-0.5 rounded-full transition-colors duration-500 ${showPrimary ? "bg-nuru-gold" : "bg-white/30"}`} />
                      <div className={`w-2 h-0.5 rounded-full transition-colors duration-500 ${!showPrimary ? "bg-nuru-gold" : "bg-white/30"}`} />
                      <span className="text-white/30 text-[10px] ml-1">
                        {showPrimary ? activeLang.toUpperCase() : "EN"}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-white/65 text-base md:text-lg leading-relaxed mb-7 max-w-lg transition-opacity duration-700">
                  {copy.sub}
                </p>

                {/* What makes this a LEARNING platform */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-7">
                  <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-3">How you actually learn</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "📚  Understand AI — what it is, how it works, why it matters",
                      "🛠️  Use AI — prompting, tools, automation, and real workflows",
                      "🤖  Nuru AI tutors you through every lesson and quiz",
                      "🏆  Certificates that prove you can do it, not just recite it",
                    ].map((item) => (
                      <div key={item} className="text-white/75 text-sm">{item}</div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/login"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-base shadow-[0_4px_24px_rgba(107,78,255,0.45)] hover:shadow-[0_4px_32px_rgba(107,78,255,0.6)] transition-all"
                    style={{ background: "linear-gradient(135deg, #6B4EFF, #5738E8)" }}>
                    {copy.cta} <ArrowRight size={18} />
                  </Link>
                  <Link href="/login"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-white/75 font-semibold text-base border border-white/15 hover:bg-white/8 transition-all">
                    Sign in
                  </Link>
                </div>

                {/* Trust strip */}
                <div className="flex items-center gap-4 mt-7">
                  <div className="flex -space-x-2">
                    {["A","K","J","M","F"].map((l, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-[#09090F] grid place-items-center text-[10px] font-bold text-white"
                        style={{ background: ["#6B4EFF","#F5B942","#22C55E","#EF4444","#3B82F6"][i] }}>
                        {l}
                      </div>
                    ))}
                  </div>
                  <div className="text-white/50 text-xs">
                    <span className="text-white font-semibold">500+ learners</span> already enrolled across East Africa
                  </div>
                </div>
              </div>

              {/* Right: card + image */}
              <div className="relative">
                <div className="rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={STUDENT_IMG} alt="Learner studying" className="w-full h-72 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(9,9,15,0.8) 0%, transparent 60%)" }} />

                  <div className="absolute top-4 right-4 bg-nuru-gold text-[#09090F] text-xs font-extrabold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <Star size={11} fill="currentColor" /> +500 XP
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="bg-white/15 backdrop-blur border border-white/20 rounded-xl px-3 py-2">
                      <div className="text-xs text-white/60">Current lesson</div>
                      <div className="text-sm font-bold text-white">What is a Neural Network?</div>
                    </div>
                    <div className="nuru-float" style={{ filter: "drop-shadow(0 4px 12px rgba(107,78,255,0.5))" }}>
                      <Nuru size={44} mood="cheer" />
                    </div>
                  </div>
                </div>

                {/* Floating "AI is your tutor" card */}
                <div className="absolute -bottom-8 -left-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl w-56">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain size={14} className="text-nuru-purple" />
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wide">What You Get</span>
                  </div>
                  {[
                    "Learn what AI is & how it works",
                    "Learn to use AI tools daily",
                    "Tutored by AI through every lesson",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2 mb-1.5">
                      <Check size={10} className="text-nuru-green shrink-0" />
                      <span className="text-white/70 text-xs leading-tight">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── What makes Nuru different ──────────────────────────────────────── */}
      <div className="relative py-20 px-6" style={{ background: "linear-gradient(180deg, #09090F 0%, #0C0818 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-nuru-purple text-xs font-bold tracking-widest uppercase mb-3">The Platform</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mb-3">
              Learn AI.<br />Use AI.<br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #6B4EFF, #F5B942)" }}>
                Taught by AI.
              </span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto text-base leading-relaxed">
              Nuru is three things at once: a structured curriculum <em>about</em> AI, practical training in <em>using</em> AI tools every day, and an AI tutor that guides you through every lesson, quiz, and challenge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORM_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="relative rounded-2xl border border-white/8 p-5 hover:border-nuru-purple/30 transition-all group"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(107,78,255,0.1) 0%, transparent 70%)" }} />
                <div className="w-9 h-9 rounded-xl grid place-items-center mb-3 relative z-10"
                  style={{ background: "linear-gradient(135deg, rgba(107,78,255,0.3), rgba(107,78,255,0.1))", border: "1px solid rgba(107,78,255,0.3)" }}>
                  <Icon size={17} className="text-nuru-purple" />
                </div>
                <h3 className="font-bold text-white text-sm mb-1 relative z-10">{label}</h3>
                <p className="text-white/45 text-xs leading-relaxed relative z-10">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tracks Section ────────────────────────────────────────────────── */}
      <div className="relative py-16 px-6" style={{ background: "#0C0818" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-nuru-purple text-xs font-bold tracking-widest uppercase mb-2">Learning Tracks</div>
            <h2 className="font-display font-extrabold text-3xl text-white">Choose your path</h2>
            <p className="text-white/40 text-sm mt-2">From complete beginner to production-ready — all designed for East Africa</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TRACKS.map((track) => (
              <div key={track.id} className="relative rounded-2xl overflow-hidden border border-white/8 p-5 hover:border-white/20 transition-all group"
                style={{ background: `linear-gradient(135deg, ${track.tone}12 0%, rgba(255,255,255,0.02) 100%)` }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 0%, ${track.tone}18 0%, transparent 70%)` }} />
                <div className="relative z-10">
                  <div className="h-0.5 w-8 rounded-full mb-3" style={{ background: track.tone }} />
                  <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: track.tone }}>
                    {track.subtitle}
                  </div>
                  <h3 className="font-display font-bold text-lg text-white mb-1.5">{track.name}</h3>
                  <p className="text-white/45 text-xs leading-relaxed mb-4">{track.tagline}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: track.tone }}>TZS {track.priceTZS}</span>
                    <span className="text-white/35 text-xs">Pass at {track.passingPct}%</span>
                  </div>
                  {track.requires && (
                    <div className="mt-1.5 text-[10px] text-white/25">Requires: {track.requires}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-base"
              style={{ background: "linear-gradient(135deg, #6B4EFF, #5738E8)" }}>
              Start learning free <ArrowRight size={16} />
            </Link>
            <p className="text-white/30 text-xs mt-3">No credit card required · Week 1 always free</p>
          </div>
        </div>
      </div>
    </div>
  );
}
