"use client";

import { useEffect, useState, useRef } from "react";
import {
  Users, BookOpen, TrendingUp, Award, Loader2, DollarSign,
  Globe, Baby, ShieldCheck, ShieldOff, UserCheck, UserX,
  Trophy, RefreshCw, Trash2, Plus, Edit3, CheckCircle,
  XCircle, Upload, BarChart2, Flag, Calendar, Bell,
  Save, X, Search, Eye, Lock, Unlock, FileText,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Learner {
  user_id: string; display_name: string; username: string; email: string;
  phone_number: string | null; country: string | null; city: string | null;
  xp: number; level: number; coins: number;
  role: "student" | "admin"; suspended: boolean;
  onboarding_complete: boolean; joined_at: string;
}
interface Certificate {
  cert_id: string; user_id: string; display_name: string; email: string;
  track_id: string; issued_at: string; verify_token: string;
}
interface Revenue {
  track_id: string; month: string; total_tzs: number;
  successful_payments: number; pending_payments: number; failed_payments: number;
}
interface Demographic { age_tier: string; display_lang: string; count: number; }
interface Competition {
  id: string; title: string; description: string; track_id: string;
  starts_at: string; ends_at: string; prize_desc: string | null;
  entry_fee_tzs: number; max_entries: number | null; status: string;
}
interface MentorRow {
  user_id: string; display_name: string; email: string;
  bio: string; specialties: string[]; hourly_rate_tzs: number;
  approved: boolean; available: boolean; created_at: string;
}
interface VideoRow {
  id: string; module_id: string; lesson_day: number;
  title: string; duration_secs: number | null; is_active: boolean; uploaded_at: string;
}

type Tab = "overview" | "learners" | "content" | "certificates" | "competitions" | "revenue" | "mentors" | "demographics";

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { tracks: TRACKS } = useTracks();
  const [tab, setTab] = useState<Tab>("overview");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [demographics, setDemographics] = useState<Demographic[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Lesson editor
  const [lessonForm, setLessonForm] = useState<{
    module_id: string; day: number; title: string; objective: string;
    b1topic: string; b1pts: string; b2topic: string; b2pts: string;
    demo: string; homework: string;
  } | null>(null);

  // Competition form
  const [compForm, setCompForm] = useState<Partial<Competition> | null>(null);

  // Issue cert form
  const [certForm, setCertForm] = useState<{ user_id: string; track_id: string } | null>(null);

  // Video upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoModule, setVideoModule] = useState("");
  const [videoDay, setVideoDay] = useState(1);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoMsg, setVideoMsg] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const supabase = createClient();
    try {
      const [lr, cr, dr, rr, mr, vr, compr] = await Promise.all([
        supabase.rpc("admin_list_learners"),
        supabase.rpc("admin_list_certificates"),
        supabase.rpc("admin_demographics"),
        supabase.rpc("admin_revenue_summary"),
        supabase.rpc("admin_list_mentors"),
        supabase.from("lesson_videos").select("*").order("uploaded_at", { ascending: false }),
        supabase.from("ussd_competitions").select("*").order("starts_at"),
      ]);
      setLearners((lr.data ?? []) as Learner[]);
      setCerts((cr.data ?? []) as Certificate[]);
      setDemographics((dr.data ?? []) as Demographic[]);
      setRevenue((rr.data ?? []) as Revenue[]);
      setMentors((mr.data ?? []) as MentorRow[]);
      setVideos((vr.data ?? []) as VideoRow[]);
      setCompetitions((compr.data ?? []) as Competition[]);
    } finally { setLoading(false); }
  }

  function toast(msg: string, isErr = false) {
    if (isErr) { setActionErr(msg); setTimeout(() => setActionErr(null), 4000); }
    else { setActionMsg(msg); setTimeout(() => setActionMsg(null), 2500); }
  }

  async function setRole(userId: string, role: "student" | "admin") {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role });
    if (error) return toast(error.message, true);
    setLearners((l) => l.map((u) => u.user_id === userId ? { ...u, role } : u));
    toast(`Role updated to ${role}`);
  }

  async function setSuspended(userId: string, suspended: boolean) {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_suspended", { p_user_id: userId, p_suspended: suspended });
    if (error) return toast(error.message, true);
    setLearners((l) => l.map((u) => u.user_id === userId ? { ...u, suspended } : u));
    toast(suspended ? "Account suspended" : "Account reactivated");
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone and removes all their data.`)) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
    if (error) return toast(error.message, true);
    setLearners((l) => l.filter((u) => u.user_id !== userId));
    toast(`${name} deleted`);
  }

  async function saveLessonForm() {
    if (!lessonForm) return;
    const supabase = createClient();
    const pts1 = lessonForm.b1pts.split("\n").map((s) => s.trim()).filter(Boolean);
    const pts2 = lessonForm.b2pts.split("\n").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.rpc("admin_upsert_lesson", {
      p_module_id: lessonForm.module_id,
      p_day: lessonForm.day,
      p_title: lessonForm.title,
      p_objective: lessonForm.objective,
      p_block1_topic: lessonForm.b1topic,
      p_block1_pts: JSON.stringify(pts1),
      p_block2_topic: lessonForm.b2topic,
      p_block2_pts: JSON.stringify(pts2),
      p_demo: lessonForm.demo || null,
      p_homework: lessonForm.homework || null,
    });
    if (error) return toast(error.message, true);
    setLessonForm(null);
    toast("Lesson saved");
  }

  async function issueCert() {
    if (!certForm) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_issue_certificate", {
      p_user_id: certForm.user_id,
      p_track_id: certForm.track_id,
    });
    if (error) return toast(error.message, true);
    setCertForm(null);
    toast(`Certificate issued — verify token: ${String(data).slice(0, 12)}…`);
    loadAll();
  }

  async function revokeCert(certId: string) {
    if (!confirm("Revoke this certificate?")) return;
    const supabase = createClient();
    await supabase.rpc("admin_revoke_certificate", { p_cert_id: certId });
    setCerts((c) => c.filter((x) => x.cert_id !== certId));
    toast("Certificate revoked");
  }

  async function reissueCert(certId: string) {
    const supabase = createClient();
    await supabase.rpc("admin_reissue_certificate", { p_cert_id: certId });
    toast("Certificate re-issued");
    loadAll();
  }

  async function saveCompetition() {
    if (!compForm) return;
    const supabase = createClient();
    await supabase.rpc("admin_upsert_competition", {
      p_id: compForm.id ?? null,
      p_title: compForm.title ?? "",
      p_description: compForm.description ?? "",
      p_track_id: compForm.track_id ?? "beginner",
      p_starts_at: compForm.starts_at ?? new Date().toISOString(),
      p_ends_at: compForm.ends_at ?? new Date().toISOString(),
      p_prize_desc: compForm.prize_desc ?? null,
      p_entry_fee_tzs: compForm.entry_fee_tzs ?? 0,
      p_status: compForm.status ?? "upcoming",
    });
    setCompForm(null);
    loadAll();
    toast("Competition saved");
  }

  async function approveMentor(userId: string, approved: boolean) {
    const supabase = createClient();
    await supabase.rpc("admin_set_mentor_approved", { p_user_id: userId, p_approved: approved });
    setMentors((m) => m.map((x) => x.user_id === userId ? { ...x, approved } : x));
    toast(approved ? "Mentor approved" : "Mentor rejected");
  }

  async function uploadVideo() {
    if (!fileRef.current?.files?.[0] || !videoModule || !videoTitle) return;
    setVideoUploading(true); setVideoMsg(null);
    const fd = new FormData();
    fd.append("file", fileRef.current.files[0]);
    fd.append("module_id", videoModule);
    fd.append("lesson_day", String(videoDay));
    fd.append("title", videoTitle);
    const res = await fetch("/api/admin/video-upload", { method: "POST", body: fd });
    const d = await res.json();
    setVideoUploading(false);
    if (res.ok) { setVideoMsg("✓ " + d.message); loadAll(); }
    else setVideoMsg("✗ " + d.error);
  }

  const totalRevenue = revenue.reduce((a, r) => a + Number(r.total_tzs), 0);
  const filtered = learners.filter((l) =>
    !search ||
    l.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.username?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "overview",      label: "Overview",      icon: BarChart2 },
    { id: "learners",      label: "Learners",       icon: Users },
    { id: "content",       label: "Content",        icon: BookOpen },
    { id: "certificates",  label: "Certificates",   icon: Award },
    { id: "competitions",  label: "Competitions",   icon: Trophy },
    { id: "revenue",       label: "Revenue",        icon: DollarSign },
    { id: "mentors",       label: "Mentors",        icon: UserCheck },
    { id: "demographics",  label: "Demographics",   icon: Globe },
  ];

  return (
    <Shell>
      <TopBar title="Admin Panel" subtitle="Platform control — learners, content, certificates, competitions." />

      {/* Toast */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 bg-nuru-purple text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-pop flex items-center gap-2">
          <CheckCircle size={15} /> {actionMsg}
        </div>
      )}
      {actionErr && (
        <div className="fixed top-4 right-4 z-50 bg-nuru-rose text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-pop flex items-center gap-2">
          <XCircle size={15} /> {actionErr}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-nuru-lav rounded-xl w-fit max-w-full overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              tab === id ? "bg-nuru-card shadow text-nuru-ink" : "text-nuru-muted hover:text-nuru-ink"
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-16 text-nuru-muted text-sm">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat icon={Users}     label="Total learners"    value={String(learners.length)} />
                <Stat icon={DollarSign} label="Total revenue"    value={`${(totalRevenue/1000).toFixed(0)}K TZS`} color="text-green-600" />
                <Stat icon={Award}     label="Certificates"      value={String(certs.length)} />
                <Stat icon={Trophy}    label="Competitions"      value={String(competitions.length)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat icon={BookOpen}  label="Videos uploaded"   value={String(videos.length)} />
                <Stat icon={UserCheck} label="Mentors"           value={String(mentors.length)} />
                <Stat icon={Globe}     label="Languages in use"  value={String(new Set(demographics.map((d) => d.display_lang)).size)} />
                <Stat icon={Users}     label="Pending mentors"   value={String(mentors.filter((m) => !m.approved).length)} />
              </div>
              <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line">
                <h3 className="font-bold text-nuru-ink text-sm mb-3">Revenue by Track (all time)</h3>
                {["beginner","intermediate","expert"].map((tid) => {
                  const r = revenue.filter((x) => x.track_id === tid);
                  const total = r.reduce((a, x) => a + Number(x.total_tzs), 0);
                  const track = TRACKS.find((t) => t.id === tid);
                  return (
                    <div key={tid} className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-nuru-ink w-44 truncate">{track?.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-nuru-lav overflow-hidden">
                        <div className="h-full rounded-full bg-nuru-purple" style={{ width: totalRevenue ? `${(total/totalRevenue)*100}%` : "0%" }} />
                      </div>
                      <span className="text-xs text-nuru-muted w-28 text-right">{total.toLocaleString()} TZS</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LEARNERS ──────────────────────────────────────────────── */}
          {tab === "learners" && (
            <div className="space-y-4">
              <div className="flex gap-3 items-center">
                <div className="flex-1 flex items-center gap-2 bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2">
                  <Search size={14} className="text-nuru-muted" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, or username…"
                    className="bg-transparent text-sm outline-none flex-1 text-nuru-ink" />
                </div>
                <span className="text-xs text-nuru-muted shrink-0">{filtered.length} learners</span>
              </div>

              <div className="bg-nuru-card rounded-2xl shadow-card border border-nuru-line overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line bg-nuru-lav/30">
                        <th className="px-4 py-3">Learner</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">XP / Level</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Joined</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u.user_id} className={`border-b border-nuru-line hover:bg-nuru-lav/10 ${u.suspended ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-nuru-ink text-xs">{u.display_name || u.username}</div>
                            <div className="text-[10px] text-nuru-muted">{u.email}</div>
                            {u.phone_number && <div className="text-[10px] text-nuru-muted">{u.phone_number}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs text-nuru-ink2">
                            {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-bold text-nuru-ink">{u.xp.toLocaleString()} XP</span>
                            <span className="text-nuru-muted ml-1">Lv.{u.level}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                              u.role === "admin" ? "bg-nuru-purple/15 text-nuru-purple" : "bg-nuru-lav text-nuru-ink2"
                            }`}>{u.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              u.suspended ? "bg-red-100 text-red-700" :
                              u.onboarding_complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-700"
                            }`}>
                              {u.suspended ? "Suspended" : u.onboarding_complete ? "Active" : "Onboarding"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-nuru-muted">
                            {new Date(u.joined_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Btn icon={u.role === "admin" ? ShieldOff : ShieldCheck}
                                title={u.role === "admin" ? "Demote" : "Promote to admin"}
                                onClick={() => setRole(u.user_id, u.role === "admin" ? "student" : "admin")} />
                              <Btn icon={u.suspended ? Unlock : Lock}
                                title={u.suspended ? "Unsuspend" : "Suspend"}
                                onClick={() => setSuspended(u.user_id, !u.suspended)} />
                              <Btn icon={Award}
                                title="Issue certificate"
                                onClick={() => setCertForm({ user_id: u.user_id, track_id: "beginner" })} />
                              <Btn icon={Trash2}
                                title="Delete account"
                                danger
                                onClick={() => deleteUser(u.user_id, u.display_name || u.email)} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-nuru-muted text-xs">No learners found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Issue certificate modal */}
              {certForm && (
                <Modal title="Issue Certificate" onClose={() => setCertForm(null)}>
                  <div className="space-y-3">
                    <FieldLabel>Learner</FieldLabel>
                    <p className="text-sm text-nuru-ink">{learners.find((l) => l.user_id === certForm.user_id)?.display_name}</p>
                    <FieldLabel>Track</FieldLabel>
                    <select value={certForm.track_id}
                      onChange={(e) => setCertForm((f) => f ? { ...f, track_id: e.target.value } : f)}
                      className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                      {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <div className="flex gap-2 pt-2">
                      <button onClick={issueCert} className="px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl">Issue Certificate</button>
                      <button onClick={() => setCertForm(null)} className="px-4 py-2 border border-nuru-line text-sm rounded-xl">Cancel</button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}

          {/* ── CONTENT: Lessons + Videos ──────────────────────────────── */}
          {tab === "content" && (
            <div className="space-y-6">
              {/* Lesson editor */}
              <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-nuru-ink text-sm flex items-center gap-2"><FileText size={15} /> Lesson Editor</h3>
                  <button onClick={() => setLessonForm({
                    module_id: "", day: 1, title: "", objective: "",
                    b1topic: "", b1pts: "", b2topic: "", b2pts: "", demo: "", homework: "",
                  })} className="flex items-center gap-1.5 px-3 py-1.5 bg-nuru-purple text-white text-xs font-bold rounded-xl">
                    <Plus size={12} /> New Lesson
                  </button>
                </div>
                <p className="text-xs text-nuru-muted mb-4">
                  Create or edit lessons for any module. Changes take effect on next page load for enrolled learners.
                </p>

                {/* Module/lesson grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line bg-nuru-lav/30">
                        <th className="px-3 py-2">Track</th>
                        <th className="px-3 py-2">Module</th>
                        <th className="px-3 py-2">Week</th>
                        <th className="px-3 py-2">Days</th>
                        <th className="px-3 py-2">Quiz</th>
                        <th className="px-3 py-2">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TRACKS.flatMap((track) =>
                        track.modules.map((mod) => (
                          <tr key={mod.id} className="border-b border-nuru-line last:border-0">
                            <td className="px-3 py-2 text-xs font-semibold text-nuru-ink">{track.subtitle}</td>
                            <td className="px-3 py-2 text-xs text-nuru-ink2">{mod.name}</td>
                            <td className="px-3 py-2 text-xs text-nuru-muted">Week {mod.week}</td>
                            <td className="px-3 py-2 text-xs text-nuru-muted">{mod.lessons.length} lessons</td>
                            <td className="px-3 py-2">
                              {mod.quiz ? (
                                (mod.quiz as { placeholder?: boolean }).placeholder
                                  ? <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">Placeholder</span>
                                  : <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full">Live</span>
                              ) : (
                                <span className="text-[10px] text-nuru-muted">None</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => setLessonForm({
                                module_id: mod.id, day: 1, title: "", objective: "",
                                b1topic: "", b1pts: "", b2topic: "", b2pts: "", demo: "", homework: "",
                              })} className="p-1 hover:bg-nuru-lav rounded-lg text-nuru-muted hover:text-nuru-purple">
                                <Edit3 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lesson editor modal */}
              {lessonForm && (
                <Modal title={`${lessonForm.module_id ? "Edit" : "New"} Lesson`} onClose={() => setLessonForm(null)}>
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Module</FieldLabel>
                        <select value={lessonForm.module_id}
                          onChange={(e) => setLessonForm((f) => f ? { ...f, module_id: e.target.value } : f)}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                          <option value="">— select —</option>
                          {TRACKS.flatMap((t) => t.modules.map((m) => (
                            <option key={m.id} value={m.id}>{t.subtitle} · W{m.week}: {m.name}</option>
                          )))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Day (1–5)</FieldLabel>
                        <input type="number" min={1} max={5} value={lessonForm.day}
                          onChange={(e) => setLessonForm((f) => f ? { ...f, day: parseInt(e.target.value) || 1 } : f)}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                      </div>
                    </div>
                    {[
                      { label: "Title", key: "title" as const },
                      { label: "Objective", key: "objective" as const },
                      { label: "Block 1: Topic", key: "b1topic" as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <FieldLabel>{label}</FieldLabel>
                        <input value={lessonForm[key]}
                          onChange={(e) => setLessonForm((f) => f ? { ...f, [key]: e.target.value } : f)}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                      </div>
                    ))}
                    <div>
                      <FieldLabel>Block 1: Points (one per line)</FieldLabel>
                      <textarea rows={4} value={lessonForm.b1pts}
                        onChange={(e) => setLessonForm((f) => f ? { ...f, b1pts: e.target.value } : f)}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm resize-none" />
                    </div>
                    <div>
                      <FieldLabel>Block 2: Topic</FieldLabel>
                      <input value={lessonForm.b2topic}
                        onChange={(e) => setLessonForm((f) => f ? { ...f, b2topic: e.target.value } : f)}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <FieldLabel>Block 2: Points (one per line)</FieldLabel>
                      <textarea rows={4} value={lessonForm.b2pts}
                        onChange={(e) => setLessonForm((f) => f ? { ...f, b2pts: e.target.value } : f)}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm resize-none" />
                    </div>
                    <div>
                      <FieldLabel>Demo (optional)</FieldLabel>
                      <textarea rows={2} value={lessonForm.demo}
                        onChange={(e) => setLessonForm((f) => f ? { ...f, demo: e.target.value } : f)}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm resize-none" />
                    </div>
                    <div>
                      <FieldLabel>Homework (optional)</FieldLabel>
                      <textarea rows={2} value={lessonForm.homework}
                        onChange={(e) => setLessonForm((f) => f ? { ...f, homework: e.target.value } : f)}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm resize-none" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveLessonForm} className="flex items-center gap-1.5 px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl">
                        <Save size={14} /> Save Lesson
                      </button>
                      <button onClick={() => setLessonForm(null)} className="px-4 py-2 border border-nuru-line text-sm rounded-xl">Cancel</button>
                    </div>
                  </div>
                </Modal>
              )}

              {/* Video upload */}
              <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line">
                <h3 className="font-bold text-nuru-ink text-sm flex items-center gap-2 mb-3"><Upload size={15} /> Upload Lesson Video</h3>
                <p className="text-xs text-nuru-muted mb-4">Videos stored in a private bucket. Only enrolled learners can stream them. Max 1 GB.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <FieldLabel>Module</FieldLabel>
                    <select value={videoModule} onChange={(e) => setVideoModule(e.target.value)}
                      className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                      <option value="">— select module —</option>
                      {TRACKS.flatMap((t) => t.modules.map((m) => (
                        <option key={`${t.id}:${m.id}`} value={m.id}>{t.subtitle} · W{m.week}: {m.name}</option>
                      )))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Lesson day</FieldLabel>
                    <select value={videoDay} onChange={(e) => setVideoDay(parseInt(e.target.value))}
                      className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                      {[1,2,3,4,5].map((d) => <option key={d} value={d}>Day {d}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Video title</FieldLabel>
                    <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Introduction to Prompting"
                      className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime"
                    className="text-xs text-nuru-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-nuru-purple file:text-white" />
                  <button onClick={uploadVideo} disabled={videoUploading || !videoModule || !videoTitle}
                    className="flex items-center gap-2 px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl disabled:opacity-50">
                    {videoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
                  </button>
                </div>
                {videoMsg && <p className={`text-xs mt-2 font-semibold ${videoMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{videoMsg}</p>}

                {videos.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line">
                          <th className="px-3 py-2">Title</th><th className="px-3 py-2">Module</th>
                          <th className="px-3 py-2">Day</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Uploaded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {videos.map((v) => (
                          <tr key={v.id} className="border-b border-nuru-line last:border-0">
                            <td className="px-3 py-2 font-semibold text-nuru-ink">{v.title}</td>
                            <td className="px-3 py-2 text-nuru-muted font-mono text-[10px]">{v.module_id}</td>
                            <td className="px-3 py-2 text-nuru-ink2">Day {v.lesson_day}</td>
                            <td className="px-3 py-2">
                              <span className={`font-bold px-1.5 py-0.5 rounded-full text-[10px] ${v.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                                {v.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-nuru-muted">{new Date(v.uploaded_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CERTIFICATES ──────────────────────────────────────────── */}
          {tab === "certificates" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setCertForm({ user_id: "", track_id: "beginner" })}
                  className="flex items-center gap-1.5 px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl">
                  <Plus size={14} /> Issue Certificate
                </button>
              </div>

              {certForm && (
                <Modal title="Issue Certificate" onClose={() => setCertForm(null)}>
                  <div className="space-y-3">
                    <div>
                      <FieldLabel>Learner</FieldLabel>
                      <select value={certForm.user_id}
                        onChange={(e) => setCertForm((f) => f ? { ...f, user_id: e.target.value } : f)}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                        <option value="">— select learner —</option>
                        {learners.map((l) => (
                          <option key={l.user_id} value={l.user_id}>{l.display_name} ({l.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Track</FieldLabel>
                      <select value={certForm.track_id}
                        onChange={(e) => setCertForm((f) => f ? { ...f, track_id: e.target.value } : f)}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                        {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={issueCert} disabled={!certForm.user_id}
                        className="px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl disabled:opacity-50">Issue</button>
                      <button onClick={() => setCertForm(null)} className="px-4 py-2 border border-nuru-line text-sm rounded-xl">Cancel</button>
                    </div>
                  </div>
                </Modal>
              )}

              <div className="bg-nuru-card rounded-2xl shadow-card border border-nuru-line overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line bg-nuru-lav/30">
                      <th className="px-4 py-3">Learner</th><th className="px-4 py-3">Track</th>
                      <th className="px-4 py-3">Issued</th><th className="px-4 py-3">Verify token</th><th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-nuru-muted text-xs">No certificates yet.</td></tr>
                    ) : certs.map((c) => (
                      <tr key={c.cert_id} className="border-b border-nuru-line last:border-0">
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-nuru-ink">{c.display_name}</div>
                          <div className="text-[10px] text-nuru-muted">{c.email}</div>
                        </td>
                        <td className="px-4 py-3 text-xs capitalize text-nuru-ink2">{c.track_id}</td>
                        <td className="px-4 py-3 text-xs text-nuru-muted">{new Date(c.issued_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <code className="text-[10px] text-nuru-purple bg-nuru-lav px-1 py-0.5 rounded">{c.verify_token.slice(0,12)}…</code>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Btn icon={RefreshCw} title="Re-issue" onClick={() => reissueCert(c.cert_id)} />
                            <Btn icon={Trash2} title="Revoke" danger onClick={() => revokeCert(c.cert_id)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COMPETITIONS ──────────────────────────────────────────── */}
          {tab === "competitions" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setCompForm({})}
                  className="flex items-center gap-1.5 px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl">
                  <Plus size={14} /> New Competition
                </button>
              </div>

              {compForm !== null && (
                <Modal title={compForm.id ? "Edit Competition" : "New Competition"} onClose={() => setCompForm(null)}>
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    <div>
                      <FieldLabel>Title</FieldLabel>
                      <input value={compForm.title ?? ""} onChange={(e) => setCompForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <FieldLabel>Description</FieldLabel>
                      <textarea rows={2} value={compForm.description ?? ""} onChange={(e) => setCompForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Track</FieldLabel>
                        <select value={compForm.track_id ?? "beginner"} onChange={(e) => setCompForm((f) => ({ ...f, track_id: e.target.value }))}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="expert">Expert</option>
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <select value={compForm.status ?? "upcoming"} onChange={(e) => setCompForm((f) => ({ ...f, status: e.target.value }))}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm">
                          <option value="upcoming">Upcoming</option>
                          <option value="active">Active</option>
                          <option value="ended">Ended</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Starts at</FieldLabel>
                        <input type="datetime-local" value={compForm.starts_at?.slice(0,16) ?? ""}
                          onChange={(e) => setCompForm((f) => ({ ...f, starts_at: new Date(e.target.value).toISOString() }))}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <FieldLabel>Ends at</FieldLabel>
                        <input type="datetime-local" value={compForm.ends_at?.slice(0,16) ?? ""}
                          onChange={(e) => setCompForm((f) => ({ ...f, ends_at: new Date(e.target.value).toISOString() }))}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Prize description</FieldLabel>
                      <input value={compForm.prize_desc ?? ""} onChange={(e) => setCompForm((f) => ({ ...f, prize_desc: e.target.value }))}
                        placeholder="e.g. TZS 50,000 airtime for top 3"
                        className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Entry fee (TZS, 0 = free)</FieldLabel>
                        <input type="number" value={compForm.entry_fee_tzs ?? 0}
                          onChange={(e) => setCompForm((f) => ({ ...f, entry_fee_tzs: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <FieldLabel>Max entries (blank = unlimited)</FieldLabel>
                        <input type="number" value={compForm.max_entries ?? ""} placeholder="Unlimited"
                          onChange={(e) => setCompForm((f) => ({ ...f, max_entries: parseInt(e.target.value) || undefined }))}
                          className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveCompetition} className="flex items-center gap-1.5 px-4 py-2 bg-nuru-purple text-white text-sm font-bold rounded-xl">
                        <Calendar size={14} /> Save Competition
                      </button>
                      <button onClick={() => setCompForm(null)} className="px-4 py-2 border border-nuru-line text-sm rounded-xl">Cancel</button>
                    </div>
                  </div>
                </Modal>
              )}

              <div className="bg-nuru-card rounded-2xl shadow-card border border-nuru-line overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line bg-nuru-lav/30">
                      <th className="px-4 py-3">Title</th><th className="px-4 py-3">Track</th>
                      <th className="px-4 py-3">Status</th><th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Prize</th><th className="px-4 py-3">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitions.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-nuru-muted text-xs">No competitions yet.</td></tr>
                    ) : competitions.map((c) => (
                      <tr key={c.id} className="border-b border-nuru-line last:border-0">
                        <td className="px-4 py-3 text-xs font-semibold text-nuru-ink">{c.title}</td>
                        <td className="px-4 py-3 text-xs capitalize text-nuru-ink2">{c.track_id}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                            c.status === "active" ? "bg-green-100 text-green-800"
                            : c.status === "upcoming" ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-500"
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-nuru-muted">
                          {new Date(c.starts_at).toLocaleDateString()} – {new Date(c.ends_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-nuru-muted">{c.prize_desc ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Btn icon={Edit3} title="Edit" onClick={() => setCompForm(c)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── REVENUE ───────────────────────────────────────────────── */}
          {tab === "revenue" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button onClick={loadAll} className="flex items-center gap-1.5 text-xs text-nuru-muted hover:text-nuru-purple">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {["beginner","intermediate","expert"].map((tid) => {
                  const r = revenue.filter((x) => x.track_id === tid);
                  const total = r.reduce((a, x) => a + Number(x.total_tzs), 0);
                  const count = r.reduce((a, x) => a + Number(x.successful_payments), 0);
                  const track = TRACKS.find((t) => t.id === tid);
                  return (
                    <div key={tid} className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line">
                      <div className="text-xs font-bold text-nuru-muted mb-1">{track?.name}</div>
                      <div className="font-display font-bold text-2xl text-nuru-ink">{total.toLocaleString()} TZS</div>
                      <div className="text-xs text-nuru-muted mt-1">{count} successful payments</div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-nuru-card rounded-2xl shadow-card border border-nuru-line overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line bg-nuru-lav/30">
                      <th className="px-4 py-3">Month</th><th className="px-4 py-3">Track</th>
                      <th className="px-4 py-3">Revenue</th><th className="px-4 py-3">Success</th>
                      <th className="px-4 py-3">Pending</th><th className="px-4 py-3">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-nuru-muted text-xs">No payment data yet.</td></tr>
                    ) : revenue.map((r, i) => (
                      <tr key={i} className="border-b border-nuru-line last:border-0">
                        <td className="px-4 py-3 text-xs font-semibold text-nuru-ink">{r.month}</td>
                        <td className="px-4 py-3 text-xs capitalize text-nuru-ink2">{r.track_id}</td>
                        <td className="px-4 py-3 text-xs font-bold text-nuru-ink">{Number(r.total_tzs).toLocaleString()} TZS</td>
                        <td className="px-4 py-3 text-xs text-green-700">{r.successful_payments}</td>
                        <td className="px-4 py-3 text-xs text-amber-700">{r.pending_payments}</td>
                        <td className="px-4 py-3 text-xs text-red-600">{r.failed_payments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── MENTORS ───────────────────────────────────────────────── */}
          {tab === "mentors" && (
            <div className="bg-nuru-card rounded-2xl shadow-card border border-nuru-line overflow-hidden">
              <div className="p-4 border-b border-nuru-line">
                <h2 className="font-bold text-nuru-ink text-sm">
                  Mentor applications — {mentors.filter((m) => !m.approved).length} pending
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold tracking-wide text-nuru-muted uppercase border-b border-nuru-line bg-nuru-lav/30">
                    <th className="px-4 py-3">Name</th><th className="px-4 py-3">Specialties</th>
                    <th className="px-4 py-3">Rate</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mentors.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-nuru-muted text-xs">No mentor applications yet.</td></tr>
                  ) : mentors.map((m) => (
                    <tr key={m.user_id} className="border-b border-nuru-line last:border-0">
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-nuru-ink">{m.display_name}</div>
                        <div className="text-[10px] text-nuru-muted">{m.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.specialties.map((s) => (
                            <span key={s} className="text-[10px] font-bold px-1.5 py-0.5 bg-nuru-lav text-nuru-purple rounded-full capitalize">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{m.hourly_rate_tzs === 0 ? "Volunteer" : `${m.hourly_rate_tzs.toLocaleString()} TZS/hr`}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${m.approved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {m.approved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Btn icon={CheckCircle} title="Approve" onClick={() => approveMentor(m.user_id, true)} />
                          <Btn icon={XCircle} title="Reject" danger onClick={() => approveMentor(m.user_id, false)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── DEMOGRAPHICS ──────────────────────────────────────────── */}
          {tab === "demographics" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DemBar title="Age Tiers" icon={<Baby size={14} />}
                items={["child","teen","adult","professional","unknown"].map((tier) => ({
                  label: { child:"Explorer (6-12)", teen:"Challenger (13-17)", adult:"Learner (18+)", professional:"Professional", unknown:"Unknown" }[tier]!,
                  count: demographics.filter((d) => d.age_tier === tier).reduce((a, d) => a + Number(d.count), 0),
                  total: demographics.reduce((a, d) => a + Number(d.count), 0),
                  color: "bg-nuru-purple",
                }))} />
              <DemBar title="Languages" icon={<Globe size={14} />}
                items={["en","sw","fr","am","ha","yo","zu"].map((code) => ({
                  label: {en:"English",sw:"Swahili",fr:"French",am:"Amharic",ha:"Hausa",yo:"Yoruba",zu:"Zulu"}[code]!,
                  count: demographics.filter((d) => d.display_lang === code).reduce((a, d) => a + Number(d.count), 0),
                  total: demographics.reduce((a, d) => a + Number(d.count), 0),
                  color: "bg-nuru-green",
                }))} />
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, color = "text-nuru-purple" }: {
  icon: typeof Users; label: string; value: string; color?: string;
}) {
  return (
    <div className="bg-nuru-card rounded-2xl p-4 shadow-card border border-nuru-line">
      <Icon size={16} className={`${color} mb-1.5`} />
      <div className="font-display font-bold text-xl text-nuru-ink">{value}</div>
      <div className="text-[11px] text-nuru-muted mt-0.5">{label}</div>
    </div>
  );
}

function Btn({ icon: Icon, title, onClick, danger = false }: {
  icon: typeof Trash2; title: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-lg transition-colors ${danger ? "hover:bg-red-50 text-nuru-muted hover:text-red-500" : "hover:bg-nuru-lav text-nuru-muted hover:text-nuru-purple"}`}>
      <Icon size={13} />
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-bold uppercase tracking-wide text-nuru-muted block mb-1">{children}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-nuru-ink/50 backdrop-blur-sm grid place-items-center p-5" onClick={onClose}>
      <div className="bg-nuru-card rounded-2xl w-full max-w-lg shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-nuru-ink">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-nuru-lav grid place-items-center text-nuru-muted hover:text-nuru-ink">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DemBar({ title, icon, items }: {
  title: string; icon: React.ReactNode;
  items: { label: string; count: number; total: number; color: string }[];
}) {
  return (
    <div className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line">
      <h3 className="font-bold text-nuru-ink text-sm mb-4 flex items-center gap-2">{icon} {title}</h3>
      {items.map(({ label, count, total, color }) => (
        <div key={label} className="flex items-center gap-3 mb-3">
          <span className="text-xs text-nuru-ink2 w-40 shrink-0">{label}</span>
          <div className="flex-1 h-2 rounded-full bg-nuru-lav overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: total ? `${(count/total)*100}%` : "0%" }} />
          </div>
          <span className="text-xs font-bold text-nuru-ink w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}
