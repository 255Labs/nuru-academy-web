"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  BookOpen, Layers, HelpCircle, Zap, Video, Image as ImageIcon,
  Award, Trophy, Plus, Edit3, Trash2, Save, X, ChevronDown,
  ChevronRight, Loader2, CheckCircle, AlertCircle, Upload,
  Eye, EyeOff, GripVertical, FileText, Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TRACKS as STATIC_TRACKS } from "@/data/curriculum";
import { invalidateTrackCache, useTracks } from "@/lib/curriculum-db";

// ─── Types ────────────────────────────────────────────────────────────────────

type CmsTab = "tracks" | "modules" | "lessons" | "quizzes" | "challenges" | "videos" | "images" | "certificates" | "covers";

interface DbLesson {
  id: string; day: number; title: string; objective: string;
  block1_topic: string; block1_points: string[];
  block2_topic: string; block2_points: string[];
  demo: string | null; homework: string | null;
  notes: string | null; video_title: string | null;
  has_video: boolean; has_challenge: boolean;
}
interface DbQuiz {
  id: string; title: string; subtitle: string;
  minutes: number; passing_pct: number; is_placeholder: boolean;
  questions: DbQuestion[];
}
interface DbQuestion {
  id: string; sort_position: number; type: string;
  question_text: string; options: string[] | null;
  correct: number | boolean | string[]; explain: string;
}
interface DbChallenge {
  id: string; lesson_id: string; question: string; type: string;
  options: string[] | null; correct: number | boolean | string[];
  hint: string | null; xp_reward: number;
}
interface CertTemplate {
  id: string; track_id: string; title: string; subtitle: string;
  issuer_name: string; signature_name: string | null;
  accent_color: string; is_active: boolean;
}
interface VideoRow {
  id: string; module_id: string; lesson_day: number;
  title: string; is_active: boolean; uploaded_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toast({ msg, err, onClear }: { msg: string | null; err: string | null; onClear: () => void }) {
  useEffect(() => { if (msg || err) { const t = setTimeout(onClear, 3000); return () => clearTimeout(t); } }, [msg, err, onClear]);
  if (!msg && !err) return null;
  return (
    <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-pop text-white ${err ? "bg-red-500" : "bg-nuru-purple"}`}>
      {err ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
      {err || msg}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-nuru-card rounded-2xl w-full shadow-2xl my-6 ${wide ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-nuru-line">
          <h3 className="font-bold text-nuru-ink">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-nuru-lav grid place-items-center text-nuru-muted hover:text-nuru-ink"><X size={14} /></button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function FL({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-nuru-muted block mb-1.5">
        {label}{required && <span className="text-nuru-rose ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2.5 text-sm text-nuru-ink outline-none focus:border-nuru-purple transition-colors ${className}`} />
  );
}

function Textarea({ value, onChange, rows = 3, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2.5 text-sm text-nuru-ink outline-none focus:border-nuru-purple transition-colors resize-none" />
  );
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2.5 text-sm text-nuru-ink outline-none focus:border-nuru-purple transition-colors">
      {children}
    </select>
  );
}

