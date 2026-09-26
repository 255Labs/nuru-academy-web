"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowLeft, Check, Loader2, Lock, Phone, MapPin,
  User, Mail, BookOpen, Target, Eye, Headphones,
  MonitorPlay, Layers, ChevronDown, AlertCircle,
} from "lucide-react";
import { Nuru } from "@/components/Nuru";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import { useGameStore, AGE_TIER_META, type AgeTier } from "@/lib/store";

// ── Types ──────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5;

type LearningStyle = "visual" | "reading" | "hands_on" | "video" | "mixed";
type Goal = "career" | "curiosity" | "business" | "academic" | "other";

// ── Data ───────────────────────────────────────────────────────────────────────
const LEARNING_STYLES: { id: LearningStyle; label: string; sub: string; icon: typeof Eye }[] = [
  { id: "visual",    label: "Visual",       sub: "Diagrams, infographics, charts",      icon: Eye },
  { id: "reading",   label: "Reading",      sub: "Articles, notes, written material",   icon: BookOpen },
  { id: "hands_on",  label: "Hands-on",     sub: "Exercises, projects, experiments",    icon: Layers },
  { id: "video",     label: "Video",        sub: "Lectures, tutorials, demonstrations", icon: MonitorPlay },
  { id: "mixed",     label: "Mixed",        sub: "A bit of everything works best",      icon: Headphones },
];

const GOALS: { id: Goal; label: string; sub: string; emoji: string }[] = [
  { id: "career",    label: "Career growth",   sub: "Upskill for a job or promotion",    emoji: "💼" },
  { id: "curiosity", label: "Curiosity",        sub: "I just want to understand AI",      emoji: "🔬" },
  { id: "business",  label: "My business",      sub: "Apply AI in my organisation",       emoji: "🏢" },
  { id: "academic",  label: "Academic",         sub: "School, university, or research",   emoji: "🎓" },
  { id: "other",     label: "Something else",   sub: "Another personal goal",             emoji: "✨" },
];

const AFRICAN_COUNTRIES = [
  "Tanzania","Kenya","Uganda","Rwanda","Burundi","Ethiopia","Somalia","Eritrea",
  "Djibouti","Sudan","South Sudan","Egypt","Libya","Tunisia","Algeria","Morocco",
  "Mauritania","Mali","Senegal","Gambia","Guinea-Bissau","Guinea","Sierra Leone",
  "Liberia","Ivory Coast","Ghana","Togo","Benin","Nigeria","Cameroon","Niger",
  "Chad","Central African Republic","Gabon","Equatorial Guinea","Congo",
  "DR Congo","Angola","Zambia","Zimbabwe","Mozambique","Malawi","Botswana",
  "Namibia","South Africa","Lesotho","Eswatini","Madagascar","Mauritius",
  "Seychelles","Comoros","Cape Verde","São Tomé and Príncipe",
];
const OTHER_COUNTRIES = [
  "United Kingdom","United States","Canada","Australia","Germany","France",
  "Netherlands","Sweden","Norway","Denmark","Switzerland","UAE","India",
  "China","Japan","Brazil","Other",
];
const ALL_COUNTRIES = [...AFRICAN_COUNTRIES, "─────────", ...OTHER_COUNTRIES];

