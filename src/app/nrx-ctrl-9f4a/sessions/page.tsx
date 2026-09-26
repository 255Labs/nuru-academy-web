"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut, RefreshCw, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Table, TR, TD, Badge, Btn, Toast, Spinner } from "@/components/admin/ui";

interface Session {
  user_id: string;
  display_name: string;
  email: string;
  device_hint: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState<string | null>(null);
  const [err, setErr]           = useState<string | null>(null);

  const toast = useCallback((m: string, e = false) => {
    if (e) setErr(m); else setMsg(m);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().rpc("admin_list_sessions");
    setSessions((data ?? []) as Session[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function forceLogout(userId: string, name: string) {
    if (!confirm(`Force logout ${name}? They will be kicked out on their next page load.`)) return;
    const { error } = await createClient().rpc("admin_force_logout", { p_user_id: userId });
    if (error) return toast(error.message, true);
    setSessions((s) => s.filter((x) => x.user_id !== userId));
    toast(`${name} has been logged out`);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function isRecent(iso: string) {
    return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000; // 5 mins
  }

  return (
    <div className="space-y-5">
      <Toast msg={msg} err={err} onClear={() => { setMsg(null); setErr(null); }} />

      <PageHeader
        title="Active Sessions"
        subtitle={`${sessions.length} user${sessions.length !== 1 ? "s" : ""} with registered sessions`}
        action={<Btn label="Refresh" icon={RefreshCw} variant="outline" size="sm" onClick={load} />}
      />

      {/* Info card */}
      <div className="rounded-xl border border-white/[0.06] p-4"
        style={{ background: "#1E1E2A" }}>
        <div className="flex items-start gap-3">
          <Monitor size={15} className="text-[#6B4EFF] mt-0.5 shrink-0" />
          <div className="text-xs text-white/35 leading-relaxed">
            Nuru enforces <strong className="text-white/60">one active session per account</strong>.
            When a user logs in from a new device, their previous session is automatically invalidated.
            Use Force Logout below to manually kick a user out — they will be redirected to the
            session-taken page on their next page load.
          </div>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <Table
          headers={["User", "Device", "IP Address", "Logged in", "Last active", ""]}
          empty={sessions.length === 0}>
          {sessions.map((s) => (
            <TR key={s.user_id}>
              <TD>
                <div className="font-semibold text-white/80 text-xs">{s.display_name || "—"}</div>
                <div className="text-white/25 text-[11px]">{s.email}</div>
              </TD>
              <TD muted>
                <div className="text-[11px] line-clamp-2 max-w-[200px]">
                  {s.device_hint ?? "Unknown device"}
                </div>
              </TD>
              <TD mono>{s.ip_address ?? "—"}</TD>
              <TD muted>{timeAgo(s.created_at)}</TD>
              <TD>
                <Badge
                  label={timeAgo(s.last_seen_at)}
                  color={isRecent(s.last_seen_at) ? "green" : "grey"}
                />
              </TD>
              <TD>
                <Btn
                  label="Force logout"
                  icon={LogOut}
                  variant="danger"
                  size="sm"
                  onClick={() => forceLogout(s.user_id, s.display_name || s.email)}
                />
              </TD>
            </TR>
          ))}
        </Table>
      )}
    </div>
  );
}
