"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Flame, Diamond, Bell, Sun, Moon } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { useTracks } from "@/lib/curriculum-db";

export function TopBar({
  title, subtitle, greeting,
}: { title?: string; subtitle?: string; greeting?: boolean }) {
  const router = useRouter();
  const xp = useGameStore((s) => s.xp);
  const streak = useGameStore((s) => s.currentStreak());
  const displayName = useGameStore((s) => s.profile.displayName);
  const avatarKey = useGameStore((s) => s.profile.avatarKey);
  const theme = useGameStore((s) => s.theme);
  const toggleTheme = useGameStore((s) => s.toggleTheme);
  const setActiveTrack = useGameStore((s) => s.setActiveTrack);
  const { tracks: TRACKS } = useTracks();
  const [query, setQuery] = useState("");

  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);
  const timeGreeting = hour === null ? "Welcome" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const heading = greeting ? `${timeGreeting}, ${displayName}` : title;

  // A real (if modest) search: matches against our actual track/module
  // names — our whole catalog right now is 3 tracks, so this isn't a full
  // search index, just a genuine match against real content rather than a
  // decorative input that goes nowhere.
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    for (const track of TRACKS) {
      const hit =
        track.name.toLowerCase().includes(q) ||
        track.subtitle.toLowerCase().includes(q) ||
        track.modules.some((m) => m.name.toLowerCase().includes(q));
      if (hit) {
        setActiveTrack(track.id as never);
        router.push("/courses");
        return;
      }
    }
    router.push("/courses");
  }

  return (
    <div className="relative sticky top-0 z-20 -mx-5 lg:-mx-8 px-5 lg:px-8 py-3.5 mb-6 border-b border-nuru-line/60 flex items-start justify-between flex-wrap gap-4"
      style={{ background: "rgb(var(--c-bg) / 0.88)", backdropFilter: "blur(16px)" }}>
      {/* Gradient accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{ background: "linear-gradient(90deg, #6B4EFF 0%, #F5B942 50%, #22C55E 100%)", opacity: 0.6 }} />

      {heading ? (
        <div>
          <h1 className="font-display font-extrabold text-[26px] text-nuru-ink leading-tight">{heading}</h1>
          {subtitle && <p className="text-nuru-muted text-sm mt-0.5">{subtitle}</p>}
        </div>
      ) : (
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nuru-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for courses, topics, or skills..."
            className="w-full bg-nuru-card border border-nuru-line rounded-2xl pl-10 pr-14 py-2.5 text-sm text-nuru-ink placeholder:text-nuru-muted outline-none focus:border-nuru-purple transition-colors"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-nuru-muted bg-nuru-bg px-1.5 py-0.5 rounded-md border border-nuru-line">
            ⌘K
          </kbd>
        </form>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <StatPill
          icon={<Flame size={14} className="text-amber-500" fill="currentColor" />}
          value={String(streak)}
          label="day streak"
          bg="from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20"
          border="border-amber-200/60 dark:border-amber-800/40"
        />
        <StatPill
          icon={<Diamond size={14} className="text-nuru-purple" fill="currentColor" />}
          value={xp.toLocaleString()}
          label="XP"
          bg="from-nuru-lav to-purple-50 dark:from-purple-950/30 dark:to-indigo-950/20"
          border="border-nuru-purple/20"
        />
        <IconButton onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <IconButton dot aria-label="Notifications">
          <Bell size={16} />
        </IconButton>
        <Link href="/settings"
          className="w-9 h-9 rounded-full grid place-items-center text-white font-bold text-sm ring-2 ring-nuru-card shadow-card relative"
          style={{ background: "linear-gradient(135deg, #6B4EFF, #F5B942)" }}>
          {avatarKey}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-nuru-card" />
        </Link>
      </div>
    </div>
  );
}

function StatPill({ icon, value, label, bg = "bg-nuru-card", border = "border-nuru-line" }: {
  icon: React.ReactNode; value: string; label: string; bg?: string; border?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 bg-gradient-to-r ${bg} rounded-xl px-3 py-1.5 shadow-card border ${border}`}>
      {icon}
      <div className="leading-none">
        <div className="font-bold text-sm text-nuru-ink">{value}</div>
        <div className="text-[10px] text-nuru-muted font-medium">{label}</div>
      </div>
    </div>
  );
}

function IconButton({
  children, dot, onClick, "aria-label": ariaLabel,
}: { children: React.ReactNode; dot?: boolean; onClick?: () => void; "aria-label"?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-10 h-10 rounded-full bg-nuru-card border border-nuru-line grid place-items-center text-nuru-ink2 shadow-card relative hover:bg-nuru-lav transition-colors"
    >
      {children}
      {dot && <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-nuru-rose" />}
    </button>
  );
}
