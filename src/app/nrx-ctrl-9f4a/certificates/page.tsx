"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Plus, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import {
  PageHeader, Table, TR, TD, Badge, Btn, Modal,
  Field, Select, Toast, SearchInput, Spinner, Card,
} from "@/components/admin/ui";

interface Cert {
  cert_id: string; user_id: string; display_name: string; email: string;
  track_id: string; issued_at: string; verify_token: string;
  certificate_url?: string;
}
interface Learner { user_id: string; display_name: string; email: string; }

export default function CertificatesPage() {
  const { tracks } = useTracks();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ user_id: string; track_id: string } | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toast = useCallback((m: string, e = false) => { if (e) setErr(m); else setMsg(m); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const s = createClient();
    const [cr, lr] = await Promise.all([
      s.rpc("admin_list_certificates"),
      s.rpc("admin_list_learners"),
    ]);
    setCerts((cr.data ?? []) as Cert[]);
    setLearners(((lr.data ?? []) as Learner[]));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function issue() {
    if (!form?.user_id || !form.track_id) return;
    setIssuing(true);
    const res = await fetch("/api/nrx-ctrl-9f4a/issue-certificate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setIssuing(false);
    if (!res.ok) return toast(d.error ?? "Failed", true);
    setForm(null);
    toast("Certificate issued, generated and emailed");
    load();
  }

  async function revoke(certId: string, name: string) {
    if (!confirm(`Revoke certificate for ${name}?`)) return;
    await createClient().rpc("admin_revoke_certificate", { p_cert_id: certId });
    setCerts((c) => c.filter((x) => x.cert_id !== certId));
    toast("Certificate revoked");
  }

  const filtered = certs.filter((c) =>
    !search || c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <Toast msg={msg} err={err} onClear={() => { setMsg(null); setErr(null); }} />

      <PageHeader title="Certificates" subtitle={`${certs.length} issued`}
        action={
          <div className="flex gap-2">
            <Btn label="Refresh" icon={RefreshCw} variant="outline" size="sm" onClick={load} />
            <Btn label="Issue certificate" icon={Plus} size="sm"
              onClick={() => setForm({ user_id: "", track_id: tracks[0]?.id ?? "beginner" })} />
          </div>
        } />

      <div className="max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" />
      </div>

      {loading ? <Spinner /> : (
        <Table headers={["Learner", "Track", "Issued", "Token", "Certificate", ""]} empty={filtered.length === 0}>
          {filtered.map((c) => {
            const track = tracks.find((t) => t.id === c.track_id);
            return (
              <TR key={c.cert_id}>
                <TD>
                  <div className="font-semibold text-white/80 text-xs">{c.display_name}</div>
                  <div className="text-white/25 text-[11px]">{c.email}</div>
                </TD>
                <TD>
                  <Badge label={track?.name ?? c.track_id}
                    color={c.track_id === "beginner" ? "blue" : c.track_id === "intermediate" ? "green" : "purple"} />
                </TD>
                <TD muted>{new Date(c.issued_at).toLocaleDateString()}</TD>
                <TD mono>{c.verify_token.slice(0, 14)}…</TD>
                <TD>
                  {c.certificate_url ? (
                    <a href={c.certificate_url} target="_blank" rel="noopener"
                      className="inline-flex items-center gap-1 text-xs text-[#6B4EFF] hover:underline">
                      <ExternalLink size={11} /> View SVG
                    </a>
                  ) : (
                    <span className="text-white/20 text-xs">Not generated</span>
                  )}
                </TD>
                <TD>
                  <Btn label="" icon={Trash2} variant="danger" size="sm"
                    onClick={() => revoke(c.cert_id, c.display_name)} />
                </TD>
              </TR>
            );
          })}
        </Table>
      )}

      {form && (
        <Modal title="Issue Certificate" onClose={() => setForm(null)}>
          <div className="space-y-4">
            <Field label="Learner" required>
              <select value={form.user_id}
                onChange={(e) => setForm((f) => f ? { ...f, user_id: e.target.value } : f)}
                className="w-full bg-[#13131A] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-[#6B4EFF]/60">
                <option value="">— select learner —</option>
                {learners.map((l) => (
                  <option key={l.user_id} value={l.user_id}>{l.display_name} ({l.email})</option>
                ))}
              </select>
            </Field>
            <Field label="Track" required>
              <Select value={form.track_id} onChange={(v) => setForm((f) => f ? { ...f, track_id: v } : f)}>
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <div className="bg-white/[0.03] rounded-lg p-3 text-xs text-white/30 leading-relaxed">
              Generates an SVG certificate, uploads to Supabase Storage, updates the database, and sends an email to the learner with a download link.
            </div>
            <div className="flex gap-2">
              <Btn label={issuing ? "Generating…" : "Issue & email"} icon={Award} onClick={issue}
                disabled={!form.user_id || issuing} />
              <Btn label="Cancel" variant="ghost" onClick={() => setForm(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