function Btn({ label, onClick, icon: Icon, variant = "primary", disabled = false, small = false }: {
  label: string; onClick?: () => void; icon?: typeof Plus;
  variant?: "primary" | "danger" | "ghost" | "outline";
  disabled?: boolean; small?: boolean;
}) {
  const cls = {
    primary: "bg-nuru-purple text-white hover:bg-nuru-purpleDeep",
    danger:  "bg-red-500 text-white hover:bg-red-600",
    ghost:   "text-nuru-muted hover:bg-nuru-lav hover:text-nuru-ink",
    outline: "border border-nuru-line text-nuru-ink2 hover:border-nuru-purple/40 hover:bg-nuru-lav/30",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 ${small ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"} font-semibold rounded-xl transition-all disabled:opacity-50 ${cls}`}>
      {Icon && <Icon size={small ? 12 : 14} />} {label}
    </button>
  );
}

// ─── Section: TRACKS ──────────────────────────────────────────────────────────

function TracksSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [form, setForm] = useState<{
    id: string; name: string; subtitle: string; tagline: string; description: string;
    price_tzs: string; passing_pct: string; tone_hex: string; tone_deep: string;
    requires: string; hero_image: string; is_published: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const blankForm = () => ({
    id: "", name: "", subtitle: "", tagline: "", description: "",
    price_tzs: "0", passing_pct: "60", tone_hex: "#6B4EFF", tone_deep: "#5738E8",
    requires: "", hero_image: "", is_published: true,
  });

  function editTrack(t: typeof TRACKS[0]) {
    setForm({ id: t.id, name: t.name, subtitle: t.subtitle, tagline: t.tagline,
      description: "", price_tzs: t.priceTZS, passing_pct: String(t.passingPct),
      tone_hex: t.tone, tone_deep: t.toneDeep, requires: t.requires ?? "",
      hero_image: "", is_published: true });
  }

  async function deleteTrack(id: string, name: string) {
    if (!confirm(`Delete track "${name}" and ALL its modules and lessons? This cannot be undone.`)) return;
    const s = createClient();
    const { error } = await s.rpc("admin_delete_track", { p_track_id: id });
    if (error) return toast(error.message, true);
    toast("Track deleted"); invalidateTrackCache();
  }

  async function save() {
    if (!form?.id || !form.name) return;
    setBusy(true);
    const s = createClient();
    const { error } = await s.rpc("admin_upsert_track", {
      p_id: form.id, p_name: form.name, p_subtitle: form.subtitle, p_tagline: form.tagline,
      p_description: form.description || null, p_price_tzs: parseInt(form.price_tzs) || 0,
      p_passing_pct: parseInt(form.passing_pct) || 60, p_tone_hex: form.tone_hex,
      p_tone_deep: form.tone_deep, p_requires: form.requires || null,
      p_hero_image: form.hero_image || null, p_sort_order: 0, p_is_published: form.is_published,
    });
    setBusy(false);
    if (error) return toast(error.message, true);
    toast("Track saved"); setForm(null); invalidateTrackCache(); invalidateTrackCache();
  }

  const f = form;
  const set = (k: keyof NonNullable<typeof f>, v: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [k]: v } : prev);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn label="New Track" icon={Plus} onClick={() => setForm(blankForm())} />
      </div>

      {TRACKS.map((t) => (
        <div key={t.id} className="bg-nuru-card rounded-2xl border border-nuru-line p-5 flex items-center gap-4 shadow-card">
          <div className="w-4 h-12 rounded-full shrink-0" style={{ background: t.tone }} />
          <div className="flex-1">
            <div className="font-bold text-nuru-ink">{t.name}</div>
            <div className="text-xs text-nuru-muted mt-0.5">{t.subtitle} · TZS {t.priceTZS} · Pass at {t.passingPct}%</div>
            <div className="text-xs text-nuru-muted mt-0.5">{t.tagline}</div>
          </div>
          <div className="flex gap-1.5">
            <Btn label="Edit" icon={Edit3} variant="outline" small onClick={() => editTrack(t)} />
            <Btn label="Delete" icon={Trash2} variant="danger" small onClick={() => deleteTrack(t.id, t.name)} />
          </div>
        </div>
      ))}

      {f && (
        <Modal title={f.id ? `Edit: ${f.name || f.id}` : "New Track"} onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FL label="Track ID" required><Input value={f.id} onChange={(v) => set("id", v)} placeholder="beginner" /></FL>
              <FL label="Subtitle" required><Input value={f.subtitle} onChange={(v) => set("subtitle", v)} placeholder="Beginner" /></FL>
            </div>
            <FL label="Name" required><Input value={f.name} onChange={(v) => set("name", v)} placeholder="AI for Everyone" /></FL>
            <FL label="Tagline"><Input value={f.tagline} onChange={(v) => set("tagline", v)} /></FL>
            <FL label="Description"><Textarea value={f.description} onChange={(v) => set("description", v)} rows={2} /></FL>
            <div className="grid grid-cols-2 gap-3">
              <FL label="Price (TZS)"><Input value={f.price_tzs} onChange={(v) => set("price_tzs", v)} type="number" /></FL>
              <FL label="Passing %"><Input value={f.passing_pct} onChange={(v) => set("passing_pct", v)} type="number" /></FL>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FL label="Accent colour"><Input value={f.tone_hex} onChange={(v) => set("tone_hex", v)} placeholder="#6B4EFF" /></FL>
              <FL label="Deep accent"><Input value={f.tone_deep} onChange={(v) => set("tone_deep", v)} placeholder="#5738E8" /></FL>
            </div>
            <FL label="Hero image URL"><Input value={f.hero_image} onChange={(v) => set("hero_image", v)} placeholder="https://images.unsplash.com/..." /></FL>
            <FL label="Requires (track ID)"><Input value={f.requires} onChange={(v) => set("requires", v)} placeholder="beginner (leave blank if none)" /></FL>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={f.is_published} onChange={(e) => set("is_published", e.target.checked)} className="rounded" />
              <span className="text-sm font-medium text-nuru-ink">Published (visible to learners)</span>
            </label>
            <div className="flex gap-2 pt-2">
              <Btn label={busy ? "Saving…" : "Save Track"} icon={Save} onClick={save} disabled={busy || !f.id || !f.name} />
              <Btn label="Cancel" variant="outline" onClick={() => setForm(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Section: MODULES ─────────────────────────────────────────────────────────

function ModulesSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [selected, setSelected] = useState(TRACKS[0]?.id ?? "");
  const [form, setForm] = useState<{
    id: string; track_id: string; week: string; name: string; tagline: string; description: string;
  } | null>(null);
  const track = TRACKS.find((t) => t.id === selected);
  const blank = () => ({ id: "", track_id: selected, week: "1", name: "", tagline: "", description: "" });

  async function save() {
    if (!form?.id || !form.name) return;
    const s = createClient();
    const { error } = await s.rpc("admin_upsert_module", {
      p_id: form.id, p_track_id: form.track_id, p_week: parseInt(form.week) || 1,
      p_name: form.name, p_tagline: form.tagline, p_description: form.description || null, p_sort_order: parseInt(form.week) || 1,
    });
    if (error) return toast(error.message, true);
    toast("Module saved"); setForm(null); invalidateTrackCache();
  }

  async function deleteModule(id: string, name: string) {
    if (!confirm(`Delete module "${name}" and ALL its lessons? This cannot be undone.`)) return;
    const s = createClient();
    const { error } = await s.rpc("admin_delete_module", { p_module_id: id });
    if (error) return toast(error.message, true);
    toast("Module deleted"); invalidateTrackCache();
  }

  const f = form;
  const set = (k: keyof NonNullable<typeof f>, v: string) => setForm((p) => p ? { ...p, [k]: v } : p);

  if (!track) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {TRACKS.map((t) => (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selected === t.id ? "bg-nuru-purple text-white" : "bg-nuru-lav text-nuru-ink2 hover:bg-nuru-purple/20"}`}>
              {t.subtitle}
            </button>
          ))}
        </div>
        <Btn label="New Module" icon={Plus} onClick={() => setForm(blank())} small />
      </div>

      {track.modules.map((m) => (
        <div key={m.id} className="bg-nuru-card rounded-2xl border border-nuru-line p-4 flex items-center gap-4 shadow-card">
          <div className="w-8 h-8 rounded-xl grid place-items-center text-white text-xs font-bold shrink-0"
            style={{ background: track.tone }}>W{m.week}</div>
          <div className="flex-1">
            <div className="font-bold text-nuru-ink text-sm">{m.name}</div>
            <div className="text-xs text-nuru-muted mt-0.5">{m.tagline} · {m.lessons?.length ?? 0} lessons · ID: {m.id}</div>
          </div>
          <div className="flex gap-1.5">
            <Btn label="Edit" icon={Edit3} variant="outline" small
              onClick={() => setForm({ id: m.id, track_id: track.id, week: String(m.week), name: m.name, tagline: m.tagline, description: "" })} />
            <Btn label="Delete" icon={Trash2} variant="danger" small onClick={() => deleteModule(m.id, m.name)} />
          </div>
        </div>
      ))}

      {f && (
        <Modal title={f.id ? "Edit Module" : "New Module"} onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FL label="Module ID" required><Input value={f.id} onChange={(v) => set("id", v)} placeholder="beginner:b1" /></FL>
              <FL label="Track">
                <Select value={f.track_id} onChange={(v) => set("track_id", v)}>
                  {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </FL>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FL label="Week number"><Input value={f.week} onChange={(v) => set("week", v)} type="number" /></FL>
              <FL label="Name" required><Input value={f.name} onChange={(v) => set("name", v)} placeholder="Foundations" /></FL>
            </div>
            <FL label="Tagline"><Input value={f.tagline} onChange={(v) => set("tagline", v)} /></FL>
            <FL label="Description"><Textarea value={f.description} onChange={(v) => set("description", v)} /></FL>
            <div className="flex gap-2 pt-2">
              <Btn label="Save Module" icon={Save} onClick={save} disabled={!f.id || !f.name} />
              <Btn label="Cancel" variant="outline" onClick={() => setForm(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Section: LESSONS ─────────────────────────────────────────────────────────

function LessonsSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [trackId, setTrackId] = useState(TRACKS[0]?.id ?? "");
  const [moduleId, setModuleId] = useState(TRACKS[0]?.modules?.[0]?.id ?? "");
  const [lessons, setLessons] = useState<DbLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{
    id: string | null; day: string; title: string; objective: string;
    b1_topic: string; b1_pts: string; b2_topic: string; b2_pts: string;
    demo: string; homework: string; notes: string; video_title: string;
  } | null>(null);

  const track = TRACKS.find((t) => t.id === trackId);

  const loadLessons = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    const { data } = await createClient().rpc("admin_list_lessons", { p_module_id: moduleId });
    setLessons((data ?? []) as DbLesson[]);
    setLoading(false);
  }, [moduleId]);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  const blank = () => ({
    id: null, day: "1", title: "", objective: "", b1_topic: "", b1_pts: "",
    b2_topic: "", b2_pts: "", demo: "", homework: "", notes: "", video_title: "",
  });

  function editLesson(l: DbLesson) {
    setForm({
      id: l.id, day: String(l.day), title: l.title, objective: l.objective,
      b1_topic: l.block1_topic, b1_pts: l.block1_points.join("\n"),
      b2_topic: l.block2_topic, b2_pts: l.block2_points.join("\n"),
      demo: l.demo ?? "", homework: l.homework ?? "",
      notes: l.notes ?? "", video_title: l.video_title ?? "",
    });
  }

  async function save() {
    if (!form) return;
    const s = createClient();
    const { error } = await s.rpc("admin_upsert_lesson_full", {
      p_module_id: moduleId, p_day: parseInt(form.day) || 1,
      p_title: form.title, p_objective: form.objective,
      p_b1_topic: form.b1_topic, p_b1_pts: JSON.stringify(form.b1_pts.split("\n").map((s) => s.trim()).filter(Boolean)),
      p_b2_topic: form.b2_topic, p_b2_pts: JSON.stringify(form.b2_pts.split("\n").map((s) => s.trim()).filter(Boolean)),
      p_demo: form.demo || null, p_homework: form.homework || null,
      p_notes: form.notes || null, p_video_title: form.video_title || null, p_sort_order: null,
    });
    if (error) return toast(error.message, true);
    toast("Lesson saved"); setForm(null); invalidateTrackCache(); loadLessons();
  }

  async function deleteLesson(id: string, title: string) {
    if (!confirm(`Delete lesson "${title}"?`)) return;
    const { error } = await createClient().rpc("admin_delete_lesson", { p_lesson_id: id });
    if (error) return toast(error.message, true);
    toast("Lesson deleted"); invalidateTrackCache(); loadLessons();
  }

  const f = form;
  const set = (k: keyof NonNullable<typeof f>, v: string) => setForm((p) => p ? { ...p, [k]: v } : p);

  if (!TRACKS.length) return null;

  return (
    <div className="space-y-4">
      {/* Track + module selectors */}
      <div className="bg-nuru-card rounded-2xl border border-nuru-line p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {TRACKS.map((t) => (
            <button key={t.id} onClick={() => { setTrackId(t.id); setModuleId(t.modules[0].id); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${trackId === t.id ? "text-white shadow-pop" : "bg-nuru-lav text-nuru-ink2"}`}
              style={trackId === t.id ? { background: t.tone } : undefined}>
              {t.subtitle}
            </button>
          ))}
        </div>
        <ChevronRight size={14} className="text-nuru-muted" />
        <div className="flex gap-2 flex-wrap">
          {track.modules.map((m) => (
            <button key={m.id} onClick={() => setModuleId(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${moduleId === m.id ? "bg-nuru-purple text-white" : "bg-nuru-lav text-nuru-ink2 hover:bg-nuru-purple/20"}`}>
              W{m.week}: {m.name}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Btn label="Add Lesson" icon={Plus} onClick={() => setForm(blank())} small />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-nuru-muted" /></div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-10 text-nuru-muted text-sm">
          No lessons in this module yet. <button onClick={() => setForm(blank())} className="text-nuru-purple font-semibold hover:underline">Add the first one →</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {lessons.map((l) => (
            <div key={l.id} className="bg-nuru-card rounded-2xl border border-nuru-line p-4 flex items-start gap-4 shadow-card">
              <div className="w-9 h-9 rounded-xl grid place-items-center text-white text-sm font-bold shrink-0 mt-0.5"
                style={{ background: track.tone }}>D{l.day}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-nuru-ink text-sm">{l.title}</div>
                <div className="text-xs text-nuru-muted mt-0.5 truncate">{l.objective}</div>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {l.has_video && <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold"><Video size={9} /> Video</span>}
                  {l.has_challenge && <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold"><Zap size={9} /> Challenge</span>}
                  {l.notes && <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold"><FileText size={9} /> Notes</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Btn label="Edit" icon={Edit3} variant="outline" small onClick={() => editLesson(l)} />
                <Btn label="Del" icon={Trash2} variant="danger" small onClick={() => deleteLesson(l.id, l.title)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {f && (
        <Modal title={f.id ? "Edit Lesson" : "New Lesson"} onClose={() => setForm(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <FL label="Day" required><Input value={f.day} onChange={(v) => set("day", v)} type="number" /></FL>
              <div className="col-span-2"><FL label="Title" required><Input value={f.title} onChange={(v) => set("title", v)} /></FL></div>
            </div>
            <FL label="Objective (what the learner will know)">
              <Textarea value={f.objective} onChange={(v) => set("objective", v)} rows={2} />
            </FL>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FL label="Block 1: Topic" required><Input value={f.b1_topic} onChange={(v) => set("b1_topic", v)} /></FL>
                <FL label="Block 1: Key points (one per line)" required>
                  <Textarea value={f.b1_pts} onChange={(v) => set("b1_pts", v)} rows={5} placeholder={"Point one\nPoint two\nPoint three"} />
                </FL>
              </div>
              <div className="space-y-2">
                <FL label="Block 2: Topic" required><Input value={f.b2_topic} onChange={(v) => set("b2_topic", v)} /></FL>
                <FL label="Block 2: Key points (one per line)" required>
                  <Textarea value={f.b2_pts} onChange={(v) => set("b2_pts", v)} rows={5} placeholder={"Point one\nPoint two\nPoint three"} />
                </FL>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FL label="Demo / activity (optional)">
                <Textarea value={f.demo} onChange={(v) => set("demo", v)} rows={3} placeholder="Try this in ChatGPT…" />
              </FL>
              <FL label="Homework (optional)">
                <Textarea value={f.homework} onChange={(v) => set("homework", v)} rows={3} placeholder="This week, find one example of…" />
              </FL>
            </div>

            <FL label="Study notes (markdown supported)">
              <Textarea value={f.notes} onChange={(v) => set("notes", v)} rows={6} placeholder={"# Lesson Title\n\n## Key concept\n1. First point…"} />
            </FL>

            <FL label="Video lesson title (if a video has been uploaded for this day)">
              <Input value={f.video_title} onChange={(v) => set("video_title", v)} placeholder="Introduction to Neural Networks" />
            </FL>

            <div className="flex gap-2 pt-2 border-t border-nuru-line">
              <Btn label="Save Lesson" icon={Save} onClick={save} disabled={!f.title || !f.b1_topic || !f.b2_topic} />
              <Btn label="Cancel" variant="outline" onClick={() => setForm(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Section: QUIZZES / QUESTIONNAIRES ───────────────────────────────────────

function QuizzesSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [trackId, setTrackId] = useState(TRACKS[0]?.id ?? "");
  const [moduleId, setModuleId] = useState(TRACKS[0]?.modules?.[0]?.id ?? "");
  const [quiz, setQuiz] = useState<DbQuiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizForm, setQuizForm] = useState<{ title: string; subtitle: string; minutes: string; passing_pct: string; is_placeholder: boolean } | null>(null);
  const [qForm, setQForm] = useState<{
    id: string | null; sort_pos: string; type: string; text: string;
    opt_a: string; opt_b: string; opt_c: string; opt_d: string;
    correct: string; accept: string; explain: string;
  } | null>(null);

  const track = TRACKS.find((t) => t.id === trackId);

  const loadQuiz = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    const { data } = await createClient().rpc("admin_get_quiz", { p_module_id: moduleId });
    setQuiz(data as DbQuiz | null);
    setLoading(false);
  }, [moduleId]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  async function saveQuiz() {
    if (!quizForm) return;
    const s = createClient();
    const { error } = await s.rpc("admin_upsert_quiz", {
      p_module_id: moduleId, p_title: quizForm.title, p_subtitle: quizForm.subtitle,
      p_minutes: parseInt(quizForm.minutes) || 10, p_passing_pct: parseInt(quizForm.passing_pct) || 60,
      p_is_placeholder: quizForm.is_placeholder,
    });
    if (error) return toast(error.message, true);
    toast("Quiz saved"); setQuizForm(null); loadQuiz();
  }

  async function saveQuestion() {
    if (!qForm || !quiz) return;
    const s = createClient();
    const opts = qForm.type === "mcq" ? [qForm.opt_a, qForm.opt_b, qForm.opt_c, qForm.opt_d].filter(Boolean) : null;
    const correct = qForm.type === "mcq" ? JSON.stringify(parseInt(qForm.correct) || 0)
      : qForm.type === "tf" ? qForm.correct
      : JSON.stringify(qForm.accept.split(",").map((a) => a.trim()).filter(Boolean));
    const { error } = await s.rpc("admin_upsert_question", {
      p_quiz_id: quiz.id, p_question_id: qForm.id || null,
      p_sort_pos: parseInt(qForm.sort_pos) || 1, p_type: qForm.type,
      p_text: qForm.text, p_options: opts, p_correct: correct, p_explain: qForm.explain,
    });
    if (error) return toast(error.message, true);
    toast("Question saved"); setQForm(null); loadQuiz();
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await createClient().rpc("admin_delete_question", { p_question_id: id });
    if (error) return toast(error.message, true);
    toast("Question deleted"); loadQuiz();
  }

  const blankQ = () => ({ id: null, sort_pos: String((quiz?.questions?.length ?? 0) + 1), type: "mcq", text: "", opt_a: "", opt_b: "", opt_c: "", opt_d: "", correct: "0", accept: "", explain: "" });

  function editQ(q: DbQuestion) {
    setQForm({
      id: q.id, sort_pos: String(q.sort_position), type: q.type, text: q.question_text,
      opt_a: q.options?.[0] ?? "", opt_b: q.options?.[1] ?? "", opt_c: q.options?.[2] ?? "", opt_d: q.options?.[3] ?? "",
      correct: q.type === "mcq" ? String(q.correct) : q.type === "tf" ? String(q.correct) : "",
      accept: Array.isArray(q.correct) ? (q.correct as string[]).join(", ") : "", explain: q.explain,
    });
  }

  const qf = qForm;
  const setQ = (k: keyof NonNullable<typeof qf>, v: string | boolean) => setQForm((p) => p ? { ...p, [k]: v } : p);

  if (!TRACKS.length) return null;

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="bg-nuru-card rounded-2xl border border-nuru-line p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {TRACKS.map((t) => (
            <button key={t.id} onClick={() => { setTrackId(t.id); setModuleId(t.modules[0].id); setQuiz(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${trackId === t.id ? "text-white" : "bg-nuru-lav text-nuru-ink2"}`}
              style={trackId === t.id ? { background: t.tone } : undefined}>{t.subtitle}</button>
          ))}
        </div>
        <ChevronRight size={14} className="text-nuru-muted" />
        <div className="flex gap-2 flex-wrap">
          {track.modules.map((m) => (
            <button key={m.id} onClick={() => { setModuleId(m.id); setQuiz(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${moduleId === m.id ? "bg-nuru-purple text-white" : "bg-nuru-lav text-nuru-ink2"}`}>
              W{m.week}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-nuru-muted" /></div> : (
        <>
          {/* Quiz meta */}
          <div className="bg-nuru-card rounded-2xl border border-nuru-line p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-nuru-ink text-sm">Mission Quest Settings</h3>
              <Btn label={quiz ? "Edit quiz" : "Create quiz"} icon={quiz ? Edit3 : Plus} variant="outline" small
                onClick={() => setQuizForm(quiz ? { title: quiz.title, subtitle: quiz.subtitle, minutes: String(quiz.minutes), passing_pct: String(quiz.passing_pct), is_placeholder: quiz.is_placeholder } : { title: "", subtitle: "", minutes: "10", passing_pct: "60", is_placeholder: false })} />
            </div>
            {quiz ? (
              <div className="space-y-1 text-sm">
                <div><span className="text-nuru-muted text-xs">Title:</span> <span className="font-semibold text-nuru-ink">{quiz.title}</span></div>
                <div><span className="text-nuru-muted text-xs">Passing:</span> <span className="font-semibold text-nuru-ink">{quiz.passing_pct}%</span> · <span className="text-nuru-muted text-xs">Time:</span> <span className="font-semibold text-nuru-ink">{quiz.minutes} min</span></div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${quiz.is_placeholder ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                    {quiz.is_placeholder ? "Placeholder" : "Live"}
                  </span>
                  <span className="text-nuru-muted text-xs">{quiz.questions?.length ?? 0} questions</span>
                </div>
              </div>
            ) : <p className="text-sm text-nuru-muted">No quiz set up for this module yet.</p>}
          </div>

          {/* Questions */}
          {quiz && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-nuru-ink text-sm">Questions ({quiz.questions?.length ?? 0})</h3>
                <Btn label="Add question" icon={Plus} small onClick={() => setQForm(blankQ())} />
              </div>
              {(quiz.questions ?? []).map((q, i) => (
                <div key={q.id} className="bg-nuru-card rounded-xl border border-nuru-line p-4 flex gap-3 shadow-card">
                  <div className="w-7 h-7 rounded-lg grid place-items-center bg-nuru-lav text-nuru-purple text-xs font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-nuru-ink">{q.question_text}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${q.type === "mcq" ? "bg-blue-50 text-blue-700" : q.type === "tf" ? "bg-purple-50 text-purple-700" : "bg-green-50 text-green-700"}`}>{q.type}</span>
                      <span className="text-xs text-nuru-muted truncate">{q.explain}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Btn label="" icon={Edit3} variant="ghost" small onClick={() => editQ(q)} />
                    <Btn label="" icon={Trash2} variant="ghost" small onClick={() => deleteQuestion(q.id)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Quiz meta modal */}
      {quizForm && (
        <Modal title="Quiz Settings" onClose={() => setQuizForm(null)}>
          <div className="space-y-3">
            <FL label="Title" required><Input value={quizForm.title} onChange={(v) => setQuizForm((f) => f ? { ...f, title: v } : f)} /></FL>
            <FL label="Subtitle"><Textarea value={quizForm.subtitle} onChange={(v) => setQuizForm((f) => f ? { ...f, subtitle: v } : f)} rows={2} /></FL>
            <div className="grid grid-cols-2 gap-3">
              <FL label="Duration (minutes)"><Input value={quizForm.minutes} onChange={(v) => setQuizForm((f) => f ? { ...f, minutes: v } : f)} type="number" /></FL>
              <FL label="Passing %"><Input value={quizForm.passing_pct} onChange={(v) => setQuizForm((f) => f ? { ...f, passing_pct: v } : f)} type="number" /></FL>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={quizForm.is_placeholder} onChange={(e) => setQuizForm((f) => f ? { ...f, is_placeholder: e.target.checked } : f)} className="rounded" />
              <span className="text-sm text-nuru-ink">Mark as placeholder (shows a banner to learners)</span>
            </label>
            <div className="flex gap-2 pt-2">
              <Btn label="Save" icon={Save} onClick={saveQuiz} />
              <Btn label="Cancel" variant="outline" onClick={() => setQuizForm(null)} />
            </div>
          </div>
        </Modal>
      )}

      {/* Question modal */}
      {qf && (
        <Modal title={qf.id ? "Edit Question" : "New Question"} onClose={() => setQForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FL label="Position"><Input value={qf.sort_pos} onChange={(v) => setQ("sort_pos", v)} type="number" /></FL>
              <FL label="Type">
                <Select value={qf.type} onChange={(v) => setQ("type", v)}>
                  <option value="mcq">Multiple choice (MCQ)</option>
                  <option value="tf">True / False</option>
                  <option value="short">Short answer</option>
                </Select>
              </FL>
            </div>
            <FL label="Question text" required><Textarea value={qf.text} onChange={(v) => setQ("text", v)} rows={2} /></FL>
            {qf.type === "mcq" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FL label="Option A"><Input value={qf.opt_a} onChange={(v) => setQ("opt_a", v)} /></FL>
                  <FL label="Option B"><Input value={qf.opt_b} onChange={(v) => setQ("opt_b", v)} /></FL>
                  <FL label="Option C"><Input value={qf.opt_c} onChange={(v) => setQ("opt_c", v)} /></FL>
                  <FL label="Option D"><Input value={qf.opt_d} onChange={(v) => setQ("opt_d", v)} /></FL>
                </div>
                <FL label="Correct answer (0=A, 1=B, 2=C, 3=D)">
                  <Select value={qf.correct} onChange={(v) => setQ("correct", v)}>
                    <option value="0">A</option><option value="1">B</option>
                    <option value="2">C</option><option value="3">D</option>
                  </Select>
                </FL>
              </>
            )}
            {qf.type === "tf" && (
              <FL label="Correct answer">
                <Select value={qf.correct} onChange={(v) => setQ("correct", v)}>
                  <option value="true">True</option><option value="false">False</option>
                </Select>
              </FL>
            )}
            {qf.type === "short" && (
              <FL label="Accepted answers (comma-separated)">
                <Input value={qf.accept} onChange={(v) => setQ("accept", v)} placeholder="prompt, a prompt, the prompt" />
              </FL>
            )}
            <FL label="Explanation (shown after answering)" required>
              <Textarea value={qf.explain} onChange={(v) => setQ("explain", v)} rows={2} />
            </FL>
            <div className="flex gap-2 pt-2">
              <Btn label="Save Question" icon={Save} onClick={saveQuestion} disabled={!qf.text || !qf.explain} />
              <Btn label="Cancel" variant="outline" onClick={() => setQForm(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Section: DAILY CHALLENGES ────────────────────────────────────────────────

function ChallengesSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [trackId, setTrackId] = useState(TRACKS[0]?.id ?? "");
  const [moduleId, setModuleId] = useState(TRACKS[0]?.modules?.[0]?.id ?? "");
  const [lessons, setLessons] = useState<DbLesson[]>([]);
  const [selected, setSelected] = useState<DbLesson | null>(null);
  const [challenge, setChallenge] = useState<DbChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{
    question: string; type: string; opt_a: string; opt_b: string; opt_c: string; opt_d: string;
    correct: string; accept: string; hint: string; xp_reward: string;
  } | null>(null);

  const track = TRACKS.find((t) => t.id === trackId);

  useEffect(() => {
    if (!moduleId) return;
    createClient().rpc("admin_list_lessons", { p_module_id: moduleId })
      .then(({ data }) => { setLessons((data ?? []) as DbLesson[]); setSelected(null); setChallenge(null); });
  }, [moduleId]);

  async function loadChallenge(lesson: DbLesson) {
    setSelected(lesson); setLoading(true);
    const { data } = await createClient().rpc("admin_get_challenge", { p_lesson_id: lesson.id });
    setChallenge(data as DbChallenge | null);
    setLoading(false);
    if (data) {
      const c = data as DbChallenge;
      setForm({
        question: c.question, type: c.type,
        opt_a: c.options?.[0] ?? "", opt_b: c.options?.[1] ?? "", opt_c: c.options?.[2] ?? "", opt_d: c.options?.[3] ?? "",
        correct: c.type === "mcq" ? String(c.correct) : "",
        accept: Array.isArray(c.correct) ? (c.correct as string[]).join(", ") : "",
        hint: c.hint ?? "", xp_reward: String(c.xp_reward),
      });
    } else {
      setForm({ question: "", type: "mcq", opt_a: "", opt_b: "", opt_c: "", opt_d: "", correct: "0", accept: "", hint: "", xp_reward: "50" });
    }
  }

  async function save() {
    if (!form || !selected) return;
    const opts = form.type === "mcq" ? [form.opt_a, form.opt_b, form.opt_c, form.opt_d].filter(Boolean) : null;
    const correct = form.type === "mcq" ? JSON.stringify(parseInt(form.correct) || 0)
      : form.type === "short" ? JSON.stringify(form.accept.split(",").map((a) => a.trim()).filter(Boolean))
      : form.correct;
    const { error } = await createClient().rpc("admin_upsert_challenge", {
      p_lesson_id: selected.id, p_question: form.question, p_type: form.type,
      p_options: opts, p_correct: correct, p_hint: form.hint || null,
      p_xp_reward: parseInt(form.xp_reward) || 50,
    });
    if (error) return toast(error.message, true);
    toast("Challenge saved"); loadChallenge(selected);
  }

  const f = form;
  const set = (k: keyof NonNullable<typeof f>, v: string) => setForm((p) => p ? { ...p, [k]: v } : p);

  if (!TRACKS.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Left: lesson picker */}
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {TRACKS.map((t) => (
            <button key={t.id} onClick={() => { setTrackId(t.id); setModuleId(t.modules[0].id); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${trackId === t.id ? "text-white" : "bg-nuru-lav text-nuru-ink2"}`}
              style={trackId === t.id ? { background: t.tone } : undefined}>{t.subtitle}</button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {track.modules.map((m) => (
            <button key={m.id} onClick={() => setModuleId(m.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${moduleId === m.id ? "bg-nuru-purple text-white" : "bg-nuru-lav text-nuru-ink2"}`}>
              W{m.week}
            </button>
          ))}
        </div>
        <div className="bg-nuru-card rounded-2xl border border-nuru-line overflow-hidden shadow-card">
          {lessons.map((l) => (
            <button key={l.id} onClick={() => loadChallenge(l)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-nuru-line last:border-0 hover:bg-nuru-lav/30 transition-colors ${selected?.id === l.id ? "bg-nuru-lav" : ""}`}>
              <div className="w-7 h-7 rounded-lg grid place-items-center text-[11px] font-bold text-white shrink-0"
                style={{ background: track.tone }}>D{l.day}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-nuru-ink truncate">{l.title}</div>
                <div className={`text-[10px] mt-0.5 ${l.has_challenge ? "text-amber-600 font-bold" : "text-nuru-muted"}`}>
                  {l.has_challenge ? "✓ Has challenge" : "No challenge yet"}
                </div>
              </div>
            </button>
          ))}
          {lessons.length === 0 && <div className="px-4 py-6 text-xs text-nuru-muted text-center">Select a module with lessons</div>}
        </div>
      </div>

      {/* Right: challenge editor */}
      <div className="bg-nuru-card rounded-2xl border border-nuru-line shadow-card p-5">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-48 text-nuru-muted text-sm">
            <Zap size={28} className="mb-2 text-nuru-line" />
            Select a lesson to edit its daily challenge
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-nuru-muted" /></div>
        ) : f && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-nuru-ink">Challenge: Day {selected.day} — {selected.title}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${challenge ? "bg-amber-100 text-amber-800" : "bg-nuru-lav text-nuru-muted"}`}>
                {challenge ? "Exists" : "New"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FL label="Type">
                <Select value={f.type} onChange={(v) => set("type", v)}>
                  <option value="mcq">Multiple choice</option>
                  <option value="short">Short answer</option>
                </Select>
              </FL>
              <FL label="XP reward"><Input value={f.xp_reward} onChange={(v) => set("xp_reward", v)} type="number" /></FL>
            </div>

            <FL label="Question" required><Textarea value={f.question} onChange={(v) => set("question", v)} rows={2} /></FL>

            {f.type === "mcq" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FL label="Option A"><Input value={f.opt_a} onChange={(v) => set("opt_a", v)} /></FL>
                  <FL label="Option B"><Input value={f.opt_b} onChange={(v) => set("opt_b", v)} /></FL>
                  <FL label="Option C"><Input value={f.opt_c} onChange={(v) => set("opt_c", v)} /></FL>
                  <FL label="Option D"><Input value={f.opt_d} onChange={(v) => set("opt_d", v)} /></FL>
                </div>
                <FL label="Correct option">
                  <Select value={f.correct} onChange={(v) => set("correct", v)}>
                    <option value="0">A</option><option value="1">B</option>
                    <option value="2">C</option><option value="3">D</option>
                  </Select>
                </FL>
              </>
            )}

            {f.type === "short" && (
              <FL label="Accepted answers (comma-separated)">
                <Input value={f.accept} onChange={(v) => set("accept", v)} placeholder="answer1, answer2" />
              </FL>
            )}

            <FL label="Hint (optional — shown before answer)">
              <Input value={f.hint} onChange={(v) => set("hint", v)} placeholder="Think about what we covered in block 2…" />
            </FL>

            <Btn label="Save Challenge" icon={Save} onClick={save} disabled={!f.question} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: VIDEOS ──────────────────────────────────────────────────────────

function VideosSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [module, setModule] = useState(() => TRACKS[0]?.modules?.[0]?.id ?? "");
  const [day, setDay] = useState("1");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    createClient().from("lesson_videos").select("*").order("uploaded_at", { ascending: false })
      .then(({ data }) => { setVideos((data ?? []) as VideoRow[]); setLoading(false); });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !module || !title) {
      toast("Select a module, day, title and file first", true);
      return;
    }
    setUploading(true); setMsg(null); setProgress(0);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("module_id", module);
    fd.append("lesson_day", day);
    fd.append("title", title);

    // Use XHR so we can track upload progress
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status === 200) {
          setMsg("✓ " + (d.message ?? "Video uploaded successfully"));
          setTitle("");
          setProgress(0);
          if (fileRef.current) fileRef.current.value = "";
          toast("Video uploaded successfully");
          reload();
        } else {
          setMsg("✗ " + (d.error ?? "Upload failed"));
          toast(d.error ?? "Upload failed", true);
        }
      } catch {
        setMsg("✗ Unexpected server response");
        toast("Upload failed", true);
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      setMsg("✗ Network error — check your connection");
      toast("Network error", true);
    });
    xhr.open("POST", "/api/nrx-ctrl-9f4a/video-upload");
    xhr.send(fd);
  }

  async function toggleActive(id: string, current: boolean) {
    await createClient().from("lesson_videos").update({ is_active: !current }).eq("id", id);
    setVideos((v) => v.map((x) => x.id === id ? { ...x, is_active: !current } : x));
    toast(!current ? "Video activated" : "Video deactivated");
  }

  async function deleteVideo(id: string, storagePath?: string) {
    if (!confirm("Delete this video? This removes the file from storage permanently.")) return;
    const s = createClient();
    if (storagePath) {
      await s.storage.from("lesson-videos").remove([storagePath]);
    }
    const { error } = await s.from("lesson_videos").delete().eq("id", id);
    if (error) return toast(error.message, true);
    setVideos((v) => v.filter((x) => x.id !== id));
    toast("Video deleted");
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div className="bg-nuru-card rounded-2xl border border-nuru-line p-5 shadow-card">
        <h3 className="font-bold text-nuru-ink text-sm flex items-center gap-2 mb-1"><Upload size={15} /> Upload Lesson Video</h3>
        <p className="text-xs text-nuru-muted mb-4">MP4, WebM or MOV · Max 1 GB · Stored in a private bucket — only enrolled learners can stream, no public URL is ever generated</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <FL label="Module">
            <Select value={module} onChange={setModule}>
              {TRACKS.flatMap((t) => t.modules.map((m) => (
                <option key={`${t.id}:${m.id}`} value={m.id}>{t.subtitle} · W{m.week}: {m.name}</option>
              )))}
            </Select>
          </FL>
          <FL label="Lesson day">
            <Select value={day} onChange={setDay}>
              {[1,2,3,4,5].map((d) => <option key={d} value={String(d)}>Day {d}</option>)}
            </Select>
          </FL>
          <FL label="Video title (shown to learners)">
            <Input value={title} onChange={setTitle} placeholder="Introduction to Prompting" />
          </FL>
        </div>

        <div className="border-2 border-dashed border-nuru-line rounded-xl p-4 mb-3 text-center hover:border-nuru-purple/40 transition-colors">
          <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime"
            className="block w-full text-sm text-nuru-muted
              file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0
              file:text-sm file:font-bold file:bg-nuru-purple file:text-white
              file:cursor-pointer hover:file:bg-nuru-purpleDeep" />
          <p className="text-xs text-nuru-muted mt-2">MP4, WebM, MOV up to 1 GB</p>
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-nuru-purple">Uploading…</span>
              <span className="text-xs text-nuru-muted">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-nuru-lav overflow-hidden">
              <div className="h-full rounded-full bg-nuru-purple transition-all duration-200"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <Btn label={uploading ? `Uploading ${progress}%…` : "Upload Video"} icon={uploading ? Loader2 : Upload}
          onClick={upload} disabled={uploading || !module || !title} />

        {msg && (
          <p className={`text-xs mt-2.5 font-semibold flex items-center gap-1.5 ${msg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
            {msg}
          </p>
        )}
      </div>

      {/* Video list */}
      <div className="bg-nuru-card rounded-2xl border border-nuru-line shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-nuru-line flex items-center justify-between">
          <h3 className="font-bold text-nuru-ink text-sm">Uploaded videos ({videos.length})</h3>
          <button onClick={reload} className="text-xs text-nuru-muted hover:text-nuru-purple flex items-center gap-1">
            <Loader2 size={11} /> Refresh
          </button>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-nuru-muted" /></div> :
        videos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Video size={28} className="text-nuru-line mx-auto mb-2" />
            <p className="text-nuru-muted text-sm">No videos uploaded yet. Upload your first video above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line bg-nuru-lav/20">
                <th className="px-4 py-2.5">Title</th><th className="px-4 py-2.5">Module</th>
                <th className="px-4 py-2.5">Day</th><th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Uploaded</th><th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-b border-nuru-line last:border-0 hover:bg-nuru-lav/10">
                  <td className="px-4 py-3 font-semibold text-nuru-ink text-xs">{v.title}</td>
                  <td className="px-4 py-3 text-xs font-mono text-nuru-muted">{v.module_id}</td>
                  <td className="px-4 py-3 text-xs text-nuru-ink2">Day {v.lesson_day}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                      {v.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-nuru-muted">{new Date(v.uploaded_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Btn label="" icon={v.is_active ? EyeOff : Eye} variant="ghost" small onClick={() => toggleActive(v.id, v.is_active)} />
                      <Btn label="" icon={Trash2} variant="ghost" small onClick={() => deleteVideo(v.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Section: CERTIFICATES ────────────────────────────────────────────────────

function CertificatesSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [form, setForm] = useState<{
    track_id: string; title: string; subtitle: string; issuer_name: string;
    issuer_title: string; sig_name: string; sig_title: string; bg_url: string; accent: string;
  } | null>(null);

  useEffect(() => {
    createClient().rpc("admin_list_cert_templates").then(({ data }) => setTemplates((data ?? []) as CertTemplate[]));
  }, []);

  const blankForm = (trackId = "beginner") => ({
    track_id: trackId, title: "Certificate of Completion", subtitle: "This is to certify that",
    issuer_name: "Nuru AI Academy", issuer_title: "Dar es Salaam, Tanzania",
    sig_name: "", sig_title: "", bg_url: "", accent: "#6B4EFF",
  });

  function editTemplate(t: CertTemplate) {
    setForm({ track_id: t.track_id, title: t.title, subtitle: t.subtitle,
      issuer_name: t.issuer_name, issuer_title: "Dar es Salaam, Tanzania",
      sig_name: t.signature_name ?? "", sig_title: "", bg_url: "", accent: t.accent_color });
  }

  async function save() {
    if (!form) return;
    const { error } = await createClient().rpc("admin_upsert_cert_template", {
      p_track_id: form.track_id, p_title: form.title, p_subtitle: form.subtitle,
      p_issuer_name: form.issuer_name, p_issuer_title: form.issuer_title,
      p_sig_name: form.sig_name || null, p_sig_title: form.sig_title || null,
      p_bg_url: form.bg_url || null, p_accent_color: form.accent,
    });
    if (error) return toast(error.message, true);
    toast("Certificate template saved");
    const { data } = await createClient().rpc("admin_list_cert_templates");
    setTemplates((data ?? []) as CertTemplate[]);
    setForm(null);
  }

  const f = form;
  const set = (k: keyof NonNullable<typeof f>, v: string) => setForm((p) => p ? { ...p, [k]: v } : p);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn label="New Template" icon={Plus} onClick={() => setForm(blankForm())} />
      </div>

      {TRACKS.map((track) => {
        const tpl = templates.find((t) => t.track_id === track.id);
        return (
          <div key={track.id} className="bg-nuru-card rounded-2xl border border-nuru-line p-5 shadow-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: track.tone }}>
              <Award size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-nuru-ink text-sm">{track.name}</div>
              {tpl ? (
                <div className="text-xs text-nuru-muted mt-0.5">
                  Template: &ldquo;{tpl.title}&rdquo; · Issuer: {tpl.issuer_name}
                  {tpl.signature_name && ` · Signed by: ${tpl.signature_name}`}
                </div>
              ) : (
                <div className="text-xs text-nuru-rose mt-0.5">No certificate template — certificates issued without a branded design</div>
              )}
            </div>
            <Btn label={tpl ? "Edit" : "Create"} icon={tpl ? Edit3 : Plus} variant="outline" small
              onClick={() => tpl ? editTemplate(tpl) : setForm(blankForm(track.id))} />
          </div>
        );
      })}

      {/* Live preview */}
      {f && (
        <Modal title="Certificate Template" onClose={() => setForm(null)} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Form */}
            <div className="space-y-3">
              <FL label="Track">
                <Select value={f.track_id} onChange={(v) => set("track_id", v)}>
                  {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </FL>
              <FL label="Certificate title"><Input value={f.title} onChange={(v) => set("title", v)} /></FL>
              <FL label="Subtitle / preamble"><Input value={f.subtitle} onChange={(v) => set("subtitle", v)} /></FL>
              <FL label="Issuer name"><Input value={f.issuer_name} onChange={(v) => set("issuer_name", v)} /></FL>
              <FL label="Issuer location / title"><Input value={f.issuer_title} onChange={(v) => set("issuer_title", v)} /></FL>
              <div className="grid grid-cols-2 gap-3">
                <FL label="Signatory name"><Input value={f.sig_name} onChange={(v) => set("sig_name", v)} placeholder="CEO name" /></FL>
                <FL label="Signatory title"><Input value={f.sig_title} onChange={(v) => set("sig_title", v)} placeholder="CEO, Nuru" /></FL>
              </div>
              <FL label="Background image URL (optional)"><Input value={f.bg_url} onChange={(v) => set("bg_url", v)} placeholder="https://…" /></FL>
              <FL label="Accent colour"><Input value={f.accent} onChange={(v) => set("accent", v)} placeholder="#6B4EFF" /></FL>
              <div className="flex gap-2 pt-2">
                <Btn label="Save Template" icon={Save} onClick={save} />
                <Btn label="Cancel" variant="outline" onClick={() => setForm(null)} />
              </div>
            </div>

            {/* Live preview */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-nuru-muted mb-2">Live preview</div>
              <div className="border-4 rounded-2xl overflow-hidden relative p-6 text-center"
                style={{ borderColor: f.accent, background: f.bg_url ? `url(${f.bg_url}) center/cover` : "linear-gradient(135deg, #f9f7ff 0%, #f0ebff 100%)" }}>
                {f.bg_url && <div className="absolute inset-0 bg-white/70" />}
                <div className="relative z-10">
                  <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: f.accent }}>Nuru AI Academy</div>
                  <div className="font-display font-extrabold text-xl mb-1">{f.title}</div>
                  <div className="text-sm text-gray-600 mb-2">{f.subtitle}</div>
                  <div className="font-bold text-lg my-3">Learner Name</div>
                  <div className="text-xs text-gray-500">has successfully completed</div>
                  <div className="font-semibold mt-1">{TRACKS.find((t) => t.id === f.track_id)?.name}</div>
                  {f.sig_name && (
                    <div className="mt-4 border-t pt-3">
                      <div className="font-semibold text-sm">{f.sig_name}</div>
                      <div className="text-xs text-gray-500">{f.sig_title}</div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-3">{f.issuer_name} · {f.issuer_title}</div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main CMS Page ─────────────────────────────────────────────────────────────

export default function AdminCmsPage() {
  const [tab, setTab] = useState<CmsTab>("lessons");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { tracks: TRACKS, reload: reloadTracks } = useTracks();

  const toast = useCallback((m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
  }, []);

  const clearToast = useCallback(() => { setMsg(null); setErr(null); }, []);

  const TABS: { id: CmsTab; label: string; icon: typeof BookOpen }[] = [
    { id: "tracks",       label: "Tracks",      icon: Settings },
    { id: "modules",      label: "Modules",      icon: Layers },
    { id: "lessons",      label: "Lessons",      icon: BookOpen },
    { id: "quizzes",      label: "Quizzes",      icon: HelpCircle },
    { id: "challenges",   label: "Challenges",   icon: Zap },
    { id: "videos",       label: "Videos",       icon: Video },
    { id: "images",       label: "Images",       icon: ImageIcon },
    { id: "certificates", label: "Certificates", icon: Award },
    { id: "covers",       label: "Course Covers", icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen bg-nuru-bg">
      <Toast msg={msg} err={err} onClear={clearToast} />

      {/* Header */}
      <div className="border-b border-nuru-line bg-nuru-card/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-extrabold text-xl text-nuru-ink">Content Management</h1>
            <p className="text-xs text-nuru-muted mt-0.5">Create, edit, and manage all course content</p>
          </div>
          <a href="/nrx-ctrl-9f4a" className="text-xs font-semibold text-nuru-purple hover:underline">← Back to Admin</a>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 pb-0 flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                tab === id ? "border-nuru-purple text-nuru-purple" : "border-transparent text-nuru-muted hover:text-nuru-ink"
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === "tracks"       && <TracksSection toast={toast} />}
        {tab === "modules"      && <ModulesSection toast={toast} />}
        {tab === "lessons"      && <LessonsSection toast={toast} />}
        {tab === "quizzes"      && <QuizzesSection toast={toast} />}
        {tab === "challenges"   && <ChallengesSection toast={toast} />}
        {tab === "videos"       && <VideosSection toast={toast} />}
        {tab === "images"       && <ImagesSection toast={toast} />}
        {tab === "certificates" && <CertificatesSection toast={toast} />}
        {tab === "covers"       && <CourseCoverSection toast={toast} />}
      </div>
    </div>
  );
}

// ─── Section: LESSON IMAGES ───────────────────────────────────────────────────

function ImagesSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();
  const [trackId, setTrackId] = useState(TRACKS[0]?.id ?? "beginner");
  const [moduleId, setModuleId] = useState(TRACKS[0]?.modules?.[0]?.id ?? "");
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<DbLesson[]>([]);
  const [images, setImages] = useState<{ id: string; url: string; caption: string | null; sort_order: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const track = TRACKS.find((t) => t.id === trackId);

  useEffect(() => {
    if (!moduleId) return;
    createClient().rpc("admin_list_lessons", { p_module_id: moduleId })
      .then(({ data }) => { setLessons((data ?? []) as DbLesson[]); setLessonId(null); setImages([]); });
  }, [moduleId]);

  useEffect(() => {
    if (!lessonId) return;
    createClient().from("lesson_images").select("*")
      .eq("lesson_id", lessonId).order("sort_order")
      .then(({ data }) => setImages(data ?? []));
  }, [lessonId]);

  async function uploadImage() {
    const file = imgRef.current?.files?.[0];
    if (!file || !lessonId) { toast("Select a lesson and image file", true); return; }
    if (file.size > 10 * 1024 * 1024) { toast("Image too large — max 10 MB", true); return; }

    setUploading(true); setProgress(0);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `lessons/${lessonId}/${crypto.randomUUID()}.${ext}`;

    const supabase = createClient();
    const { error: upErr } = await supabase.storage.from("lesson-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    setProgress(80);

    if (upErr) { setUploading(false); toast("Upload failed: " + upErr.message, true); return; }

    const { data: { publicUrl } } = supabase.storage.from("lesson-images").getPublicUrl(path);
    await supabase.from("lesson_images").insert({
      lesson_id: lessonId, url: publicUrl, caption: caption || null,
      sort_order: images.length,
    });
    setProgress(100);
    setUploading(false); setCaption("");
    if (imgRef.current) imgRef.current.value = "";
    toast("Image uploaded");
    // Reload images
    const { data } = await supabase.from("lesson_images").select("*")
      .eq("lesson_id", lessonId).order("sort_order");
    setImages(data ?? []);
  }

  async function deleteImage(imgId: string, url: string) {
    if (!confirm("Delete this image?")) return;
    const supabase = createClient();
    // Extract storage path from public URL
    const pathMatch = url.match(/lesson-images\/(.+)$/);
    if (pathMatch) await supabase.storage.from("lesson-images").remove([pathMatch[1]]);
    await supabase.from("lesson_images").delete().eq("id", imgId);
    setImages((i) => i.filter((x) => x.id !== imgId));
    toast("Image deleted");
  }

  if (!TRACKS.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {/* Left: lesson picker */}
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {TRACKS.map((t) => (
            <button key={t.id} onClick={() => { setTrackId(t.id); setModuleId(t.modules[0]?.id ?? ""); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${trackId === t.id ? "text-white" : "bg-nuru-lav text-nuru-ink2"}`}
              style={trackId === t.id ? { background: t.tone } : undefined}>{t.subtitle}</button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {track?.modules.map((m) => (
            <button key={m.id} onClick={() => setModuleId(m.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${moduleId === m.id ? "bg-nuru-purple text-white" : "bg-nuru-lav text-nuru-ink2"}`}>
              W{m.week}
            </button>
          ))}
        </div>
        <div className="bg-nuru-card rounded-2xl border border-nuru-line overflow-hidden shadow-card">
          {lessons.map((l) => (
            <button key={l.id} onClick={() => setLessonId(l.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-nuru-line last:border-0 hover:bg-nuru-lav/30 transition-colors ${lessonId === l.id ? "bg-nuru-lav" : ""}`}>
              <div className="w-7 h-7 rounded-lg grid place-items-center text-[11px] font-bold text-white shrink-0"
                style={{ background: track?.tone }}>D{l.day}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-nuru-ink truncate">{l.title}</div>
              </div>
            </button>
          ))}
          {lessons.length === 0 && <div className="px-4 py-6 text-xs text-nuru-muted text-center">Select a module</div>}
        </div>
      </div>

      {/* Right: image manager */}
      <div className="space-y-4">
        <div className="bg-nuru-card rounded-2xl border border-nuru-line p-5 shadow-card">
          <h3 className="font-bold text-nuru-ink text-sm mb-1 flex items-center gap-2"><ImageIcon size={14} /> Lesson Cover Images</h3>
          <p className="text-xs text-nuru-muted mb-4">Upload images shown inside the lesson view. JPEG, PNG, WebP · Max 10 MB per image.</p>

          {!lessonId ? (
            <div className="flex flex-col items-center py-8 text-nuru-muted text-sm">
              <ImageIcon size={24} className="mb-2 text-nuru-line" />
              Select a lesson to manage its images
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-nuru-line rounded-xl p-4 hover:border-nuru-purple/40 transition-colors">
                <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full text-sm text-nuru-muted
                    file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0
                    file:text-sm file:font-bold file:bg-nuru-purple file:text-white file:cursor-pointer" />
              </div>
              <FL label="Caption (optional)">
                <Input value={caption} onChange={setCaption} placeholder="Students using AI tools in Dar es Salaam" />
              </FL>
              {uploading && (
                <div className="h-2 rounded-full bg-nuru-lav overflow-hidden">
                  <div className="h-full rounded-full bg-nuru-purple transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <Btn label={uploading ? "Uploading…" : "Upload Image"} icon={uploading ? Loader2 : Upload}
                onClick={uploadImage} disabled={uploading} />
            </div>
          )}
        </div>

        {/* Image gallery */}
        {lessonId && images.length > 0 && (
          <div className="bg-nuru-card rounded-2xl border border-nuru-line p-5 shadow-card">
            <h3 className="font-bold text-nuru-ink text-sm mb-3">Images ({images.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img) => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-nuru-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption ?? ""} className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <button onClick={() => deleteImage(img.id, img.url)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white p-1.5 rounded-lg">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {img.caption && (
                    <div className="px-2 py-1 text-[10px] text-nuru-muted truncate">{img.caption}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: COURSE COVER IMAGES ─────────────────────────────────────────────

/**
 * CourseCoverSection — lets admins upload a cover image for each course track.
 *
 * Images are stored in the `lesson-images` Supabase bucket under:
 *   covers/{trackId}/cover.{ext}
 *
 * The public URL is then saved to the `tracks` table's `cover_url` column.
 * ContinueLearning and RecommendedForYou read `cover_url` from the track row
 * (falls back to the hard-coded Unsplash URLs if not set).
 *
 * Admin UX:
 *   - Shows all 3 tracks in a grid
 *   - Each card previews the current cover (Unsplash default if none set)
 *   - "Change Cover" button opens a file picker + upload flow
 *   - Upload progress bar; success / error toast
 */
function CourseCoverSection({ toast }: { toast: (m: string, e?: boolean) => void }) {
  const { tracks: TRACKS } = useTracks();

  // Fallback covers (same as ContinueLearning.tsx defaults)
  const FALLBACK: Record<string, string> = {
    beginner:     "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&q=80&auto=format&fit=crop",
    intermediate: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&q=80&auto=format&fit=crop",
    expert:       "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80&auto=format&fit=crop",
  };

  return (
    <div className="space-y-6">
      <div className="bg-nuru-card rounded-2xl border border-nuru-line p-5 shadow-card">
        <h3 className="font-bold text-nuru-ink text-sm mb-1 flex items-center gap-2">
          <ImageIcon size={14} /> Course Cover Images
        </h3>
        <p className="text-xs text-nuru-muted">
          Upload the hero image shown on each course card in the dashboard and course browser.
          JPEG, PNG, WebP · Max 10 MB · Recommended 1200 × 630 px (16:9).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TRACKS.map((track) => (
          <CourseCoverCard
            key={track.id}
            track={track}
            fallbackUrl={FALLBACK[track.id] ?? FALLBACK.beginner}
            toast={toast}
          />
        ))}
      </div>
    </div>
  );
}

function CourseCoverCard({
  track,
  fallbackUrl,
  toast,
}: {
  track: { id: string; name: string; subtitle: string; tone: string };
  fallbackUrl: string;
  toast: (m: string, e?: boolean) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  // Start with the Unsplash default; replaced when we load from DB or after upload
  const [currentUrl, setCurrentUrl] = useState<string>(fallbackUrl);
  const [loaded, setLoaded] = useState(false);

  // Load the saved cover_url from the tracks table on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tracks")
        .select("cover_url")
        .eq("id", track.id)
        .single();
      if (data?.cover_url) setCurrentUrl(data.cover_url);
      setLoaded(true);
    })();
  }, [track.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast("Please select an image first", true);
    if (file.size > 10 * 1024 * 1024) return toast("Image must be under 10 MB", true);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `covers/${track.id}/cover.${ext}`;

    setUploading(true);
    setProgress(20);

    // Upload to Supabase storage
    const { error: upErr } = await supabase.storage
      .from("lesson-images")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setUploading(false);
      return toast(`Upload failed: ${upErr.message}`, true);
    }

    setProgress(70);

    // Get public URL
    const { data: urlData } = supabase.storage.from("lesson-images").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Save to tracks table
    const { error: dbErr } = await supabase
      .from("tracks")
      .update({ cover_url: publicUrl })
      .eq("id", track.id);

    setProgress(100);
    setUploading(false);

    if (dbErr) return toast(`DB update failed: ${dbErr.message}`, true);

    setCurrentUrl(publicUrl + "?t=" + Date.now()); // bust cache
    if (fileRef.current) fileRef.current.value = "";
    toast(`Cover updated for ${track.name} ✓`);
  }

  async function handleRemove() {
    if (!confirm(`Remove custom cover for "${track.name}"? The default image will be used.`)) return;
    const { error } = await supabase
      .from("tracks")
      .update({ cover_url: null })
      .eq("id", track.id);
    if (error) return toast(error.message, true);
    setCurrentUrl(fallbackUrl);
    toast("Cover removed — using default image");
  }

  return (
    <div className="bg-nuru-card rounded-2xl border border-nuru-line overflow-hidden shadow-card">
      {/* Cover preview */}
      <div className="relative w-full h-36 bg-nuru-lav overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentUrl}
          alt={track.name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = fallbackUrl; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <span
          className="absolute top-3 left-3 text-[10px] font-bold tracking-wider uppercase text-white px-2.5 py-1 rounded-full"
          style={{ background: track.tone + "cc" }}
        >
          {track.subtitle}
        </span>
        {loaded && currentUrl !== fallbackUrl && (
          <button
            onClick={handleRemove}
            className="absolute top-3 right-3 bg-red-500/80 text-white p-1.5 rounded-lg hover:bg-red-500 transition-colors"
            title="Remove custom cover"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <div className="font-semibold text-nuru-ink text-sm">{track.name}</div>
          <div className="text-[11px] text-nuru-muted mt-0.5">
            {loaded && currentUrl !== fallbackUrl ? "✓ Custom cover set" : "Using default cover"}
          </div>
        </div>

        {/* File picker */}
        <div className="border-2 border-dashed border-nuru-line rounded-xl p-3 hover:border-nuru-purple/40 transition-colors">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-xs text-nuru-muted
              file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0
              file:text-xs file:font-bold file:bg-nuru-purple file:text-white file:cursor-pointer"
          />
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="h-1.5 rounded-full bg-nuru-lav overflow-hidden">
            <div
              className="h-full rounded-full bg-nuru-purple transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <Btn
          label={uploading ? "Uploading…" : "Upload Cover"}
          icon={uploading ? Loader2 : Upload}
          onClick={handleUpload}
          disabled={uploading}
        />
      </div>
    </div>
  );
}
