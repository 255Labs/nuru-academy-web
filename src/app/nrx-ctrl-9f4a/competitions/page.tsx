"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Edit3, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import {
  PageHeader, Table, TR, TD, Badge, Btn, Modal,
  Field, Input, Select, Textarea, Toast, Spinner,
} from "@/components/admin/ui";

interface Competition {
  id: string; title: string; description: string; track_id: string;
  starts_at: string; ends_at: string; prize_desc: string | null;
  entry_fee_tzs: number; max_entries: number | null; status: string;
}

export default function CompetitionsPage() {
  const { tracks } = useTracks();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Competition> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toast = useCallback((m: string, e = false) => { if (e) setErr(m); else setMsg(m); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().from("ussd_competitions").select("*").order("starts_at");
    setCompetitions((data ?? []) as Competition[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form?.title) return;
    const { error } = await createClient().rpc("admin_upsert_competition", {
      p_id: form.id ?? null,
      p_title: form.title,
      p_description: form.description ?? "",
      p_track_id: form.track_id ?? "beginner",
      p_starts_at: form.starts_at ?? new Date().toISOString(),
      p_ends_at: form.ends_at ?? new Date().toISOString(),
      p_prize_desc: form.prize_desc ?? null,
      p_entry_fee_tzs: form.entry_fee_tzs ?? 0,
      p_status: form.status ?? "upcoming",
    });
    if (error) return toast(error.message, true);
    setForm(null);
    toast(form.id ? "Competition updated" : "Competition created");
    load();
  }

  const set = (k: keyof Competition, v: string | number) =>
    setForm((f) => f ? { ...f, [k]: v } : f);

  const STATUS_COLOR: Record<string, "green" | "amber" | "grey"> = {
    active: "green", upcoming: "amber", ended: "grey",
  };

  return (
    <div className="space-y-5">
      <Toast msg={msg} err={err} onClear={() => { setMsg(null); setErr(null); }} />

      <PageHeader title="Competitions" subtitle="Schedule and manage USSD and web competitions"
        action={<Btn label="New competition" icon={Plus} onClick={() => setForm({})} />} />

      {loading ? <Spinner /> : (
        <Table headers={["Title", "Track", "Status", "Dates", "Prize", "Fee", ""]} empty={competitions.length === 0}>
          {competitions.map((c) => {
            const track = tracks.find((t) => t.id === c.track_id);
            return (
              <TR key={c.id}>
                <TD>
                  <div className="font-semibold text-white/80 text-sm">{c.title}</div>
                  <div className="text-white/25 text-[11px] line-clamp-1">{c.description}</div>
                </TD>
                <TD muted>{track?.subtitle ?? c.track_id}</TD>
                <TD><Badge label={c.status} color={STATUS_COLOR[c.status] ?? "grey"} /></TD>
                <TD muted>
                  <div className="text-[11px]">{new Date(c.starts_at).toLocaleDateString()}</div>
                  <div className="text-[11px]">→ {new Date(c.ends_at).toLocaleDateString()}</div>
                </TD>
                <TD muted>{c.prize_desc ?? "—"}</TD>
                <TD muted>{c.entry_fee_tzs === 0 ? "Free" : `${c.entry_fee_tzs.toLocaleString()} TZS`}</TD>
                <TD><Btn label="" icon={Edit3} variant="ghost" size="sm" onClick={() => setForm(c)} /></TD>
              </TR>
            );
          })}
        </Table>
      )}

      {form !== null && (
        <Modal title={form.id ? "Edit Competition" : "New Competition"} onClose={() => setForm(null)} wide>
          <div className="space-y-4">
            <Field label="Title" required><Input value={form.title ?? ""} onChange={(v) => set("title", v)} /></Field>
            <Field label="Description"><Textarea value={form.description ?? ""} onChange={(v) => set("description", v)} rows={2} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Track">
                <Select value={form.track_id ?? "beginner"} onChange={(v) => set("track_id", v)}>
                  {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status ?? "upcoming"} onChange={(v) => set("status", v)}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="ended">Ended</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts at">
                <Input type="datetime-local" value={form.starts_at?.slice(0,16) ?? ""}
                  onChange={(v) => set("starts_at", new Date(v).toISOString())} />
              </Field>
              <Field label="Ends at">
                <Input type="datetime-local" value={form.ends_at?.slice(0,16) ?? ""}
                  onChange={(v) => set("ends_at", new Date(v).toISOString())} />
              </Field>
            </div>
            <Field label="Prize description">
              <Input value={form.prize_desc ?? ""} onChange={(v) => set("prize_desc", v)}
                placeholder="e.g. TZS 50,000 airtime for top 3" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Entry fee (TZS, 0 = free)">
                <Input type="number" value={String(form.entry_fee_tzs ?? 0)}
                  onChange={(v) => set("entry_fee_tzs", parseInt(v) || 0)} />
              </Field>
              <Field label="Max entries (blank = unlimited)">
                <Input type="number" value={String(form.max_entries ?? "")}
                  onChange={(v) => set("max_entries", parseInt(v) || 0)} placeholder="Unlimited" />
              </Field>
            </div>
            <div className="flex gap-2 pt-1">
              <Btn label="Save competition" icon={Trophy} onClick={save} disabled={!form.title} />
              <Btn label="Cancel" variant="ghost" onClick={() => setForm(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
