"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDuelRoom, getDuelParticipants, queueForRandomDuel, leaveDuelQueue, subscribeDuelRoom, type DuelRoom } from "@/lib/supabase/duels";

/**
 * Two real modes in one screen:
 *  - roomId is a real id: friend-invite room, waiting for others to join.
 *    Subscribed live via Realtime — the instant someone else joins and
 *    the room fills, this reacts immediately, no polling.
 *  - roomId === "queue": random matchmaking. There's no room yet to
 *    subscribe to (queue_for_random_duel only creates one once matched),
 *    so this polls the same RPC every few seconds until it returns
 *    'matched' — that's the real, tested match-or-wait behavior from
 *    schema.sql, not a UI-only simulation.
 */
export function DuelWaitingRoom({
  roomId, quizId, mode, onMatched, onCancel,
}: {
  roomId: string;
  quizId: string;
  mode: "1v1" | "group";
  onMatched: (roomId: string) => void;
  onCancel: () => void;
}) {
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    if (roomId === "queue") {
      pollRef.current = setInterval(async () => {
        try {
          const result = await queueForRandomDuel(supabase, mode, quizId);
          if (result.status === "matched" && result.room_id) {
            if (pollRef.current) clearInterval(pollRef.current);
            onMatched(result.room_id);
          }
        } catch {
          // transient — keep polling, next tick may succeed
        }
      }, 3000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }

    let cancelled = false;
    async function refresh() {
      try {
        const [r, participants] = await Promise.all([
          getDuelRoom(supabase, roomId),
          getDuelParticipants(supabase, roomId),
        ]);
        if (cancelled) return;
        setRoom(r);
        setParticipantCount(participants.length);
        setLoadError(null);
        if (r.status === "active") onMatched(roomId);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Couldn't load this duel.");
        }
      }
    }
    refresh();

    const unsubscribe = subscribeDuelRoom(supabase, roomId, refresh, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function handleCancel() {
    if (roomId === "queue") {
      const supabase = createClient();
      await leaveDuelQueue(supabase, mode, quizId);
    }
    onCancel();
  }

  function copyCode() {
    if (!room?.invite_code) return;
    navigator.clipboard.writeText(room.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="max-w-md mx-auto bg-nuru-card rounded-2xl2 p-8 shadow-card border border-nuru-line text-center">
      <Loader2 size={32} className="animate-spin text-nuru-purple mx-auto mb-4" />

      {roomId === "queue" ? (
        <>
          <h2 className="font-display font-bold text-lg text-nuru-ink mb-1">Searching for an opponent…</h2>
          <p className="text-sm text-nuru-muted">This updates automatically the moment someone&apos;s found.</p>
        </>
      ) : (
        <>
          <h2 className="font-display font-bold text-lg text-nuru-ink mb-1">Waiting for players</h2>
          <p className="text-sm text-nuru-muted mb-4">
            {participantCount} / {room?.max_players ?? "?"} joined — share this code:
          </p>
          <button
            onClick={copyCode}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-nuru-bg border-2 border-dashed border-nuru-purple/40 font-display font-bold text-2xl tracking-[0.2em] text-nuru-purpleDeep mb-1"
          >
            {room?.invite_code ?? "······"}
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <p className="text-xs text-nuru-muted">{copied ? "Copied!" : "Tap to copy"}</p>
        </>
      )}

      {loadError && <p className="text-sm text-nuru-rose mt-4">{loadError}</p>}

      <button
        onClick={handleCancel}
        className="flex items-center justify-center gap-1.5 mx-auto mt-6 text-sm font-semibold text-nuru-muted hover:text-nuru-rose"
      >
        <X size={14} /> Cancel
      </button>
    </div>
  );
}
