"use client";

import { useEffect, useState } from "react";
import { Loader2, Calendar, Users, Star, BookOpen, ChevronRight, CheckCircle } from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

interface MentorProfile {
  user_id: string;
  bio: string;
  specialties: string[];
  hourly_rate_tzs: number;
  available: boolean;
  display_name?: string;
  avatar_key?: string;
}

interface MentorSpace {
  id: string;
  mentor_id: string;
  title: string;
  description: string;
  track_id: string;
  max_learners: number;
  scheduled_at: string;
  duration_mins: number;
  status: string;
  meet_link: string | null;
  enrolled_count?: number;
}

export default function MentorsPage() {
  const t = useT();
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [spaces, setSpaces] = useState<MentorSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookedId, setBookedId] = useState<string | null>(null);
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"mentors" | "spaces" | "apply">("mentors");

  // Apply form
  const [applyBio, setApplyBio] = useState("");
  const [applyRate, setApplyRate] = useState("");
  const [applySpec, setApplySpec] = useState<string[]>([]);
  const [applySaving, setApplySaving] = useState(false);
  const [applyDone, setApplyDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("mentor_profiles")
        .select("*, player_stats(display_name, avatar_key)")
        .eq("approved", true)
        .eq("available", true),
      supabase
        .from("mentorship_spaces")
        .select("*")
        .in("status", ["open", "full"])
        .order("scheduled_at"),
    ]).then(([m, s]) => {
      if (m.data) {
        setMentors(
          m.data.map((row: any) => ({
            ...row,
            display_name: row.player_stats?.display_name,
            avatar_key: row.player_stats?.avatar_key,
          }))
        );
      }
      if (s.data) setSpaces(s.data);
      setLoading(false);
    });
  }, []);

  async function joinSpace(spaceId: string) {
    setJoinedId(spaceId);
    try {
      const supabase = createClient();
      await supabase.from("space_enrollments").insert({ space_id: spaceId });
    } catch {
      // Ignore duplicates
    }
  }

  async function bookSession(mentorId: string) {
    setBookingId(mentorId);
    try {
      const supabase = createClient();
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 3); // default: 3 days from now
      await supabase.rpc("book_mentorship_session", {
        p_mentor_id: mentorId,
        p_track_id: "beginner",
        p_scheduled_at: scheduledAt.toISOString(),
        p_duration_mins: 60,
      });
      setBookedId(mentorId);
    } catch {
      // show error
    } finally {
      setBookingId(null);
    }
  }

  async function submitApply() {
    setApplySaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("mentor_profiles").upsert({
        user_id: user.id,
        bio: applyBio,
        specialties: applySpec,
        hourly_rate_tzs: parseInt(applyRate) || 0,
        available: true,
        approved: false,
      });
      setApplyDone(true);
    } finally {
      setApplySaving(false);
    }
  }

  const TRACKS = ["beginner", "intermediate", "expert"];

  return (
    <Shell>
      <TopBar
        title={t("mentor.title")}
        subtitle="1-on-1 sessions and group tutorial spaces with approved mentors."
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-nuru-lav rounded-xl mb-6 w-fit">
        {(["mentors", "spaces", "apply"] as const).map((tab_) => (
          <button
            key={tab_}
            onClick={() => setTab(tab_)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === tab_
                ? "bg-nuru-card shadow text-nuru-ink"
                : "text-nuru-muted hover:text-nuru-ink"
            }`}
          >
            {tab_ === "mentors" ? t("mentor.title") : tab_ === "spaces" ? t("mentor.spaces") : t("mentor.apply")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-nuru-muted text-sm py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> {t("general.loading")}
        </div>
      ) : tab === "mentors" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mentors.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-nuru-muted text-sm">
              {t("mentor.no_mentors")}
            </div>
          ) : (
            mentors.map((m) => (
              <div key={m.user_id} className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-nuru-purple text-white font-bold text-sm grid place-items-center shrink-0">
                    {m.avatar_key ?? m.display_name?.[0] ?? "M"}
                  </div>
                  <div>
                    <div className="font-bold text-nuru-ink text-[15px]">{m.display_name ?? "Mentor"}</div>
                    <div className="text-xs text-nuru-muted mt-0.5">
                      {m.hourly_rate_tzs === 0
                        ? t("mentor.volunteer")
                        : t("mentor.rate", { n: m.hourly_rate_tzs.toLocaleString() })}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <Star size={13} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-bold text-nuru-ink">4.9</span>
                  </div>
                </div>

                <p className="text-sm text-nuru-ink2 mb-3 leading-relaxed">{m.bio || "AI mentor focused on making technology accessible."}</p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {m.specialties.map((s) => (
                    <span key={s} className="text-[10.5px] font-bold px-2 py-0.5 bg-nuru-lav text-nuru-purple rounded-full capitalize">
                      {s}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => bookSession(m.user_id)}
                  disabled={bookingId === m.user_id || bookedId === m.user_id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-nuru-purple text-white text-sm font-bold disabled:opacity-60 hover:bg-nuru-purpleDeep transition-colors"
                >
                  {bookedId === m.user_id ? (
                    <><CheckCircle size={14} /> {t("mentor.confirmed")}</>
                  ) : bookingId === m.user_id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <><Calendar size={14} /> {t("mentor.book")}</>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      ) : tab === "spaces" ? (
        <div className="grid grid-cols-1 gap-4">
          {spaces.length === 0 ? (
            <div className="text-center py-12 text-nuru-muted text-sm">No group spaces scheduled yet.</div>
          ) : (
            spaces.map((sp) => (
              <div key={sp.id} className="bg-nuru-card rounded-2xl p-5 shadow-card border border-nuru-line flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-nuru-green/20 grid place-items-center shrink-0">
                  <Users size={20} className="text-nuru-greenDeep" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-nuru-ink text-[15px]">{sp.title}</div>
                  <div className="text-xs text-nuru-muted mt-0.5">
                    {new Date(sp.scheduled_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}{sp.duration_mins} min
                    {" · "}<span className="capitalize">{sp.track_id}</span> track
                  </div>
                  <p className="text-sm text-nuru-ink2 mt-1">{sp.description}</p>
                </div>
                <button
                  onClick={() => joinSpace(sp.id)}
                  disabled={joinedId === sp.id || sp.status === "full"}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-nuru-purple text-white disabled:opacity-50 hover:bg-nuru-purpleDeep transition-colors"
                >
                  {joinedId === sp.id ? (
                    <><CheckCircle size={13} /> Joined</>
                  ) : sp.status === "full" ? (
                    "Full"
                  ) : (
                    <>{t("mentor.join_space")} <ChevronRight size={13} /></>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        // Apply to be a mentor
        <div className="max-w-lg">
          <div className="bg-nuru-card rounded-2xl p-6 shadow-card border border-nuru-line">
            <h2 className="font-display font-bold text-lg text-nuru-ink mb-1">{t("mentor.apply")}</h2>
            <p className="text-sm text-nuru-muted mb-6">
              Applications are reviewed by the Nuru AI Academy team. Approved mentors can set their own schedule and rates.
            </p>

            {applyDone ? (
              <div className="text-center py-8">
                <CheckCircle size={40} className="text-nuru-green mx-auto mb-3" />
                <div className="font-bold text-nuru-ink">Application submitted!</div>
                <div className="text-sm text-nuru-muted mt-1">We&apos;ll review and get back to you within 48 hours.</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-nuru-muted block mb-1.5">Bio</label>
                  <textarea
                    value={applyBio}
                    onChange={(e) => setApplyBio(e.target.value)}
                    rows={4}
                    placeholder="Your teaching background and AI expertise…"
                    className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-4 py-3 text-sm text-nuru-ink resize-none outline-none focus:border-nuru-purple"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-nuru-muted block mb-1.5">Specialties</label>
                  <div className="flex gap-2">
                    {TRACKS.map((tr) => (
                      <button
                        key={tr}
                        onClick={() => setApplySpec((s) => s.includes(tr) ? s.filter((x) => x !== tr) : [...s, tr])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border transition-all ${
                          applySpec.includes(tr)
                            ? "bg-nuru-purple text-white border-nuru-purple"
                            : "bg-nuru-bg text-nuru-ink2 border-nuru-line"
                        }`}
                      >
                        {tr}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-nuru-muted block mb-1.5">Hourly Rate (TZS) — leave 0 to volunteer</label>
                  <input
                    type="number"
                    value={applyRate}
                    onChange={(e) => setApplyRate(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full bg-nuru-bg border border-nuru-line rounded-xl px-4 py-3 text-sm text-nuru-ink outline-none focus:border-nuru-purple"
                  />
                </div>

                <button
                  onClick={submitApply}
                  disabled={applySaving || !applyBio}
                  className="w-full py-3 rounded-xl bg-nuru-purple text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-nuru-purpleDeep transition-colors"
                >
                  {applySaving ? <Loader2 size={15} className="animate-spin" /> : null}
                  Submit Application
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
