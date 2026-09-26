"use client";

import { useEffect, useState } from "react";
import { Trophy, RotateCcw, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDuelParticipants, type DuelParticipant } from "@/lib/supabase/duels";

const MEDAL = ["#F5B942", "#C7CBD1", "#C77A3B", "#8B87A0"];

export function DuelResults({ roomId, onRematch }: { roomId: string; onRematch: () => void }) {
  const [participants, setParticipants] = useState<DuelParticipant[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        setMyUserId(user?.id ?? null);

        const ps = await getDuelParticipants(supabase, roomId);
        ps.sort((a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99));
        if (cancelled) return;
        setParticipants(ps);

        const { data: stats } = await supabase
          .from("player_stats")
          .select("user_id, display_name")
          .in("user_id", ps.map((p) => p.user_id));
        if (cancelled) return;
        if (stats) {
          const map: Record<string, string> = {};
          stats.forEach((s) => { map[s.user_id] = s.display_name; });
          setNames(map);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load the results.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto flex items-center justify-center gap-2 py-16 text-nuru-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading results…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto bg-nuru-card rounded-2xl2 p-6 shadow-card border border-nuru-line text-center">
        <p className="text-sm text-nuru-rose mb-4">{error}</p>
        <button onClick={onRematch} className="px-5 py-2.5 rounded-xl bg-nuru-purple text-white text-sm font-bold">
          Back to Arena
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-nuru-card rounded-2xl2 p-6 shadow-card border border-nuru-line">
      <div className="text-center mb-5">
        <Trophy size={32} className="text-nuru-gold mx-auto mb-2" />
        <h2 className="font-display font-bold text-lg text-nuru-ink">Duel complete</h2>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {participants.map((p, i) => {
          const isMe = p.user_id === myUserId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl ${isMe ? "bg-nuru-lav" : "bg-nuru-bg"}`}
            >
              <span
                className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold shrink-0"
                style={{ background: MEDAL[i] ?? "#8B87A0" }}
              >
                {p.final_rank ?? i + 1}
              </span>
              <span className={`text-sm font-semibold flex-1 ${isMe ? "text-nuru-purpleDeep" : "text-nuru-ink"}`}>
                {names[p.user_id] ?? "…"}{isMe ? " (You)" : ""}
              </span>
              <span className="text-xs text-nuru-muted font-semibold">{p.correct_count} correct</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onRematch}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-nuru-purple text-white font-bold text-sm"
      >
        <RotateCcw size={15} /> New duel
      </button>
    </div>
  );
}
