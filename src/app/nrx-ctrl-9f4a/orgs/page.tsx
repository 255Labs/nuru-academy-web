"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Users, RefreshCw, ChevronDown, ChevronUp,
  Copy, RotateCcw, CheckCircle2, AlertCircle, Clock,
  XCircle, ExternalLink, StickyNote, Search, Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Spinner } from "@/components/admin/ui";

// ── Types ──────────────────────────────────────────────────────────────────

type OrgStatus = "pending" | "active" | "expired" | "cancelled";

interface OrgRow {
  org_id: string;
  org_name: string;
  plan_id: string;
  plan_name: string;
  seat_count: number;
  seats_used: number;
  status: OrgStatus;
  admin_notes: string | null;
  invite_code: string | null;
  invite_expires_at: string | null;
  created_at: string;
  amount_tzs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_META: Record<OrgStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20",  icon: Clock      },
  active:    { label: "Active",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  expired:   { label: "Expired",  color: "text-white/30",    bg: "bg-white/[0.04] border-white/[0.08]",  icon: XCircle    },
  cancelled: { label: "Cancelled", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",      icon: XCircle    },
};

function formatTZS(n: number) {
  return n.toLocaleString("en-TZ") + " TZS";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SeatBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct >= 90 ? "#FF3D3D" : pct >= 70 ? "#FFBE30" : "#1DD65E";
  return (
    <div>
      <div className="flex justify-between text-[10px] text-white/30 mb-1">
        <span>{used} / {total} seats</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrgStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${m.bg} ${m.color}`}>
      <Icon size={9} />
      {m.label}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
      ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
         : "bg-red-500/10 border-red-500/20 text-red-400"
    }`}>
      {ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
      {msg}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/70 transition-colors px-1.5 py-0.5 rounded border border-white/[0.08] hover:border-white/[0.16]">
      {copied ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Copy size={10} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Org Row Card ──────────────────────────────────────────────────────────

function OrgCard({ org, onRefresh }: { org: OrgRow; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus]     = useState<OrgStatus>(org.status);
  const [notes, setNotes]       = useState(org.admin_notes ?? "");
  const [invite, setInvite]     = useState(org.invite_code);
  const [saving, setSaving]     = useState(false);
  const [regen, setRegen]       = useState(false);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [dirty, setDirty]       = useState(false);

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function save() {
    setSaving(true);
    const sb = createClient();
    const { error } = await sb.rpc("admin_update_org", {
      p_org_id:      org.org_id,
      p_status:      status,
      p_admin_notes: notes || null,
    });
    setSaving(false);
    if (error) { flash(error.message, false); }
    else       { flash("Saved", true); setDirty(false); onRefresh(); }
  }

  async function regenInvite() {
    setRegen(true);
    const sb = createClient();
    const { data, error } = await sb.rpc("admin_regenerate_org_invite", { p_org_id: org.org_id });
    setRegen(false);
    if (error) { flash(error.message, false); }
    else       { setInvite(data?.invite_code ?? invite); flash("New invite link generated", true); }
  }

  const inviteUrl = invite ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${invite}` : null;

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden transition-all" style={{ background: "#1E1E2A" }}>

      {/* Summary row */}
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}>

        {/* Icon */}
        <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
          style={{ background: "rgba(124,92,255,0.12)", border: "1px solid rgba(124,92,255,0.2)" }}>
          <Building2 size={16} style={{ color: "#7C5CFF" }} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white/85 truncate">{org.org_name}</span>
            <StatusBadge status={status} />
          </div>
          <div className="text-[11px] text-white/30 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-white/20">{org.org_id.slice(0, 8)}…</span>
            <span>·</span>
            <span>{org.plan_name}</span>
            <span>·</span>
            <span>{formatTZS(org.amount_tzs)}</span>
            <span>·</span>
            <span>{formatDate(org.created_at)}</span>
          </div>
        </div>

        {/* Seat bar — desktop only */}
        <div className="hidden md:block w-40 shrink-0">
          <SeatBar used={org.seats_used} total={org.seat_count} />
        </div>

        {/* Expand icon */}
        <div className="text-white/20 shrink-0">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/[0.05]">

          {/* Seat bar mobile */}
          <div className="md:hidden pt-3">
            <SeatBar used={org.seats_used} total={org.seat_count} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">

            {/* Left: controls */}
            <div className="space-y-3">

              {/* Status selector */}
              <div>
                <div className="text-[10px] font-semibold text-white/25 uppercase tracking-wide mb-1.5">Status</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["pending","active","expired","cancelled"] as OrgStatus[]).map((s) => {
                    const m = STATUS_META[s];
                    const active = status === s;
                    return (
                      <button key={s} onClick={() => { setStatus(s); setDirty(true); }}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                          active ? `${m.bg} ${m.color}` : "border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15]"
                        }`}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <div className="text-[10px] font-semibold text-white/25 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <StickyNote size={10} /> Admin notes
                </div>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                  placeholder="Internal notes visible only to admins…"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/20 outline-none resize-none focus:border-[#7C5CFF]/40 transition-colors font-mono"
                />
              </div>

              {/* Save */}
              <div className="flex items-center gap-3">
                <button onClick={save} disabled={!dirty || saving}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    dirty ? "bg-[#7C5CFF] text-white hover:bg-[#6B4EFF]"
                          : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                  }`}>
                  {saving ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                  Save changes
                </button>
                {toast && <Toast msg={toast.msg} ok={toast.ok} />}
              </div>
            </div>

            {/* Right: invite link */}
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-semibold text-white/25 uppercase tracking-wide mb-1.5">Invite link</div>
                {inviteUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 min-w-0">
                      <code className="text-[11px] text-white/50 font-mono flex-1 truncate">{inviteUrl}</code>
                      <CopyBtn text={inviteUrl} />
                    </div>
                    {org.invite_expires_at && (
                      <div className="text-[10px] text-white/25">
                        Expires: {formatDate(org.invite_expires_at)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-white/25 italic">No invite code yet</div>
                )}
              </div>

              <button onClick={regenInvite} disabled={regen}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.1] text-white/40 hover:text-white/70 hover:border-white/[0.2] transition-all">
                {regen ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                Regenerate invite link
              </button>

              {/* Members count */}
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Users size={12} />
                  Members joined
                </div>
                <div className="text-sm font-bold text-white/70">{org.seats_used}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats summary ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] p-4" style={{ background: "#1E1E2A" }}>
      <div className="text-[10px] font-semibold text-white/25 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-white/85">{value}</div>
      {sub && <div className="text-[11px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function OrgsAdminPage() {
  const [orgs, setOrgs]         = useState<OrgRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<OrgStatus | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb.rpc("admin_list_orgs");
    setOrgs((data ?? []) as OrgRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orgs.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search && !o.org_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSeats = orgs.reduce((s, o) => s + o.seat_count, 0);
  const usedSeats  = orgs.reduce((s, o) => s + o.seats_used, 0);
  const totalRev   = orgs.reduce((s, o) => s + (o.status === "active" ? o.amount_tzs : 0), 0);
  const activeOrgs = orgs.filter((o) => o.status === "active").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Organizations"
        subtitle="Manage corporate seat allocations, invite links, and org status"
        action={
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/[0.14]">
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      />

      {loading ? <Spinner /> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total orgs"    value={orgs.length}    sub={`${activeOrgs} active`} />
            <StatCard label="Corporate rev" value={`${(totalRev / 1000).toFixed(0)}k TZS`} sub="active orgs only" />
            <StatCard label="Seats sold"    value={totalSeats}     sub={`${usedSeats} joined`} />
            <StatCard label="Seat fill rate" value={totalSeats > 0 ? `${Math.round((usedSeats / totalSeats) * 100)}%` : "—"} sub="joined / sold" />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 focus-within:border-[#7C5CFF]/40 transition-colors">
              <Search size={13} className="text-white/25 shrink-0" />
              <input
                type="text"
                placeholder="Search by org name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white/70 placeholder:text-white/20 outline-none flex-1"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["all","active","pending","expired","cancelled"] as const).map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all capitalize ${
                    filter === s
                      ? "bg-[#7C5CFF]/20 border-[#7C5CFF]/40 text-[#9B7FFF]"
                      : "border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15]"
                  }`}>
                  {s === "all" ? `All (${orgs.length})` : `${s} (${orgs.filter(o => o.status === s).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Org list */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-white/[0.05] p-10 text-center text-white/25 text-sm" style={{ background: "#1E1E2A" }}>
              {orgs.length === 0 ? "No corporate purchases yet." : "No orgs match your filters."}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((o) => (
                <OrgCard key={o.org_id} org={o} onRefresh={load} />
              ))}
            </div>
          )}

          {/* Footer note */}
          <div className="rounded-xl border border-white/[0.05] p-4 text-xs text-white/30 leading-relaxed" style={{ background: "#1E1E2A" }}>
            <div className="font-semibold text-white/50 mb-1 flex items-center gap-1.5">
              <Building2 size={11} /> How corporate access works
            </div>
            After payment is confirmed, an invite link is automatically generated and emailed to the buyer. Employees join by visiting the link, which creates an <code className="bg-white/[0.06] px-1 rounded">org_members</code> record and sets their <code className="bg-white/[0.06] px-1 rounded">access_tier = 'org'</code>. Regenerating a link invalidates the old one — existing members retain access.
          </div>
        </>
      )}
    </div>
  );
}
