"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Lock, Unlock, Trash2, Award, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import {
  PageHeader, Table, TR, TD, Badge, Btn, Modal, Field,
  Input, Select, Toast, SearchInput, Spinner, Card,
} from "@/components/admin/ui";

interface Learner {
  user_id: string; display_name: string; username: string; email: string;
  phone_number: string | null; country: string | null; city: string | null;
  xp: number; level: number; coins: number; role: string;
  suspended: boolean; onboarding_complete: boolean; joined_at: string;
}

export default function LearnersPage() {
  const { tracks } = useTracks();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Learner | null>(null);
  const [certForm, setCertForm] = useState<{ user_id: string; track_id: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toast = useCallback((m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().rpc("admin_list_learners");
    setLearners((data ?? []) as Learner[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = learners.filter((l) =>
    !search ||
    l.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.username?.toLowerCase().includes(search.toLowerCase())
  );

  async function setRole(userId: string, role: string) {
    const { error } = await createClient().rpc("admin_set_role", { p_user_id: userId, p_role: role });
    if (error) return toast(error.message, true);
    setLearners((l) => l.map((u) => u.user_id === userId ? { ...u, role } : u));
    setSelected((s) => s?.user_id === userId ? { ...s, role } : s);
    toast(`Role → ${role}`);
  }

  async function setSuspended(userId: string, suspended: boolean) {
    const { error } = await createClient().rpc("admin_set_suspended", { p_user_id: userId, p_suspended: suspended });
    if (error) return toast(error.message, true);
    setLearners((l) => l.map((u) => u.user_id === userId ? { ...u, suspended } : u));
    setSelected((s) => s?.user_id === userId ? { ...s, suspended } : s);
    toast(suspended ? "Account suspended" : "Account reactivated");
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`Delete ${name} permanently? All their data will be removed.`)) return;
    const { error } = await createClient().rpc("admin_delete_user", { p_user_id: userId });
    if (error) return toast(error.message, true);
    setLearners((l) => l.filter((u) => u.user_id !== userId));
    setSelected(null);
    toast(`${name} deleted`);
  }

  async function issueCert() {
    if (!certForm?.user_id || !certForm.track_id) return;
    const res = await fetch("/api/nrx-ctrl-9f4a/issue-certificate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(certForm),
    });
    const d = await res.json();
    if (!res.ok) return toast(d.error ?? "Failed", true);
    setCertForm(null);
    toast("Certificate issued and emailed");
  }

  return (
    <div className="space-y-5">
      <Toast msg={msg} err={err} onClear={() => { setMsg(null); setErr(null); }} />

      <PageHeader title="Learners" subtitle={`${learners.length} total accounts`}
        action={<Btn label="Refresh" icon={RefreshCw} variant="outline" size="sm" onClick={load} />} />

      <div className="flex gap-3 items-center">
        <div className="flex-1 max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, username…" />
        </div>
        <span className="text-xs text-white/25">{filtered.length} shown</span>
      </div>

      {loading ? <Spinner /> : (
        <Table headers={["Learner", "Location", "Progress", "Role", "Status", "Joined", ""]} empty={filtered.length === 0}>
          {filtered.map((u) => (
            <TR key={u.user_id} onClick={() => setSelected(u)}>
              <TD>
                <div className="font-semibold text-white/80 text-xs">{u.display_name || u.username || "—"}</div>
                <div className="text-white/25 text-[11px]">{u.email}</div>
                {u.phone_number && <div className="text-white/20 text-[10px]">{u.phone_number}</div>}
              </TD>
              <TD muted>{[u.city, u.country].filter(Boolean).join(", ") || "—"}</TD>
              <TD>
                <div className="text-white/70 text-xs font-semibold">{u.xp.toLocaleString()} XP</div>
                <div className="text-white/25 text-[10px]">Lv.{u.level}</div>
              </TD>
              <TD>
                <Badge label={u.role} color={u.role === "admin" ? "purple" : "grey"} />
              </TD>
              <TD>
                <Badge
                  label={u.suspended ? "Suspended" : u.onboarding_complete ? "Active" : "Onboarding"}
                  color={u.suspended ? "red" : u.onboarding_complete ? "green" : "amber"}
                />
              </TD>
              <TD muted>{new Date(u.joined_at).toLocaleDateString()}</TD>
              <TD>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Btn label="" icon={u.role === "admin" ? ShieldOff : ShieldCheck} variant="ghost" size="sm"
                    onClick={() => setRole(u.user_id, u.role === "admin" ? "student" : "admin")} />
                  <Btn label="" icon={u.suspended ? Unlock : Lock} variant="ghost" size="sm"
                    onClick={() => setSuspended(u.user_id, !u.suspended)} />
                  <Btn label="" icon={Award} variant="ghost" size="sm"
                    onClick={() => setCertForm({ user_id: u.user_id, track_id: "beginner" })} />
                  <Btn label="" icon={Trash2} variant="danger" size="sm"
                    onClick={() => deleteUser(u.user_id, u.display_name || u.email)} />
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      )}

      {/* Learner detail panel */}
      {selected && (
        <Modal title={selected.display_name || selected.email} onClose={() => setSelected(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Email", selected.email],
                ["Username", selected.username || "—"],
                ["Phone", selected.phone_number || "—"],
                ["Location", [selected.city, selected.country].filter(Boolean).join(", ") || "—"],
                ["XP", selected.xp.toLocaleString()],
                ["Level", String(selected.level)],
                ["Coins", selected.coins.toLocaleString()],
                ["Joined", new Date(selected.joined_at).toLocaleDateString()],
              ].map(([l, v]) => (
                <div key={l} className="bg-white/[0.02] rounded-lg p-3">
                  <div className="text-white/25 text-[11px] mb-0.5">{l}</div>
                  <div className="text-white/70 text-sm font-medium">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap pt-1">
              <Btn label={selected.role === "admin" ? "Demote to student" : "Promote to admin"}
                icon={selected.role === "admin" ? ShieldOff : ShieldCheck} variant="outline"
                onClick={() => setRole(selected.user_id, selected.role === "admin" ? "student" : "admin")} />
              <Btn label={selected.suspended ? "Reactivate" : "Suspend"}
                icon={selected.suspended ? Unlock : Lock}
                variant={selected.suspended ? "outline" : "danger"}
                onClick={() => setSuspended(selected.user_id, !selected.suspended)} />
              <Btn label="Issue certificate" icon={Award} variant="outline"
                onClick={() => { setCertForm({ user_id: selected.user_id, track_id: "beginner" }); setSelected(null); }} />
              <Btn label="Delete account" icon={Trash2} variant="danger"
                onClick={() => deleteUser(selected.user_id, selected.display_name || selected.email)} />
            </div>
          </div>
        </Modal>
      )}

      {/* Issue cert modal */}
      {certForm && (
        <Modal title="Issue Certificate" onClose={() => setCertForm(null)}>
          <div className="space-y-4">
            <Field label="Learner">
              <div className="text-white/70 text-sm py-2">
                {learners.find((l) => l.user_id === certForm.user_id)?.display_name}
              </div>
            </Field>
            <Field label="Track">
              <Select value={certForm.track_id} onChange={(v) => setCertForm((f) => f ? { ...f, track_id: v } : f)}>
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <p className="text-xs text-white/25">
              This generates an SVG certificate, stores it in Supabase, and emails it to the learner.
            </p>
            <div className="flex gap-2">
              <Btn label="Issue & email certificate" icon={Award} onClick={issueCert} />
              <Btn label="Cancel" variant="ghost" onClick={() => setCertForm(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
