"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadLeaderboard, loadMyRank, type LeaderboardRow } from "@/lib/supabase/queries";
import { useT } from "@/lib/i18n";

const MEDAL_COLOR = ["#F5B942", "#C7CBD1", "#C77A3B"]; // gold, silver, bronze

/**
 * Real leaderboard, sourced from player_stats (any authenticated user may
 * read any row there — see schema.sql). No rank-change arrows here yet:
 * that needs a periodic snapshot table to compare against (a Growth-phase
 * addition), and showing a fake delta next to real ranks would be worse
 * than showing no delta at all.
 *
 * Also shows your own real rank even when you're outside the visible top
 * 10 — previously there was no indication of where you actually stood if
 * you weren't in the list.
 */
export function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; xp: number; totalPlayers: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setMyUserId(user?.id ?? null);
      if (user) loadMyRank(supabase, user.id).then(setMyRank);
    });
    loadLeaderboard(supabase, 10).then(setRows);
  }, []);

  const iAmInTopList = !!rows?.some((r) => r.userId === myUserId);
  const t = useT();

  return (
    <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-nuru-ink text-[15px]">{t("lb.title")}</h3>
        <Link href="/arena" className="text-xs font-semibold text-nuru-purple hover:underline">
          {t("lb.view_all")}
        </Link>
      </div>

      {!rows ? (
        <div className="flex items-center justify-center gap-2 py-8 text-nuru-muted text-sm">
          <Loader2 size={15} className="animate-spin" /> {t("lb.loading")}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-sm text-nuru-muted">
          {t("general.no_results")}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {rows.map((r, i) => {
              const rank = i + 1;
              const you = r.userId === myUserId;
              return (
                <div
                  key={r.userId}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-xl ${you ? "bg-nuru-lav" : ""}`}
                >
                  <div className="w-6 flex items-center justify-center">
                    {rank <= 3 ? (
                      <span
                        className="w-5 h-5 rounded-full grid place-items-center text-white text-[10px] font-bold"
                        style={{ background: MEDAL_COLOR[rank - 1] }}
                      >
                        {rank}
                      </span>
                    ) : (
                      <span className="text-sm text-nuru-muted font-semibold">{rank}</span>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nuru-violet to-nuru-purple shrink-0 grid place-items-center text-white text-xs font-bold">
                    {r.avatarKey}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate ${you ? "text-nuru-purpleDeep" : "text-nuru-ink"}`}>
                      {r.displayName}{you ? ` (${t("lb.you")})` : ""}
                    </div>
                    <div className="text-[11px] text-nuru-muted">{t("home.level").replace("{n}", String(r.level))}</div>
                  </div>
                  <div className="text-sm font-bold text-nuru-ink shrink-0 w-[74px] text-right">
                    {r.xp.toLocaleString()} XP
                  </div>
                </div>
              );
            })}
          </div>

          {!iAmInTopList && myRank && (
            <div className="mt-2 pt-2 border-t border-nuru-line flex items-center gap-3 px-2.5 py-2 rounded-xl bg-nuru-lav">
              <div className="w-6 flex items-center justify-center">
                <span className="text-sm text-nuru-purpleDeep font-bold">#{myRank.rank}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-nuru-purpleDeep">You</div>
                <div className="text-[11px] text-nuru-muted">of {myRank.totalPlayers} learners</div>
              </div>
              <div className="text-sm font-bold text-nuru-ink shrink-0 w-[74px] text-right">
                {myRank.xp.toLocaleString()} XP
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
