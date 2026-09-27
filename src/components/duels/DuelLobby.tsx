"use client";

import { useState } from "react";
import { Users, User, Link2, Shuffle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getQuizIdForModule } from "@/lib/supabase/queries";
import { createDuelRoom, joinDuelRoom, queueForRandomDuel } from "@/lib/supabase/duels";
import { TRACKS } from "@/data/curriculum";

const WEEK_1_MODULE: Record<string, string> = { beginner: "b1", intermediate: "i1", expert: "e1" };

export function DuelLobby({
  onEnterRoom,
}: {
  onEnterRoom: (roomId: string, quizId: string, mode: "1v1" | "group") => void;
}) {
  const [trackId, setTrackId] = useState("beginner");
  const [mode, setMode] = useState<"1v1" | "group">("1v1");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  async function resolveQuizId(): Promise<string | null> {
    const supabase = createClient();
    return getQuizIdForModule(supabase, `${trackId}:${WEEK_1_MODULE[trackId]}`);
  }

  async function handleCreate() {
    setError(null);
    setBusy("create");
    try {
      const supabase = createClient();
      const quizId = await resolveQuizId();
      if (!quizId) throw new Error("Couldn't find that track's quiz.");
      const result = await createDuelRoom(supabase, mode, quizId);
      onEnterRoom(result.room_id, quizId, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the duel.");
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setError(null);
    setBusy("join");
    try {
      const supabase = createClient();
      const result = await joinDuelRoom(supabase, joinCode.trim());
      onEnterRoom(result.room_id, result.quiz_id, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work — check it and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleQueue() {
    setError(null);
    setBusy("queue");
    try {
      const supabase = createClient();
      const quizId = await resolveQuizId();
      if (!quizId) throw new Error("Couldn't find that track's quiz.");
      const result = await queueForRandomDuel(supabase, mode, quizId);
      if (result.status === "matched" && result.room_id) {
        onEnterRoom(result.room_id, quizId, mode);
      } else {
        onEnterRoom("queue", quizId, mode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join the queue.");
      setBusy(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-nuru-card rounded-2xl2 p-6 shadow-card border border-nuru-line">
        <h2 className="font-display font-bold text-lg text-nuru-ink mb-1">Start a Flashcard Duel</h2>
        <p className="text-sm text-nuru-muted mb-5">Race a friend or a random opponent through real quiz questions.</p>

        <div className="mb-4">
          <div className="text-xs font-bold text-nuru-muted uppercase tracking-wide mb-2">Track</div>
          <div className="grid grid-cols-3 gap-2">
            {TRACKS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTrackId(t.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  trackId === t.id ? "text-white" : "bg-nuru-bg text-nuru-ink2"
                }`}
                style={trackId === t.id ? { background: t.tone } : undefined}
              >
                {t.subtitle}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-xs font-bold text-nuru-muted uppercase tracking-wide mb-2">Duel size</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("1v1")}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                mode === "1v1" ? "bg-nuru-purple text-white" : "bg-nuru-bg text-nuru-ink2"
              }`}
            >
              <User size={15} /> 1v1
            </button>
            <button
              onClick={() => setMode("group")}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                mode === "group" ? "bg-nuru-purple text-white" : "bg-nuru-bg text-nuru-ink2"
              }`}
            >
              <Users size={15} /> Group (up to 4)
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-nuru-rose mb-4">{error}</p>}

        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleQueue}
            disabled={!!busy}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ background: track.tone }}
          >
            {busy === "queue" ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
            Find a random opponent
          </button>
          <button
            onClick={handleCreate}
            disabled={!!busy}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-nuru-line font-bold text-sm text-nuru-ink disabled:opacity-60"
          >
            {busy === "create" ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Create a link to challenge a friend
          </button>
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-nuru-line flex-1" />
          <span className="text-xs text-nuru-muted font-semibold">or join with a code</span>
          <div className="h-px bg-nuru-line flex-1" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            maxLength={6}
            className="flex-1 px-4 py-2.5 rounded-xl bg-nuru-bg border border-nuru-line text-sm font-bold tracking-wide text-center outline-none focus:ring-2 focus:ring-nuru-purple/30"
          />
          <button
            onClick={handleJoin}
            disabled={!!busy || !joinCode.trim()}
            className="px-5 py-2.5 rounded-xl bg-nuru-ink text-white text-sm font-bold disabled:opacity-40"
          >
            {busy === "join" ? <Loader2 size={16} className="animate-spin" /> : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
