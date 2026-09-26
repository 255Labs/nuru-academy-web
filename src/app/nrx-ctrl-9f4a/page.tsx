"use client";

import { useEffect, useState } from "react";
import { Users, Award, Trophy, DollarSign, Globe, BookOpen, Video, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import { PageHeader, StatCard, Card, Spinner } from "@/components/admin/ui";

interface Stats {
  total_learners: number;
  total_certs: number;
  total_revenue: number;
  total_competitions: number;
  total_videos: number;
  languages_in_use: number;
  avg_progress_pct: number;
  pending_mentors: number;
}

interface RevenueRow { track_id: string; total_tzs: number; }

export default function AdminDashboard() {
  const { tracks } = useTracks();
  const [stats, setStats] = useState<Stats | null>(null);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = createClient();
    Promise.all([
      s.rpc("admin_list_learners"),
      s.rpc("admin_list_certificates"),
      s.rpc("admin_revenue_summary"),
      s.from("ussd_competitions").select("id"),
      s.from("lesson_videos").select("id"),
      s.from("mentor_profiles").select("user_id").eq("approved", false),
    ]).then(([learners, certs, rev, comps, vids, mentors]) => {
      const lr = learners.data ?? [];
      const rv = (rev.data ?? []) as RevenueRow[];
      const totalRevenue = rv.reduce((a, r) => a + Number(r.total_tzs), 0);
      const langs = new Set(lr.map((l: { display_lang?: string }) => l.display_lang).filter(Boolean)).size;
      setStats({
        total_learners: lr.length,
        total_certs: (certs.data ?? []).length,
        total_revenue: totalRevenue,
        total_competitions: (comps.data ?? []).length,
        total_videos: (vids.data ?? []).length,
        languages_in_use: langs || 1,
        avg_progress_pct: 0,
        pending_mentors: (mentors.data ?? []).length,
      });
      setRevenue(rv);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  const totalRev = revenue.reduce((a, r) => a + Number(r.total_tzs), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Last updated ${new Date().toLocaleTimeString()}`} />

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}     label="Learners"        value={String(stats?.total_learners ?? 0)}   accent="#6B4EFF" />
        <StatCard icon={DollarSign} label="Revenue (TZS)"  value={`${((stats?.total_revenue ?? 0)/1000).toFixed(0)}K`} accent="#22C55E" />
        <StatCard icon={Award}     label="Certificates"    value={String(stats?.total_certs ?? 0)}      accent="#F5B942" />
        <StatCard icon={Trophy}    label="Competitions"    value={String(stats?.total_competitions ?? 0)} accent="#EF4444" />
        <StatCard icon={Video}     label="Videos"          value={String(stats?.total_videos ?? 0)}     accent="#3B82F6" />
        <StatCard icon={Globe}     label="Languages"       value={String(stats?.languages_in_use ?? 0)} accent="#8B5CF6" />
        <StatCard icon={Users}     label="Pending mentors" value={String(stats?.pending_mentors ?? 0)}  accent="#F59E0B" />
        <StatCard icon={BookOpen}  label="Tracks"          value={String(tracks.length)}                accent="#06B6D4" />
      </div>

      {/* Revenue by track */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Revenue by track" subtitle="All time">
          <div className="space-y-3">
            {tracks.map((track) => {
              const r = revenue.filter((x) => x.track_id === track.id);
              const total = r.reduce((a, x) => a + Number(x.total_tzs), 0);
              const pct = totalRev > 0 ? Math.round((total / totalRev) * 100) : 0;
              return (
                <div key={track.id} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: track.tone }} />
                  <div className="flex-1 text-xs text-white/50 truncate">{track.name}</div>
                  <div className="w-28 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: track.tone }} />
                  </div>
                  <div className="text-xs text-white/40 w-24 text-right tabular-nums">
                    {total.toLocaleString()} TZS
                  </div>
                </div>
              );
            })}
            {revenue.length === 0 && (
              <p className="text-xs text-white/20 py-4 text-center">No payment data yet</p>
            )}
          </div>
        </Card>

        <Card title="Quick actions">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Manage learners", href: "/nrx-ctrl-9f4a/learners", icon: "👥" },
              { label: "Issue certificate", href: "/nrx-ctrl-9f4a/certificates", icon: "🎓" },
              { label: "Add content", href: "/nrx-ctrl-9f4a/cms", icon: "📚" },
              { label: "New competition", href: "/nrx-ctrl-9f4a/competitions", icon: "🏆" },
              { label: "View revenue", href: "/nrx-ctrl-9f4a/revenue", icon: "💰" },
              { label: "System settings", href: "/nrx-ctrl-9f4a/settings", icon: "⚙️" },
            ].map(({ label, href, icon }) => (
              <a key={href} href={href}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.02] transition-all group">
                <span className="text-base">{icon}</span>
                <span className="text-xs font-medium text-white/50 group-hover:text-white/80 transition-colors">{label}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