// ── Progress bar ───────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
          i + 1 < step ? "bg-nuru-purple"
          : i + 1 === step ? "bg-nuru-purple/50"
          : "bg-nuru-line"
        }`} />
      ))}
      <span className="text-[11px] font-bold text-nuru-muted ml-1 shrink-0">
        {step}/{total}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const updateProfile = useGameStore((s) => s.updateProfile);
  const { tracks: TRACKS } = useTracks();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Personal details
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername]       = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("+255");
  const [country, setCountry]         = useState("Tanzania");
  const [city, setCity]               = useState("");

  // Step 2 — Learning profile
  const [ageTier, setAgeTier]               = useState<AgeTier>("adult");
  const [learningStyle, setLearningStyle]   = useState<LearningStyle>("mixed");
  const [goal, setGoal]                     = useState<Goal>("curiosity");

  // Step 3 — Track selection
  const [trackId, setTrackId] = useState("beginner");

  // Step 4 — Terms & consent
  const [termsAgreed, setTermsAgreed]       = useState(false);
  const [marketing, setMarketing]           = useState(false);
  const [notifications, setNotifications]   = useState(true);
  const [showTerms, setShowTerms]           = useState(false);

  const pickable = TRACKS.filter((t) => !t.requires);
  const locked   = TRACKS.filter((t) => t.requires);

  // ── Validation ───────────────────────────────────────────────────────────────
  function validateStep1() {
    if (!displayName.trim()) return "Please enter your name.";
    if (displayName.trim().length < 2) return "Name must be at least 2 characters.";
    if (!username.trim()) return "Please choose a username.";
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return "Username: 3–20 chars, lowercase letters, numbers, underscores only.";
    if (phone && phone !== "+255" && !/^\+[0-9]{7,15}$/.test(phone)) return "Phone must be in international format, e.g. +255712345678";
    return null;
  }

  function validateStep4() {
    if (!termsAgreed) return "You must accept the Terms of Service and Privacy Policy to continue.";
    return null;
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  function next() {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    if (step === 4) {
      const err = validateStep4();
      if (err) { setError(err); return; }
    }
    setStep((s) => Math.min(5, s + 1) as Step);
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1) as Step);
  }

  // ── Final submit ──────────────────────────────────────────────────────────────
  async function finish() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { error: rpcErr } = await supabase.rpc("complete_onboarding", {
      p_display_name:          displayName.trim(),
      p_username:              username.trim(),
      p_phone_number:          phone && phone !== "+255" ? phone : null,
      p_country:               country,
      p_city:                  city || null,
      p_learning_style:        learningStyle,
      p_goal:                  goal,
      p_age_tier:              ageTier,
      p_display_lang:          "en",
      p_track_id:              trackId,
      p_terms_agreed:          termsAgreed,
      p_marketing_consent:     marketing,
      p_notifications_consent: notifications,
    });

    setSubmitting(false);

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    updateProfile({
      displayName: displayName.trim(),
      username: username.trim(),
      ageTier,
      phoneNumber: phone !== "+255" ? phone : undefined,
      country,
      city: city || undefined,
      learningStyle,
      goal,
      onboardingComplete: true,
    });

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-nuru-bg flex items-center justify-center p-5">
      <div className="w-full max-w-2xl">
        <ProgressBar step={step} total={5} />

        {/* ── STEP 1: Personal Details ─────────────────────────────────────── */}
        {step === 1 && (
          <StepShell
            mood="wave"
            title="Let's set up your profile"
            subtitle="Tell us a bit about yourself — this personalises your learning journey."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full name *">
                  <div className="input-wrap">
                    <User size={15} className="input-icon" />
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Amina Njoroge"
                      className="input-field"
                      autoFocus
                    />
                  </div>
                </Field>
                <Field label="Username *" hint="3–20 chars, no spaces">
                  <div className="input-wrap">
                    <span className="input-icon text-nuru-muted text-sm font-semibold">@</span>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="amina_njoroge"
                      maxLength={20}
                      className="input-field"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Email address">
                <div className="input-wrap">
                  <Mail size={15} className="input-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="amina@example.com"
                    className="input-field"
                  />
                </div>
                <p className="text-[11px] text-nuru-muted mt-1">Pre-filled from your sign-in — update if needed.</p>
              </Field>

              <Field label="Phone number" hint="Used for USSD competitions and payment receipts">
                <div className="input-wrap">
                  <Phone size={15} className="input-icon" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+255712345678"
                    className="input-field"
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Country">
                  <div className="input-wrap">
                    <MapPin size={15} className="input-icon" />
                    <select
                      value={country}
                      onChange={(e) => {
                        if (e.target.value !== "─────────") setCountry(e.target.value);
                      }}
                      className="input-field"
                    >
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c} value={c} disabled={c === "─────────"}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 text-nuru-muted pointer-events-none" />
                  </div>
                </Field>
                <Field label="City / Town" hint="Optional">
                  <div className="input-wrap">
                    <MapPin size={15} className="input-icon" />
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Dar es Salaam"
                      className="input-field"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </StepShell>
        )}

        {/* ── STEP 2: Learning Profile ─────────────────────────────────────── */}
        {step === 2 && (
          <StepShell
            mood="think"
            title="How do you learn best?"
            subtitle="Nuru adapts to your learning style, age group, and goals."
          >
            <div className="space-y-6">
              {/* Age tier */}
              <div>
                <label className="field-label">I am learning as</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.entries(AGE_TIER_META) as [AgeTier, typeof AGE_TIER_META[AgeTier]][]).map(([tier, meta]) => (
                    <button
                      key={tier}
                      onClick={() => setAgeTier(tier)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                        ageTier === tier
                          ? "border-nuru-purple bg-nuru-lav shadow-sm"
                          : "border-nuru-line bg-nuru-bg hover:border-nuru-purple/30"
                      }`}
                    >
                      <span className="text-xl shrink-0">{meta.icon}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-nuru-ink truncate">{meta.label}</div>
                        <div className="text-[10px] text-nuru-muted">{meta.range}</div>
                        {meta.xpMultiplier > 1 && (
                          <div className="text-[10px] font-bold text-nuru-purple">{meta.xpMultiplier}× XP</div>
                        )}
                      </div>
                      {ageTier === tier && (
                        <div className="ml-auto w-4 h-4 rounded-full bg-nuru-purple grid place-items-center shrink-0">
                          <Check size={9} strokeWidth={3} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Learning style */}
              <div>
                <label className="field-label">My learning style</label>
                <div className="grid grid-cols-1 gap-2">
                  {LEARNING_STYLES.map(({ id, label, sub, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setLearningStyle(id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        learningStyle === id
                          ? "border-nuru-purple bg-nuru-lav"
                          : "border-nuru-line bg-nuru-bg hover:border-nuru-purple/30"
                      }`}
                    >
                      <Icon size={16} className={learningStyle === id ? "text-nuru-purple" : "text-nuru-muted"} />
                      <div className="flex-1">
                        <span className="font-semibold text-sm text-nuru-ink">{label}</span>
                        <span className="text-xs text-nuru-muted ml-2">{sub}</span>
                      </div>
                      {learningStyle === id && (
                        <Check size={14} className="text-nuru-purple shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal */}
              <div>
                <label className="field-label">My primary goal</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {GOALS.map(({ id, label, sub, emoji }) => (
                    <button
                      key={id}
                      onClick={() => setGoal(id)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                        goal === id
                          ? "border-nuru-purple bg-nuru-lav"
                          : "border-nuru-line bg-nuru-bg hover:border-nuru-purple/30"
                      }`}
                    >
                      <span className="text-xl mt-0.5 shrink-0">{emoji}</span>
                      <div>
                        <div className="font-semibold text-sm text-nuru-ink">{label}</div>
                        <div className="text-[11px] text-nuru-muted mt-0.5">{sub}</div>
                      </div>
                      {goal === id && (
                        <Check size={14} className="text-nuru-purple ml-auto shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* ── STEP 3: Track Selection ───────────────────────────────────────── */}
        {step === 3 && (
          <StepShell
            mood="cheer"
            title="Pick your starting track"
            subtitle="You can unlock more tracks as you progress. Start where you feel comfortable."
          >
            <div className="space-y-3">
              {pickable.map((t) => {
                const on = trackId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTrackId(t.id)}
                    className={`w-full text-left rounded-2xl border-2 p-5 transition-all bg-nuru-card ${
                      on ? "shadow-pop" : "border-nuru-line hover:border-nuru-purple/30"
                    }`}
                    style={on ? { borderColor: t.tone } : undefined}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-[11px] font-bold tracking-widest uppercase mb-1.5" style={{ color: t.tone }}>
                          {t.subtitle}
                        </div>
                        <div className="font-bold text-lg text-nuru-ink">{t.name}</div>
                        <p className="text-sm text-nuru-muted mt-1.5 leading-relaxed">{t.tagline}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs font-semibold text-nuru-ink2">
                          <span>TZS {t.priceTZS}</span>
                          <span className="text-nuru-line">·</span>
                          <span>Pass at {t.passingPct}%</span>
                          <span className="text-nuru-line">·</span>
                          <span>{t.modules.length} weeks</span>
                        </div>
                      </div>
                      {on && (
                        <div className="w-6 h-6 rounded-full grid place-items-center shrink-0 mt-1" style={{ background: t.tone }}>
                          <Check size={13} strokeWidth={3} className="text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {locked.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-nuru-muted mb-2 font-semibold uppercase tracking-wide">Unlocks later</p>
                  {locked.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nuru-lav text-nuru-muted text-sm mb-2">
                      <Lock size={13} />
                      <span className="font-semibold">{t.subtitle}</span>
                      <span className="text-nuru-muted/60 text-xs">— pass {t.requires} first</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </StepShell>
        )}

        {/* ── STEP 4: Terms & Consent ───────────────────────────────────────── */}
        {step === 4 && (
          <StepShell
            mood="idle"
            title="Terms & Permissions"
            subtitle="Please read and agree before we set up your account."
          >
            <div className="space-y-4">
              {/* Terms scroll box */}
              <div className="bg-nuru-bg border-2 border-nuru-line rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowTerms(!showTerms)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-nuru-ink hover:bg-nuru-lav/40 transition-colors"
                >
                  <span>Terms of Service, Privacy Policy & Data Usage</span>
                  <ChevronDown size={15} className={`text-nuru-muted transition-transform ${showTerms ? "rotate-180" : ""}`} />
                </button>

                {showTerms && (
                  <div className="px-4 pb-4 max-h-72 overflow-y-auto text-xs text-nuru-ink2 leading-relaxed space-y-3 border-t border-nuru-line">
                    <Section title="1. Service Overview">
                      Nuru AI Academy (&quot;Nuru&quot;, &quot;we&quot;, &quot;us&quot;) is a gamified AI education platform operated from Dar es Salaam, Tanzania.
                      By creating an account you agree to these Terms of Service and our Privacy Policy.
                    </Section>
                    <Section title="2. Account Eligibility">
                      You must be 6 years of age or older to use this platform. Learners under 13 require verifiable parental or guardian consent.
                      You are responsible for maintaining the security of your account credentials.
                    </Section>
                    <Section title="3. Data We Collect">
                      We collect: your name, email address, phone number (optional), country of residence, learning preferences,
                      quiz scores, progress data, session logs, and device information. This data is stored on Supabase infrastructure
                      in the European Union (Frankfurt region) and protected by industry-standard encryption at rest and in transit.
                    </Section>
                    <Section title="4. How We Use Your Data">
                      Your data is used to: personalise your learning experience, track progress and issue certificates,
                      send payment receipts and transactional emails, run USSD competitions, generate anonymised
                      platform analytics, and improve our curriculum. We do not sell your personal data to third parties.
                    </Section>
                    <Section title="5. Payments">
                      Track purchases are processed through ClickPesa (mobile money) in Tanzanian Shillings (TZS).
                      All prices are shown before checkout. Refunds are considered on a case-by-case basis within 7 days
                      of purchase if no more than 20% of course content has been accessed.
                    </Section>
                    <Section title="6. Notifications">
                      With your consent, we may send: daily streak reminders, new content announcements,
                      competition alerts, and occasional promotional offers. You can manage notification
                      preferences at any time in Settings. Transactional emails (receipts, password resets,
                      certificate links) are always sent regardless of marketing preferences.
                    </Section>
                    <Section title="7. Certificates">
                      Certificates issued by Nuru AI Academy are digital credentials verifiable at
                      nuruai.academy/verify. They represent completion of curriculum at the stated passing
                      threshold. Nuru reserves the right to revoke certificates found to have been obtained
                      through academic dishonesty.
                    </Section>
                    <Section title="8. AI Tutor">
                      The Nuru AI tutor is powered by Anthropic Claude. Conversations are scoped to curriculum
                      content only. Conversation content may be reviewed to improve the service. Do not share
                      personally sensitive information in the tutor chat.
                    </Section>
                    <Section title="9. User Conduct">
                      You agree not to: attempt to bypass course access controls, share account credentials,
                      scrape or reproduce platform content, submit false information, or engage in any activity
                      that disrupts other learners or the platform infrastructure.
                    </Section>
                    <Section title="10. Your Rights (GDPR & Tanzania PDPA)">
                      You have the right to access, correct, or delete your personal data at any time.
                      Submit requests to privacy@nuruai.academy. Accounts and all associated data can be
                      deleted from Settings → Account. Data deletion requests are processed within 30 days.
                    </Section>
                    <Section title="11. Changes to Terms">
                      We may update these terms. Material changes will be communicated by email and an
                      in-app notice at least 14 days before taking effect. Continued use of the platform
                      constitutes acceptance of the updated terms.
                    </Section>
                    <p className="text-nuru-muted pt-2">Last updated: September 2026 · privacy@nuruai.academy</p>
                  </div>
                )}
              </div>

              {/* Consent checkboxes */}
              <div className="space-y-3">
                <ConsentBox
                  checked={termsAgreed}
                  onChange={setTermsAgreed}
                  required
                  label={
                    <>I have read and agree to the <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and <strong>Data Usage</strong> policy. *</>
                  }
                />
                <ConsentBox
                  checked={notifications}
                  onChange={setNotifications}
                  label="Send me streak reminders and learning tips via email. (You can change this anytime in Settings.)"
                />
                <ConsentBox
                  checked={marketing}
                  onChange={setMarketing}
                  label="Send me occasional updates about new courses, competitions, and platform news."
                />
              </div>

              <p className="text-[11px] text-nuru-muted leading-relaxed">
                * Required. Your data is stored securely in the EU and never sold to third parties.
                Questions? Email <a href="mailto:privacy@nuruai.academy" className="text-nuru-purple hover:underline">privacy@nuruai.academy</a>
              </p>
            </div>
          </StepShell>
        )}

        {/* ── STEP 5: Confirmation ──────────────────────────────────────────── */}
        {step === 5 && (
          <StepShell
            mood="cheer"
            title={`You're all set, ${displayName || "friend"}!`}
            subtitle="Here's a summary of your choices. Hit Launch to begin your journey."
          >
            <div className="bg-nuru-lav rounded-2xl p-5 space-y-3 mb-6">
              {[
                { label: "Name",           value: displayName },
                { label: "Username",       value: `@${username}` },
                { label: "Phone",          value: phone !== "+255" ? phone : "Not provided" },
                { label: "Location",       value: [city, country].filter(Boolean).join(", ") },
                { label: "Learning as",    value: AGE_TIER_META[ageTier].label },
                { label: "Learning style", value: LEARNING_STYLES.find((l) => l.id === learningStyle)?.label ?? learningStyle },
                { label: "Goal",           value: GOALS.find((g) => g.id === goal)?.label ?? goal },
                { label: "Starting track", value: TRACKS.find((t) => t.id === trackId)?.name ?? trackId },
                { label: "Notifications",  value: notifications ? "Enabled" : "Disabled" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-nuru-muted font-medium">{label}</span>
                  <span className="font-semibold text-nuru-ink text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>

            {error && <ErrorMsg msg={error} />}

            <button
              onClick={finish}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white font-bold rounded-2xl py-4 text-base disabled:opacity-60"
            >
              {submitting
                ? <><Loader2 size={20} className="animate-spin" /> Setting up your account…</>
                : <>Launch Nuru Academy <ArrowRight size={20} /></>}
            </button>
          </StepShell>
        )}

        {/* ── Navigation buttons ────────────────────────────────────────────── */}
        {error && step !== 5 && <ErrorMsg msg={error} />}

        {step < 5 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={back}
              disabled={step === 1}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-nuru-line text-nuru-ink2 font-semibold hover:bg-nuru-lav transition-colors disabled:opacity-0"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={next}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white font-bold"
            >
              {step === 4 ? "Review & confirm" : "Continue"} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepShell({
  mood, title, subtitle, children,
}: {
  mood: "wave" | "cheer" | "think" | "idle";
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-col items-center text-center mb-7">
        <Nuru size={72} mood={mood} />
        <h1 className="font-display font-extrabold text-2xl text-nuru-ink mt-4 leading-tight">{title}</h1>
        <p className="text-nuru-muted text-sm mt-2 max-w-md leading-relaxed">{subtitle}</p>
      </div>
      <div className="bg-nuru-card rounded-2xl border border-nuru-line shadow-card p-6">
        {children}
      </div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="field-label">{label}</label>
        {hint && <span className="text-[10px] text-nuru-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-bold text-nuru-ink mb-1">{title}</p>
      <p>{children}</p>
    </div>
  );
}

function ConsentBox({
  checked, onChange, label, required = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer group p-3 rounded-xl border-2 transition-all ${
      checked ? "border-nuru-purple bg-nuru-lav/50" : "border-nuru-line hover:border-nuru-purple/30"
    }`}>
      <div
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 grid place-items-center transition-all ${
          checked ? "bg-nuru-purple border-nuru-purple" : "border-nuru-line group-hover:border-nuru-purple/50"
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} className="text-white" />}
      </div>
      <span className={`text-xs leading-relaxed ${required ? "text-nuru-ink" : "text-nuru-ink2"}`}>
        {label}
      </span>
    </label>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 leading-relaxed">{msg}</p>
    </div>
  );
}
