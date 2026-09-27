"use client";

import { useState } from "react";
import {
  Lock, Medal, Play, Swords, BookOpen, FileText,
  Video, Zap, ChevronRight, CheckCircle2, Star,
  AlertTriangle, CreditCard, Sparkles, X,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { JourneyMap } from "@/components/JourneyMap";
import { LevelPlayer } from "@/components/LevelPlayer";
import { PurchaseTrackModal } from "@/components/PurchaseTrackModal";
import { MissionQuestModal } from "@/components/MissionQuestModal";
import { ProtectedVideoPlayer } from "@/components/ProtectedVideoPlayer";
import { Nuru } from "@/components/Nuru";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import { useGameStore, isTrackUnlocked } from "@/lib/store";
import type { TrackId } from "@/lib/store";
import type { JourneyNode, Lesson, DailyChallenge } from "@/lib/types";

import type { CourseModule } from "@/lib/types";

function nodesOf(mod: CourseModule): JourneyNode[] {
  return [
    ...mod.lessons.map((l) => ({ ...l, kind: "lesson" as const })),
    ...(mod.quiz ? [{ kind: "quest" as const, title: "Mission Quest", quest: mod.quiz }] : []),
  ];
}

function isAdvancedModule(moduleIdx: number) {
  return moduleIdx > 0;
}

type LearningTab = "lesson" | "video" | "notes" | "challenge";

const TAB_META: { id: LearningTab; label: string; icon: typeof BookOpen }[] = [
  { id: "lesson",    label: "Lesson",          icon: BookOpen },
  { id: "video",     label: "Video Tutorial",  icon: Video },
  { id: "notes",     label: "Notes",           icon: FileText },
  { id: "challenge", label: "Daily Challenge", icon: Zap },
];

function DailyChallengePanel({
  challenge, tone, lessonTitle, onComplete,
}: {
  challenge: DailyChallenge;
  tone: string;
  lessonTitle: string;
  onComplete: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | string | null>(null);
  const [shortVal, setShortVal] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [claimed, setClaimed] = useState(false);

  function submit() {
    if (challenge.type === "mcq" && picked === null) return;
    if (challenge.type === "short" && !shortVal.trim()) return;
    setRevealed(true);
  }

  const isCorrect = challenge.type === "mcq"
    ? picked === challenge.correct
    : typeof challenge.correct === "string"
      ? shortVal.trim().toLowerCase().includes(challenge.correct.toLowerCase())
      : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 p-4 rounded-2xl border-2" style={{ borderColor: tone, background: `${tone}0C` }}>
        <Zap size={20} style={{ color: tone }} className="shrink-0" />
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: tone }}>
            Daily Challenge · {lessonTitle}
          </div>
          <div className="text-xs text-nuru-muted mt-0.5">Answer correctly to earn +{challenge.xpReward} bonus XP</div>
        </div>
      </div>

      <div className="bg-nuru-card rounded-2xl p-5 border border-nuru-line shadow-card">
        <p className="font-semibold text-nuru-ink text-base leading-relaxed mb-4">{challenge.question}</p>

        {challenge.hint && !revealed && (
          <p className="text-xs text-nuru-muted italic mb-3">💡 Hint: {challenge.hint}</p>
        )}

        {challenge.type === "mcq" && challenge.options && (
          <div className="flex flex-col gap-2 mb-4">
            {challenge.options.map((opt, i) => {
              let cls = "border-nuru-line bg-nuru-bg text-nuru-ink hover:border-nuru-purple/40";
              if (revealed) {
                if (i === challenge.correct) cls = "border-nuru-green bg-green-50 text-nuru-green font-bold";
                else if (i === picked) cls = "border-nuru-rose bg-red-50 text-nuru-rose";
                else cls = "border-nuru-line bg-nuru-bg text-nuru-muted opacity-50";
              } else if (picked === i) {
                cls = "border-nuru-purple bg-nuru-lav text-nuru-ink";
              }
              return (
                <button
                  key={i}
                  onClick={() => !revealed && setPicked(i)}
                  disabled={revealed}
                  className={`text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {challenge.type === "short" && (
          <div className="mb-4">
            <input
              value={shortVal}
              onChange={(e) => setShortVal(e.target.value)}
              disabled={revealed}
              placeholder="Type your answer…"
              maxLength={200}
              className="w-full bg-nuru-bg border-2 border-nuru-line rounded-xl px-4 py-3 text-sm outline-none focus:border-nuru-purple transition-colors disabled:opacity-60"
            />
          </div>
        )}

        {!revealed ? (
          <button
            onClick={submit}
            className="w-full py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: tone }}
          >
            Submit Answer
          </button>
        ) : (
          <div className={`rounded-xl p-4 mb-3 ${isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <div className={`font-bold text-sm mb-1 ${isCorrect ? "text-nuru-green" : "text-nuru-rose"}`}>
              {isCorrect ? "✓ Correct!" : "✗ Not quite"}
            </div>
            {challenge.hint && (
              <p className="text-xs text-nuru-ink2 leading-relaxed">
                {isCorrect ? `Great work. ${challenge.hint}` : `The answer: ${challenge.correct}. ${challenge.hint}`}
              </p>
            )}
            {!claimed && (
              <button
                onClick={() => { setClaimed(true); onComplete(isCorrect); }}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
                style={{ background: tone }}
              >
                <Sparkles size={14} />
                {isCorrect ? `Claim +${challenge.xpReward} XP` : "Continue"}
              </button>
            )}
            {claimed && <p className="text-xs font-semibold text-nuru-purple mt-2">✓ Reward claimed</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function NotesPanel({ lesson, tone }: { lesson: Lesson; tone: string }) {
  const notes = lesson.notes ?? [
    `# ${lesson.title}`,
    ``,
    `**Objective:** ${lesson.objective}`,
    ``,
    `## ${lesson.block1.topic}`,
    ...lesson.block1.points.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `## ${lesson.block2.topic}`,
    ...lesson.block2.points.map((p, i) => `${i + 1}. ${p}`),
    ...(lesson.demo ? [``, `## Try It`, lesson.demo] : []),
    ...(lesson.homework ? [``, `## Homework`, lesson.homework] : []),
  ].join("\n");

  function renderNotes(md: string) {
    return md.split("\n").map((line, i) => {
      if (line.startsWith("# ")) {
        return <h1 key={i} className="font-display font-extrabold text-xl text-nuru-ink mb-2">{line.slice(2)}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={i} className="font-bold text-base mt-4 mb-2" style={{ color: tone }}>{line.slice(3)}</h2>;
      }
      if (/^\d+\.\s/.test(line)) {
        const [num, ...rest] = line.split(". ");
        return (
          <div key={i} className="flex gap-2.5 mb-2">
            <span className="w-5 h-5 rounded-full grid place-items-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: tone }}>
              {num}
            </span>
            <p className="text-sm text-nuru-ink2 leading-relaxed">{renderInline(rest.join(". "))}</p>
          </div>
        );
      }
      if (line === "") return <div key={i} className="h-1" />;
      return <p key={i} className="text-sm text-nuru-ink2 leading-relaxed mb-1.5">{renderInline(line)}</p>;
    });
  }

  function renderInline(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((p, i) =>
      i % 2 === 1
        ? <strong key={i} className="font-semibold text-nuru-ink">{p}</strong>
        : p
    );
  }

  return (
    <div className="bg-nuru-card rounded-2xl p-6 border border-nuru-line shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: tone }}>
          Study Notes · Day {lesson.day}
        </div>
        <button
          onClick={() => {
            const blob = new Blob([notes], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = `${lesson.title.replace(/\s+/g, "-")}-notes.txt`; a.click();
          }}
          className="text-xs font-semibold text-nuru-purple hover:underline flex items-center gap-1"
        >
          <FileText size={12} /> Download notes
        </button>
      </div>
      <div className="prose-nuru space-y-0.5">{renderNotes(notes)}</div>
    </div>
  );
}

function AdvancedPaywall({
  trackName, priceTZS, tone,
  onUnlock, onClose,
}: {
  trackName: string; priceTZS: string; tone: string;
  onUnlock: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] bg-nuru-ink/70 backdrop-blur-sm grid place-items-center p-5" onClick={onClose}>
      <div className="bg-nuru-card rounded-3xl w-full max-w-md p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-nuru-lav grid place-items-center text-nuru-muted hover:text-nuru-ink">
          <X size={15} />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl grid place-items-center mb-4" style={{ background: `${tone}18` }}>
            <Lock size={28} style={{ color: tone }} />
          </div>
          <h2 className="font-display font-extrabold text-xl text-nuru-ink mb-2">Advanced Content</h2>
          <p className="text-sm text-nuru-muted leading-relaxed mb-1">
            Weeks 2–5 of <strong>{trackName}</strong> are included in the full track.
          </p>
          <p className="text-sm text-nuru-muted leading-relaxed mb-5">
            Unlock everything — videos, notes, daily challenges, and all Mission Quests — for:
          </p>
          <div className="bg-nuru-lav rounded-2xl px-6 py-4 mb-6 w-full">
            <div className="font-display font-extrabold text-3xl text-nuru-ink">TZS {priceTZS}</div>
            <div className="text-xs text-nuru-muted mt-1">One-time · All 5 weeks included · Mobile money (M-Pesa, Tigo, Airtel, HaloPesa)</div>
          </div>
          <div className="space-y-2 text-left w-full mb-6">
            {[
              "All 5 weeks · 25 lessons",
              "Protected video tutorials",
              "Printable study notes",
              "Daily challenge XP bonuses",
              "4 more Mission Quests",
              "Certificate of completion",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-nuru-ink">
                <CheckCircle2 size={15} className="text-nuru-green shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <button
            onClick={onUnlock}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-base"
            style={{ background: tone }}
          >
            <CreditCard size={18} /> Unlock Full Track
          </button>
          <button onClick={onClose} className="mt-3 text-xs text-nuru-muted hover:text-nuru-ink transition-colors">
            Continue with Week 1 (free preview)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const { tracks: TRACKS } = useTracks();
  const activeTrack        = useGameStore((s) => s.activeTrack);
  const setActiveTrack     = useGameStore((s) => s.setActiveTrack);
  const activeModuleIdx    = useGameStore((s) => {
    const idx = s.activeModuleIdx;
    return (typeof idx === "object" && idx !== null)
      ? ((idx as Record<string, number>)[activeTrack] ?? 0)
      : 0;
  });
  const setActiveModuleIdx = useGameStore((s) => s.setActiveModuleIdx);
  const progress           = useGameStore((s) => s.progress[activeTrack]);
  const completeLesson     = useGameStore((s) => s.completeLesson);
  const passMission        = useGameStore((s) => s.passMission);
  const missionsPassed     = useGameStore((s) => s.missionsPassed);
  const purchasedTracks    = useGameStore((s) => s.purchasedTracks);
  const advanceQuest       = useGameStore((s) => s.advanceQuest);
  const claimQuestReward   = useGameStore((s) => s.claimQuestReward);
  const loadTodayQuests    = useGameStore((s) => s.loadTodayQuests);
  const logStudyMinutes    = useGameStore((s) => s.logStudyMinutes);

  const [lessonOpen, setLessonOpen]     = useState<{ lesson: Lesson; done?: boolean } | null>(null);
  const [activeTab, setActiveTab]       = useState<LearningTab>("lesson");
  const [purchaseTarget, setPurchaseTarget] = useState<{
    id: string; name: string; priceTZS: string; tone: string;
  } | null>(null);
  const [showPaywall, setShowPaywall]   = useState(false);
  const [questOpen, setQuestOpen]       = useState(false);

  // Guard: wait for tracks to load from DB
  if (!TRACKS || TRACKS.length === 0) {
    return (
      <Shell>
        <TopBar title="My Courses" subtitle="Loading…" />
        <div className="flex items-center justify-center py-20 text-nuru-muted text-sm">Loading courses…</div>
      </Shell>
    );
  }

  const track = TRACKS.find((t) => t.id === activeTrack) ?? TRACKS[0];
  if (!track) {
    return (
      <Shell>
        <TopBar title="My Courses" subtitle="Loading…" />
        <div className="flex items-center justify-center py-20 text-nuru-muted text-sm">Loading courses…</div>
      </Shell>
    );
  }
  const safeModuleIdx = Math.min(activeModuleIdx, track.modules.length - 1);
  const mod   = track.modules[safeModuleIdx];
  const nodes = nodesOf(mod);
  const cur   = Math.min(progress, nodes.length);

  const isTrackPaid = isTrackUnlocked(activeTrack, missionsPassed, purchasedTracks);
  const moduleGated = isAdvancedModule(activeModuleIdx) && !isTrackPaid;

  const curNode   = nodes[Math.min(cur, nodes.length - 1)];
  const isQuestUp = curNode?.kind === "quest";

  function onNode(i: number, status: "done" | "current" | "locked", node: JourneyNode) {
    if (status === "locked") return;
    if (node.kind === "quest") {
      if (moduleGated) { setShowPaywall(true); return; }
      if (status === "current") setQuestOpen(true);
    } else {
      if (moduleGated) { setShowPaywall(true); return; }
      setLessonOpen({ lesson: node, done: status === "done" });
      setActiveTab("lesson");
    }
  }

  function openCurrent() {
    if (!curNode) return;
    if (moduleGated) { setShowPaywall(true); return; }
    if (curNode.kind === "quest") setQuestOpen(true);
    else { setLessonOpen({ lesson: curNode, done: false }); setActiveTab("lesson"); }
  }

  function selectModule(idx: number) {
    const advanced = isAdvancedModule(idx);
    const unlocked = isTrackUnlocked(activeTrack, missionsPassed, purchasedTracks);
    const canOpen  = idx === 0 || missionsPassed[`${activeTrack}:${track.modules[idx - 1].id}`] || idx <= activeModuleIdx;
    if (!canOpen) return;
    if (advanced && !unlocked) { setShowPaywall(true); return; }
    setActiveModuleIdx(activeTrack, idx);
  }

  return (
    <Shell>
      <TopBar title="My Courses" subtitle="Learn through lessons, video tutorials, notes, and daily challenges." />

      <div className="flex gap-2 mb-5 flex-wrap">
        {TRACKS.map((t) => {
          const on       = t.id === activeTrack;
          const unlocked = isTrackUnlocked(t.id as TrackId, missionsPassed, purchasedTracks);
          return (
            <button
              key={t.id}
              onClick={() =>
                unlocked
                  ? setActiveTrack(t.id as TrackId)
                  : setPurchaseTarget({ id: t.id, name: t.name, priceTZS: t.priceTZS, tone: t.tone })
              }
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all ${
                on
                  ? "bg-nuru-purple text-white shadow-pop"
                  : unlocked
                  ? "bg-nuru-card text-nuru-ink2 border border-nuru-line hover:border-nuru-purple/40"
                  : "bg-nuru-lav text-nuru-muted hover:bg-nuru-purple/10"
              }`}
            >
              {!unlocked && <Lock size={13} />}
              {t.subtitle}
            </button>
          );
        })}
      </div>

      {purchaseTarget && (
        <PurchaseTrackModal
          trackId={purchaseTarget.id}
          trackName={purchaseTarget.name}
          priceTZS={purchaseTarget.priceTZS}
          tone={purchaseTarget.tone}
          onClose={() => setPurchaseTarget(null)}
          onUnlocked={() => { setActiveTrack(purchaseTarget.id as TrackId); setPurchaseTarget(null); }}
        />
      )}

      <div className="bg-nuru-card rounded-2xl p-3.5 mb-5 shadow-card border border-nuru-line">
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {track.modules.map((m, i) => {
            const passed   = missionsPassed[`${track.id}:${m.id}`];
            const active   = i === activeModuleIdx;
            const canOpen  = i === 0 || missionsPassed[`${track.id}:${track.modules[i - 1].id}`] || i <= activeModuleIdx;
            const isLocked = isAdvancedModule(i) && !isTrackPaid;
            return (
              <button
                key={m.id}
                onClick={() => selectModule(i)}
                className={`text-left px-3.5 py-2.5 rounded-xl shrink-0 min-w-[150px] border transition-all ${
                  active ? "border-transparent shadow-sm" : "bg-nuru-card border-nuru-line"
                } ${!canOpen && !isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                style={active ? { background: `${track.tone}18`, borderColor: track.tone } : undefined}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase"
                  style={{ color: passed ? "#DE9E1F" : active ? track.tone : "#8B87A0" }}>
                  {passed ? <Medal size={12} /> : isLocked ? <Lock size={12} /> : !canOpen ? <Lock size={12} /> : null}
                  Week {m.week}
                  {isLocked && <span className="ml-auto text-[9px] font-bold bg-nuru-purple/20 text-nuru-purple px-1.5 rounded-full">PRO</span>}
                </div>
                <div className="font-semibold text-[13px] mt-0.5 leading-tight"
                  style={{ color: canOpen || isLocked ? "#1F1B2E" : "#8B87A0" }}>
                  {m.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {moduleGated && (
        <div className="rounded-2xl p-4 mb-5 flex items-center gap-4 border-2"
          style={{ borderColor: track.tone, background: `${track.tone}0A` }}>
          <AlertTriangle size={20} style={{ color: track.tone }} className="shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-sm text-nuru-ink">Advanced content — subscription required</div>
            <div className="text-xs text-nuru-muted mt-0.5">
              Unlock all 5 weeks — videos, notes, challenges, and quests — for TZS {track.priceTZS}.
            </div>
          </div>
          <button
            onClick={() => setPurchaseTarget({ id: track.id, name: track.name, priceTZS: track.priceTZS, tone: track.tone })}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 flex items-center gap-1.5"
            style={{ background: track.tone }}
          >
            <CreditCard size={14} /> Unlock
          </button>
        </div>
      )}

      <div className="rounded-2xl p-5 mb-5 flex items-center gap-5 shadow-card border border-nuru-line flex-wrap"
        style={{ background: `linear-gradient(90deg, ${track.tone}0F, white 60%)` }}>
        <div className="shrink-0"><Nuru size={62} /></div>
        <div className="flex-1 min-w-[220px]">
          {isQuestUp ? (
            <>
              <div className="text-[11px] font-bold tracking-wide uppercase text-nuru-goldDeep">Mission Quest ready</div>
              <div className="font-semibold text-base mt-0.5">
                Prove Week {mod.week}: <span style={{ color: track.tone }}>{mod.name}</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] font-bold tracking-wide uppercase" style={{ color: track.tone }}>Next up</div>
              <div className="font-semibold text-base mt-0.5">
                Day {curNode && "day" in curNode ? curNode.day : "—"} —{" "}
                <span style={{ color: track.tone }}>{curNode?.title ?? "Week complete"}</span>
              </div>
            </>
          )}
        </div>
        <button
          onClick={openCurrent}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 shrink-0"
          style={{ background: isQuestUp ? "#F5B942" : track.tone }}
        >
          {moduleGated ? <Lock size={15} /> : isQuestUp ? <Swords size={15} /> : <Play size={14} fill="white" />}
          {moduleGated ? "Unlock to access" : isQuestUp ? "Begin quest" : "Open lesson"}
        </button>
      </div>

      <div className="bg-nuru-card rounded-2xl pt-4 pb-6 shadow-card border border-nuru-line mb-5">
        <div className="px-5 pb-3.5">
          <div className="text-[11px] font-bold tracking-wide uppercase" style={{ color: track.tone }}>
            Week {mod.week} — {mod.name}
          </div>
          <div className="text-[13px] text-nuru-muted mt-0.5">{mod.tagline}</div>
        </div>
        <JourneyMap nodes={nodes} cur={moduleGated ? 0 : cur} tone={track.tone} onNode={onNode} />
        <div className="text-center text-xs text-nuru-muted mt-1 px-6">
          {moduleGated
            ? "Unlock this week to access all content"
            : "Tap any level to review or open its content. Gold rings mark the week's Mission Quest."}
        </div>
      </div>

      {lessonOpen && !moduleGated && (
        <div className="fixed inset-0 z-[80] bg-nuru-ink/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setLessonOpen(null)}>
          <div className="bg-nuru-bg w-full max-w-3xl rounded-3xl shadow-2xl my-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-white rounded-t-3xl relative"
              style={{ background: `linear-gradient(135deg, ${track.tone}, #241033)` }}>
              <button onClick={() => setLessonOpen(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/15 grid place-items-center hover:bg-white/25">
                <X size={15} />
              </button>
              <div className="text-[11px] font-bold tracking-widest uppercase opacity-75">
                {track.subtitle} · Week {mod.week} · Day {lessonOpen.lesson.day}
              </div>
              <h2 className="font-display font-bold text-2xl mt-1 pr-10 leading-tight">{lessonOpen.lesson.title}</h2>
              <p className="text-white/75 text-sm mt-1.5 leading-relaxed">{lessonOpen.lesson.objective}</p>
            </div>

            <div className="flex border-b border-nuru-line bg-nuru-card px-4 gap-1 overflow-x-auto">
              {TAB_META.filter((tab) => {
                if (tab.id === "video" && !lessonOpen.lesson.videoId) return false;
                return true;
              }).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === id ? "border-nuru-purple text-nuru-purple" : "border-transparent text-nuru-muted hover:text-nuru-ink"
                  }`}>
                  <Icon size={14} />
                  {label}
                  {id === "challenge" && lessonOpen.lesson.dailyChallenge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-nuru-purple ml-0.5" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {activeTab === "lesson" && (
                <LevelPlayer
                  lesson={lessonOpen.lesson}
                  tone={track.tone}
                  trackLabel={track.subtitle}
                  moduleLabel={`Week ${mod.week}`}
                  done={lessonOpen.done}
                  onClose={() => setLessonOpen(null)}
                  onComplete={async (elapsedMinutes) => {
                    completeLesson(activeTrack);
                    logStudyMinutes(elapsedMinutes);
                    setLessonOpen(null);
                    const supabase = createClient();
                    await supabase.rpc("complete_lesson", { p_track_id: activeTrack, p_minutes: elapsedMinutes });
                    const lessonResult = await advanceQuest("lesson");
                    if (lessonResult.justCompleted) console.log("Lesson quest completed — reward available to claim");
                    await advanceQuest("study20", elapsedMinutes);
                    await loadTodayQuests();
                  }}
                  inline
                />
              )}

              {activeTab === "video" && lessonOpen.lesson.videoId && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase" style={{ color: track.tone }}>
                    <Video size={13} />
                    Video Tutorial · {lessonOpen.lesson.videoTitle ?? lessonOpen.lesson.title}
                  </div>
                  <ProtectedVideoPlayer videoId={lessonOpen.lesson.videoId} title={lessonOpen.lesson.videoTitle ?? lessonOpen.lesson.title} />
                  <div className="bg-nuru-lav rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <Lock size={13} className="text-nuru-purple shrink-0 mt-0.5" />
                    <p className="text-xs text-nuru-ink2 leading-relaxed">
                      This video is protected. Right-click, downloading, and screen recording are blocked.
                      The stream link expires in 60 seconds and cannot be shared.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "notes" && <NotesPanel lesson={lessonOpen.lesson} tone={track.tone} />}

              {activeTab === "challenge" && (
                lessonOpen.lesson.dailyChallenge ? (
                  <DailyChallengePanel
                    challenge={lessonOpen.lesson.dailyChallenge}
                    tone={track.tone}
                    lessonTitle={lessonOpen.lesson.title}
                    onComplete={async (correct) => {
                      if (correct) {
                        const result = await advanceQuest("challenge");
                        if (result.justCompleted) console.log("Daily challenge quest completed — reward claimable");
                        await loadTodayQuests();
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-nuru-lav grid place-items-center mb-4">
                      <Zap size={24} className="text-nuru-purple" />
                    </div>
                    <h3 className="font-bold text-nuru-ink mb-1">No challenge today</h3>
                    <p className="text-sm text-nuru-muted max-w-xs leading-relaxed">
                      Daily challenges are being added for this lesson. Check back soon!
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showPaywall && (
        <AdvancedPaywall
          trackName={track.name}
          priceTZS={track.priceTZS}
          tone={track.tone}
          onClose={() => setShowPaywall(false)}
          onUnlock={() => {
            setShowPaywall(false);
            setPurchaseTarget({ id: track.id, name: track.name, priceTZS: track.priceTZS, tone: track.tone });
          }}
        />
      )}

      {questOpen && mod.quiz && (
        <MissionQuestModal
          quiz={mod.quiz}
          moduleId={`${activeTrack}:${mod.id}`}
          tone={track.tone}
          weekLabel={`Week ${mod.week}`}
          onClose={() => setQuestOpen(false)}
          onFinish={async (passed, pct) => {
            if (passed) {
              passMission(activeTrack, mod.id, pct);
              const result = await advanceQuest("quiz");
              if (result.justCompleted) console.log("Quiz quest completed — reward claimable");
              await loadTodayQuests();
              if (activeModuleIdx < track.modules.length - 1) {
                setTimeout(() => setActiveModuleIdx(activeTrack, activeModuleIdx + 1), 700);
              }
            }
            setQuestOpen(false);
          }}
        />
      )}
    </Shell>
  );
}
