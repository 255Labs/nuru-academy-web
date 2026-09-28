"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Flame, Diamond, Bell, BellOff, Sun, Moon, X, CheckCircle2, Trophy, Zap, BookOpen } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { useTracks } from "@/lib/curriculum-db";
import { LanguageToggle } from "./LanguageToggle";

// ── Mock notification items ────────────────────────────────────────────────
const MOCK_NOTIFICATIONS = [
  { id: "1", icon: Trophy, color: "#F5B942", title: "Streak milestone!", body: "You hit a 3-day learning streak 🔥", time: "2m ago" },
  { id: "2", icon: BookOpen, color: "#6B4EFF", title: "New lesson available", body: "Week 1 · Day 2 is ready for you", time: "1h ago" },
  { id: "3", icon: Zap,      color: "#22C55E", title: "Quiz unlocked",       body: "Complete AI Basics quiz to earn 50 XP", time: "3h ago" },
  { id: "4", icon: CheckCircle2, color: "#3B82F6", title: "Certificate ready", body: "Your Week 1 certificate is available", time: "1d ago" },
];

function useNotifPrefs() {
  const [enabled, setEnabled] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nuru-notifs");
      if (stored) {
        const parsed = JSON.parse(stored);
        setEnabled(parsed.enabled ?? true);
        setDismissed(parsed.dismissed ?? []);
      }
    } catch {}
  }, []);

  function save(enabled: boolean, dismissed: string[]) {
    try { localStorage.setItem("nuru-notifs", JSON.stringify({ enabled, dismissed })); } catch {}
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    save(next, dismissed);
  }

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    save(enabled, next);
  }

  const visible = enabled ? MOCK_NOTIFICATIONS.filter((n) => !dismissed.includes(n.id)) : [];

  return { enabled, toggle, dismiss, visible };
}

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

  // Notifications
  const { enabled, toggle, dismiss, visible } = useNotifPrefs();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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

        {/* Language toggle — flag chip */}
        <LanguageToggle compact dropDirection="down" />

        <IconButton onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>

        {/* Notification bell with dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            className="w-10 h-10 rounded-full bg-nuru-card border border-nuru-line grid place-items-center text-nuru-ink2 shadow-card relative hover:bg-nuru-lav transition-colors"
          >
            {enabled ? <Bell size={16} /> : <BellOff size={16} className="opacity-50" />}
            {enabled && visible.length > 0 && (
              <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-nuru-rose" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-nuru-card border border-nuru-line rounded-2xl shadow-pop z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-nuru-line">
                <div>
                  <div className="font-bold text-sm text-nuru-ink">Notifications</div>
                  {enabled && visible.length > 0 && (
                    <div className="text-[10px] text-nuru-muted mt-0.5">{visible.length} unread</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* On/off toggle */}
                  <button
                    onClick={toggle}
                    title={enabled ? "Turn off notifications" : "Turn on notifications"}
                    className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-nuru-purple" : "bg-nuru-line"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                  <button onClick={() => setNotifOpen(false)} className="text-nuru-muted hover:text-nuru-ink transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Body */}
              {!enabled ? (
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                  <BellOff size={28} className="text-nuru-muted opacity-40" />
                  <div className="text-sm font-semibold text-nuru-ink2">Notifications are off</div>
                  <div className="text-xs text-nuru-muted">Toggle on above to get updates about your learning progress.</div>
                </div>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                  <CheckCircle2 size={28} className="text-green-400 opacity-60" />
                  <div className="text-sm font-semibold text-nuru-ink2">All caught up!</div>
                  <div className="text-xs text-nuru-muted">No new notifications right now.</div>
                </div>
              ) : (
                <div className="divide-y divide-nuru-line max-h-72 overflow-y-auto">
                  {visible.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-nuru-lav transition-colors group">
                        <div className="w-8 h-8 rounded-xl grid place-items-center shrink-0 mt-0.5"
                          style={{ background: `${n.color}22`, border: `1px solid ${n.color}44` }}>
                          <Icon size={14} style={{ color: n.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-nuru-ink">{n.title}</div>
                          <div className="text-[11px] text-nuru-muted mt-0.5 leading-snug">{n.body}</div>
                          <div className="text-[10px] text-nuru-muted/60 mt-1">{n.time}</div>
                        </div>
                        <button
                          onClick={() => dismiss(n.id)}
                          className="text-nuru-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-nuru-ink mt-0.5"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

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
  children, onClick, "aria-label": ariaLabel,
}: { children: React.ReactNode; onClick?: () => void; "aria-label"?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-10 h-10 rounded-full bg-nuru-card border border-nuru-line grid place-items-center text-nuru-ink2 shadow-card relative hover:bg-nuru-lav transition-colors"
    >
      {children}
    </button>
  );
}
