"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy, Clock, Users, Phone, ChevronRight, Zap, Monitor } from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

interface Competition {
  id: string;
  title: string;
  description: string;
  track_id: string;
  starts_at: string;
  ends_at: string;
  prize_desc: string | null;
  entry_fee_tzs: number;
  max_entries: number | null;
  status: "upcoming" | "active" | "ended";
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  phone_number: string;
  score: number;
  answers_given: number;
  completed: boolean;
  entry_source: "web" | "ussd";
  time_taken_secs: number | null;
}

export default function CompetePage() {
  const t = useT();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ussd_competitions")
      .select("*")
      .order("starts_at")
      .then(({ data }) => {
        setCompetitions(data ?? []);
        setLoading(false);
      });
  }, []);

  async function loadLeaderboard(compId: string) {
    setSelectedId(compId);
    setLbLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("competition_leaderboard", { p_competition_id: compId });
    setLeaderboard(data ?? []);
    setLbLoading(false);
  }

  function statusBadge(status: Competition["status"]) {
    const map = {
      active:   "bg-green-100 text-green-800",
      upcoming: "bg-amber-100 text-amber-800",
      ended:    "bg-gray-100 text-gray-500",
    };
    return map[status];
  }

  return (
    <Shell>
      <TopBar
        title={t("compete.title")}
        subtitle="Timed AI knowledge competitions — enter via the web or dial *278# from any phone."
      />

      {/* USSD highlight */}
      <div className="bg-gradient-to-r from-nuru-purple to-nuru-purpleDeep rounded-2xl p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/15 grid place-items-center shrink-0">
          <Phone size={22} className="text-white" />
        </div>
        <div>
          <div className="font-bold text-white text-[15px]">Compete from any phone</div>
          <div className="text-sm text-white/75 mt-0.5">{t("compete.ussd_hint")}</div>
        </div>
        <div className="ml-auto bg-white/20 rounded-xl px-4 py-2 shrink-0">
          <div className="text-white font-black text-lg tracking-wide">*278#</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-nuru-muted text-sm py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> {t("general.loading")}
        </div>
      ) : competitions.length === 0 ? (
        <div className="text-center py-16 text-nuru-muted text-sm">
          {t("compete.no_active")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Competition list */}
          <div className="space-y-4">
            {competitions.map((comp) => (
              <div
                key={comp.id}
                className={`bg-nuru-card rounded-2xl p-5 shadow-card border-2 transition-all cursor-pointer ${
                  selectedId === comp.id ? "border-nuru-purple" : "border-nuru-line hover:border-nuru-purple/40"
                }`}
                onClick={() => loadLeaderboard(comp.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nuru-lav grid place-items-center shrink-0">
                    <Zap size={18} className="text-nuru-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-nuru-ink text-[15px]">{comp.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusBadge(comp.status)}`}>
                        {comp.status}
                      </span>
                    </div>
                    <p className="text-sm text-nuru-ink2">{comp.description}</p>

                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-nuru-muted">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {comp.status === "upcoming"
                          ? t("compete.starts", { date: new Date(comp.starts_at).toLocaleDateString() })
                          : t("compete.ends", { date: new Date(comp.ends_at).toLocaleDateString() })}
                      </span>
                      <span className="flex items-center gap-1 capitalize">
                        <Users size={11} /> {comp.track_id} track
                      </span>
                      {comp.prize_desc && (
                        <span className="flex items-center gap-1 text-amber-600 font-semibold">
                          <Trophy size={11} /> {t("compete.prize", { desc: comp.prize_desc })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-nuru-muted shrink-0 mt-1" />
                </div>

                {comp.status === "active" && (
                  <a
                    href={`/compete/${comp.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block w-full mt-4 py-2.5 rounded-xl bg-nuru-purple text-white text-sm font-bold hover:bg-nuru-purpleDeep transition-colors text-center"
                  >
                    {t("compete.enter")} →
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Leaderboard panel */}
          <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line h-fit">
            <h2 className="font-display font-bold text-nuru-ink text-[15px] mb-4 flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              {t("compete.leaderboard")}
            </h2>

            {!selectedId ? (
              <div className="text-center py-8 text-nuru-muted text-sm">
                Select a competition to see the leaderboard.
              </div>
            ) : lbLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-nuru-muted" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8 text-nuru-muted text-sm">
                No entries yet — be the first!
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 20).map((entry) => (
                  <div
                    key={entry.rank}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                      entry.rank <= 3 ? "bg-nuru-lav" : "bg-nuru-bg"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                      entry.rank === 1 ? "bg-yellow-400 text-white"
                        : entry.rank === 2 ? "bg-gray-300 text-gray-700"
                          : entry.rank === 3 ? "bg-amber-600 text-white"
                            : "bg-nuru-line text-nuru-muted"
                    }`}>
                      {entry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-nuru-ink truncate">{entry.display_name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {entry.entry_source === "web"
                          ? <Monitor size={9} className="text-nuru-purple" />
                          : <Phone size={9} className="text-nuru-muted" />}
                        <span className="text-[10px] text-nuru-muted">
                          {entry.entry_source === "web" ? "Web" : "USSD"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-nuru-ink">{entry.score}</div>
                      <div className="text-[10px] text-nuru-muted">{entry.answers_given} answered</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
