"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, BookOpen, Swords, Trophy, Settings,
  Award, Zap, Sparkles, ChevronRight, Flame,
} from "lucide-react";
import { useGameStore } from "@/lib/store";
import { NuruProCard } from "./NuruProCard";
import { LanguageToggle } from "./LanguageToggle";
import { useT } from "@/lib/i18n";

const NAV = [
  { href: "/",             labelKey: "nav.home",         icon: Home },
  { href: "/courses",      labelKey: "nav.courses",       icon: BookOpen },
  { href: "/arena",        labelKey: "nav.arena",         icon: Swords },
  // { href: "/compete",   labelKey: "nav.compete",       icon: Zap },     // Competitions — coming soon
  { href: "/certificates", labelKey: "nav.certs",         icon: Award },
  { href: "/achievements", labelKey: "nav.achievements",  icon: Trophy },
  { href: "/settings",     labelKey: "nav.settings",      icon: Settings },
];

export function Sidebar() {
  const pathname    = usePathname();
  const profile     = useGameStore((s) => s.profile);
  const xp          = useGameStore((s) => s.xp);
  const level       = useGameStore((s) => s.level);
  const currentStreak = useGameStore((s) => s.currentStreak);
  const t = useT();

  const streak = currentStreak();

  return (
    <aside className="w-[252px] shrink-0 h-screen sticky top-0 flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #1C1050 0%, #130C3E 40%, #0D0828 100%)",
        borderRight: "1px solid rgba(124,92,255,0.18)",
      }}
    >
      {/* Brand */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            <div className="w-10 h-10 rounded-2xl grid place-items-center shadow-pop"
              style={{ background: "linear-gradient(135deg, #7C5CFF 0%, #3E2A9E 100%)" }}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white/10" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold text-base text-white leading-none tracking-tight">NURU</div>
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/45 mt-0.5 uppercase">Learning Hub</div>
          </div>
          <LanguageToggle compact />
        </div>

        {/* User mini-card */}
        <div className="mt-3.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-8 h-8 rounded-xl grid place-items-center text-sm font-extrabold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #7C5CFF, #FFBE30)" }}>
            {(profile.avatarKey || profile.displayName?.[0] || "N").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white/90 truncate">{profile.displayName || "Learner"}</div>
            <div className="text-[10px] text-white/45">Lv.{level} · {xp.toLocaleString()} XP</div>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg shrink-0"
              style={{ background: "rgba(255,190,48,0.18)", border: "1px solid rgba(255,190,48,0.3)" }}>
              <Flame size={10} className="text-amber-400" fill="currentColor" />
              <span className="text-[10px] font-bold text-amber-300">{streak}</span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 relative overflow-hidden ${
                active
                  ? "text-white shadow-[0_2px_16px_rgba(124,92,255,0.45)]"
                  : "text-white/55 hover:text-white/90"
              }`}
              style={active ? {
                background: "linear-gradient(135deg, #7C5CFF 0%, #6040F0 100%)",
              } : { background: "transparent" }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Active glow */}
              {active && (
                <div className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{ background: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.4) 0%, transparent 70%)" }} />
              )}
              <Icon size={17} strokeWidth={active ? 2.5 : 2.2} className="relative z-10 shrink-0" />
              <span className="relative z-10 flex-1">{t(labelKey)}</span>
              {active && <ChevronRight size={13} className="relative z-10 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Pro card + bottom */}
      <div className="px-3 pb-4 pt-2 space-y-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <NuruProCard />
      </div>
    </aside>
  );
}
