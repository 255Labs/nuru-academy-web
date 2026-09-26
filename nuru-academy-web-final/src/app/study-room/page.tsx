"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { Nuru } from "@/components/Nuru";
import { useGameStore } from "@/lib/store";

interface Msg { role: "user" | "assistant"; text: string; }

const PROMPTS = [
  "Explain what a prompt actually is",
  "Quiz me on Week 1 basics",
  "Summarise Day 2 for me",
  "What's a good first prompt for a duka owner?",
];

export default function StudyRoomPage() {
  return (
    <Suspense fallback={null}>
      <StudyRoomContent />
    </Suspense>
  );
}

function StudyRoomContent() {
  const searchParams = useSearchParams();
  const displayName = useGameStore((s) => s.profile.displayName);
  const avatarKey = useGameStore((s) => s.profile.avatarKey);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I'm Nuru. I can explain a lesson, quiz you, build flashcards, or draft a study plan. What are we working on today?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const askedFromQuery = useRef(false);

  // Arriving from the dashboard hero's "Ask Nuru anything" input — pick up
  // the real typed question via ?q= and send it immediately, so that
  // input isn't just a decorative redirect.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !askedFromQuery.current) {
      askedFromQuery.current = true;
      ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    scroller.current?.scrollTo(0, scroller.current.scrollHeight);
  }, [msgs, busy]);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    const history = [...msgs, { role: "user" as const, text }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    try {
      // Calls our own server route — the Anthropic API key never reaches
      // the browser. See src/app/api/chat/route.ts.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      if (res.status === 401) {
        setMsgs((m) => [...m, { role: "assistant", text: "Your session expired — please sign in again to keep chatting." }]);
        return;
      }
      if (res.status === 429) {
        const data = await res.json().catch(() => null);
        setMsgs((m) => [...m, { role: "assistant", text: data?.error ?? "You're sending messages too quickly — please wait a few minutes." }]);
        return;
      }
      const data = await res.json();
      const reply = data.reply || "I wasn't able to generate a response. Please try again.";
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "I couldn't reach the service. Please check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <TopBar title="Study Room" subtitle="Ask Nuru anything about the Masterclass — explanations, quizzes, plans." />
      <div className="bg-nuru-card rounded-2xl2 shadow-card border border-nuru-line flex flex-col h-[600px] overflow-hidden">
        <div ref={scroller} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 items-end ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "user" ? (
                <div className="w-8 h-8 rounded-lg bg-nuru-ink text-white grid place-items-center font-bold text-xs shrink-0">{avatarKey}</div>
              ) : (
                <div className="shrink-0"><Nuru size={36} /></div>
              )}
              <div
                className={`max-w-[76%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-nuru-lav text-nuru-ink" : "bg-nuru-bg text-nuru-ink"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-3 items-end">
              <Nuru size={36} />
              <div className="px-4 py-3 rounded-2xl bg-nuru-bg text-nuru-muted text-sm">Thinking…</div>
            </div>
          )}
        </div>
        <div className="border-t border-nuru-line p-4">
          <div className="flex gap-2 flex-wrap mb-3">
            {PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => ask(p)}
                disabled={busy}
                className="border border-nuru-line bg-nuru-card text-nuru-ink2 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-nuru-lav transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              placeholder="Ask Nuru a question…"
              className="flex-1 border border-nuru-line rounded-xl px-4 py-3 text-sm text-nuru-ink"
            />
            <button
              onClick={() => ask(input)}
              disabled={busy}
              className="w-12 rounded-xl bg-nuru-purple text-white grid place-items-center shrink-0 disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
