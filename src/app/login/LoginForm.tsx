"use client";

import { useState, useRef } from "react";
import {
  Mail, ArrowRight, Loader2, Eye, EyeOff,
  Lock, CheckCircle, AlertCircle, Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Nuru } from "@/components/Nuru";

type Mode = "signin" | "signup" | "magic" | "sent" | "reset_sent";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECS = 60;

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter",  test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number",            test: (p: string) => /\d/.test(p) },
];

function strength(p: string) {
  return PASSWORD_RULES.filter((r) => r.test(p)).length;
}

const STRENGTH_LABEL  = ["", "Weak", "Fair", "Strong"];
const STRENGTH_COLOR  = ["", "bg-nuru-rose", "bg-nuru-gold", "bg-nuru-green"];
const STRENGTH_TEXT   = ["", "text-nuru-rose", "text-amber-500", "text-nuru-green"];

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode]         = useState<Mode>("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername]       = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supabase    = createClient();
  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  function reset() { setError(""); setBusy(false); }

  function startLockout() {
    const until = Date.now() + LOCKOUT_SECS * 1000;
    setLockedUntil(until);
    setCountdown(LOCKOUT_SECS);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setCountdown(0);
        setAttempts(0);
        setError("");
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  // ── Email + password sign-in ───────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (lockedUntil && Date.now() < lockedUntil) return;
    reset();
    setBusy(true);
    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setError(`Too many failed attempts. Please wait ${LOCKOUT_SECS} seconds.`);
        startLockout();
      } else {
        setError(`${err.message} (${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining)`);
      }
      setBusy(false);
    } else {
      // Register this as the ONE active session — kicks out any other device
      if (signInData.session) {
        try {
          const payloadB64 = signInData.session.access_token.split(".")[1];
          const payload = JSON.parse(atob(payloadB64));
          const sessionToken = payload.jti ?? signInData.session.access_token;
          await supabase.rpc("upsert_session", {
            p_session_token: sessionToken,
            p_device_hint:   navigator.userAgent.slice(0, 120),
            p_ip_address:    null,
          });
        } catch { /* session table not ready yet — continue anyway */ }
      }
      window.location.href = next;
    }
  }

  // ── Email + password sign-up ───────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (strength(password) < 2) { setError("Please choose a stronger password."); return; }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: {
          display_name: displayName.trim() || undefined,
          username: username.trim().toLowerCase() || undefined,
          onboarding_complete: false,
        },
      },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    } else if (data.session) {
      // Email confirmation disabled — user is signed in immediately → go to onboarding
      window.location.href = "/onboarding";
    } else {
      // Email confirmation enabled — show the "check your email" screen
      setMode("sent");
    }
  }

  // ── Magic link ────────────────────────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (err) { setError(err.message); setBusy(false); }
    else setMode("sent");
  }

  // ── Google ────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    reset();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgotPassword() {
    if (!email) { setError("Enter your email above first."); return; }
    reset();
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl(),
    });
    if (err) { setError(err.message); setBusy(false); }
    else setMode("reset_sent");
  }

  const pw_strength = strength(password);

  // ── Sent confirmation screen ───────────────────────────────────────────────
  if (mode === "sent" || mode === "reset_sent") {
    return (
      <AuthShell>
        <div className="text-center py-4 px-2">
          <div className="w-14 h-14 rounded-2xl bg-nuru-lav grid place-items-center mx-auto mb-4">
            <Mail size={26} className="text-nuru-purple" />
          </div>
          <h2 className="font-display font-extrabold text-xl text-nuru-ink mb-2">
            {mode === "reset_sent" ? "Reset link sent" : "Check your email"}
          </h2>
          <p className="text-sm text-nuru-muted leading-relaxed mb-1">
            {mode === "reset_sent"
              ? `We sent a password reset link to`
              : `We sent a secure sign-in link to`}
          </p>
          <p className="text-sm font-semibold text-nuru-ink mb-5">{email}</p>
          <p className="text-xs text-nuru-muted leading-relaxed">
            Open the link on this device to continue.
            Check your spam folder if it doesn&apos;t arrive within 2 minutes.
          </p>
          <button
            onClick={() => { setMode("signin"); setError(""); }}
            className="mt-6 text-sm text-nuru-purple font-semibold hover:underline"
          >
            ← Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <AuthShell>
      {/* Tab bar */}
      <div className="flex bg-nuru-lav rounded-xl p-1 mb-6">
        {([["signin", "Sign in"], ["signup", "Create account"]] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); setPassword(""); setAttempts(0); setLockedUntil(null); if (countdownRef.current) clearInterval(countdownRef.current); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              (mode === m || (mode === "magic" && m === "signin"))
                ? "bg-nuru-card text-nuru-ink shadow-sm"
                : "text-nuru-muted hover:text-nuru-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Google button — always shown */}
      <button
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-2.5 border-2 border-nuru-line rounded-xl py-3 text-sm font-semibold text-nuru-ink hover:border-nuru-purple/40 hover:bg-nuru-lav/50 transition-all mb-5"
      >
        <GoogleGlyph />
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-nuru-line" />
        <span className="text-xs text-nuru-muted font-medium">or with email</span>
        <div className="flex-1 h-px bg-nuru-line" />
      </div>

      {/* Sign in form */}
      {mode === "signin" && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <EmailField email={email} setEmail={setEmail} />
          <PasswordField
            password={password}
            setPassword={setPassword}
            show={showPw}
            setShow={setShowPw}
            label="Password"
          />
          {error && <ErrorMsg msg={error} />}

          {/* Lockout countdown */}
          {lockedUntil && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <Lock size={14} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 font-semibold">
                Account locked — try again in {countdown}s
              </p>
            </div>
          )}

          {/* Attempt indicator dots */}
          {attempts > 0 && !lockedUntil && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-nuru-muted">Attempts:</span>
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < attempts ? "bg-nuru-rose" : "bg-nuru-line"
                  }`}
                />
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !!lockedUntil}
            className="w-full flex items-center justify-center gap-2 bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white text-sm font-bold rounded-xl py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy
              ? <Loader2 size={16} className="animate-spin" />
              : lockedUntil
              ? <><Lock size={15} /> Locked ({countdown}s)</>
              : <>Sign in <ArrowRight size={15} /></>}
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={busy}
              className="text-xs text-nuru-muted hover:text-nuru-purple transition-colors"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => { setMode("magic"); setError(""); setPassword(""); }}
              className="flex items-center gap-1 text-xs text-nuru-purple font-semibold hover:underline"
            >
              <Sparkles size={11} /> Use magic link instead
            </button>
          </div>
        </form>
      )}

      {/* Magic link form */}
      {mode === "magic" && (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div className="bg-nuru-lav/60 border border-nuru-purple/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <Sparkles size={15} className="text-nuru-purple shrink-0 mt-0.5" />
            <p className="text-xs text-nuru-ink2 leading-relaxed">
              We&apos;ll email you a one-click sign-in link — no password needed.
            </p>
          </div>
          <EmailField email={email} setEmail={setEmail} />
          {error && <ErrorMsg msg={error} />}
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white text-sm font-bold rounded-xl py-3 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <>Send magic link <Mail size={15} /></>}
          </button>
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); }}
            className="w-full text-xs text-nuru-muted hover:text-nuru-ink transition-colors py-1"
          >
            ← Back to sign in with password
          </button>
        </form>
      )}

      {/* Sign up form */}
      {mode === "signup" && (
        <form onSubmit={handleSignUp} className="space-y-3.5">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-nuru-purple grid place-items-center text-white text-[10px] font-bold">1</div>
              <span className="text-xs font-semibold text-nuru-purple">Account</span>
            </div>
            <div className="flex-1 h-px bg-nuru-line" />
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-nuru-lav grid place-items-center text-nuru-muted text-[10px] font-bold">2</div>
              <span className="text-xs text-nuru-muted">Profile</span>
            </div>
            <div className="flex-1 h-px bg-nuru-line" />
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-nuru-lav grid place-items-center text-nuru-muted text-[10px] font-bold">3</div>
              <span className="text-xs text-nuru-muted">Track</span>
            </div>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-nuru-muted uppercase tracking-wide block mb-1.5">Full name</label>
              <div className="flex items-center gap-2 bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2.5 focus-within:border-nuru-purple transition-colors">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Balati M."
                  className="bg-transparent flex-1 text-sm text-nuru-ink outline-none placeholder:text-nuru-muted"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-nuru-muted uppercase tracking-wide block mb-1.5">Username</label>
              <div className="flex items-center gap-2 bg-nuru-bg border border-nuru-line rounded-xl px-3 py-2.5 focus-within:border-nuru-purple transition-colors">
                <span className="text-nuru-muted text-sm">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
                  placeholder="balati"
                  maxLength={24}
                  className="bg-transparent flex-1 text-sm text-nuru-ink outline-none placeholder:text-nuru-muted"
                />
              </div>
            </div>
          </div>

          <EmailField email={email} setEmail={setEmail} />
          <div className="space-y-2">
            <PasswordField
              password={password}
              setPassword={setPassword}
              show={showPw}
              setShow={setShowPw}
              label="Create a password"
            />

            {/* Strength meter */}
            {password.length > 0 && (
              <div className="space-y-2 px-0.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          pw_strength >= n ? STRENGTH_COLOR[pw_strength] : "bg-nuru-line"
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-[11px] font-bold ${STRENGTH_TEXT[pw_strength]}`}>
                    {STRENGTH_LABEL[pw_strength]}
                  </span>
                </div>
                <div className="space-y-1">
                  {PASSWORD_RULES.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5">
                      <CheckCircle
                        size={11}
                        className={rule.test(password) ? "text-nuru-green" : "text-nuru-line"}
                      />
                      <span className={`text-[11px] ${rule.test(password) ? "text-nuru-ink2" : "text-nuru-muted"}`}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <ErrorMsg msg={error} />}

          <button
            type="submit"
            disabled={busy || pw_strength < 2}
            className="w-full flex items-center justify-center gap-2 bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white text-sm font-bold rounded-xl py-3 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <>Continue to profile setup <ArrowRight size={15} /></>}
          </button>

          <p className="text-[11px] text-nuru-muted text-center leading-relaxed">
            Step 2 collects your learning profile, track, and location.
            By continuing you agree to our{" "}
            <a href="/terms" className="text-nuru-purple hover:underline">Terms</a>
            {" "}and{" "}
            <a href="/privacy" className="text-nuru-purple hover:underline">Privacy Policy</a>.
          </p>
        </form>
      )}
    </AuthShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── Auth Shell — split layout with real imagery ────────────────────────────────

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1531483245484-5ca8c23a880b?w=900&q=80&auto=format&fit=crop", // Black tech team studying, Lagos Africa
  "https://images.unsplash.com/photo-1528901166007-3784c7dd3653?w=900&q=80&auto=format&fit=crop", // Black man coding at laptop, Nigeria
  "https://images.unsplash.com/photo-1758270705290-62b6294dd044?w=900&q=80&auto=format&fit=crop", // diverse students around laptop, lecture hall
  "https://images.unsplash.com/photo-1531741403586-c19915ad5d0c?w=900&q=80&auto=format&fit=crop", // African programmer at laptop, Nigeria
];

const HERO_QUOTES = [
  { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Jifunze leo, uongeze nguvu kesho.", author: "Methali ya Kiswahili" },
];

function AuthShell({ children }: { children: React.ReactNode }) {
  const imgIdx = Math.floor(Date.now() / 86400000) % HERO_IMAGES.length;
  const quote = HERO_QUOTES[imgIdx];

  return (
    <div className="min-h-screen flex">
      {/* ── Left: imagery panel (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden">
        {/* Background — gradient fallback shown while/if image loads */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #1A0A3C 0%, #2D1B69 50%, #0D0D1A 100%)" }} />
        {/* Background image — auto=format ensures WebP served where supported */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGES[imgIdx]}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A0A3C]/85 via-[#2D1B69]/60 to-[#0D0D1A]/70" />

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 25% 25%, #6B4EFF 0%, transparent 50%), radial-gradient(circle at 75% 75%, #F5B942 0%, transparent 50%)",
          }}
        />

        {/* Content on top of image */}
        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur border border-white/20 grid place-items-center">
              <Sparkles size={18} className="text-nuru-gold" />
            </div>
            <div>
              <div className="font-display font-extrabold text-white text-lg tracking-tight">Nuru AI Academy</div>
              <div className="text-white/60 text-[10px] tracking-widest uppercase font-semibold">Tanzania&apos;s AI Learning Hub</div>
            </div>
          </div>

          {/* Floating stats */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-nuru-gold/20 border border-nuru-gold/30 rounded-full px-3.5 py-1.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-nuru-gold animate-pulse" />
                <span className="text-nuru-gold text-xs font-bold tracking-wide">LIVE PLATFORM</span>
              </div>
              <h1 className="font-display font-extrabold text-4xl xl:text-5xl text-white leading-tight mb-4">
                Learn AI.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-nuru-gold to-nuru-purple">
                  Built for Africa.
                </span>
              </h1>
              <p className="text-white/70 text-base leading-relaxed max-w-sm">
                Gamified AI education — real missions, real certificates, real skills for East Africa&apos;s next generation of builders.
              </p>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { value: "25", label: "Lessons" },
                { value: "7", label: "Languages" },
                { value: "3", label: "Tracks" },
              ].map(({ value, label }) => (
                <div key={label} className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-4 text-center">
                  <div className="font-display font-extrabold text-2xl text-white">{value}</div>
                  <div className="text-white/60 text-[11px] font-semibold uppercase tracking-wide mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="space-y-2.5">
              {[
                "✦  Earn XP and climb the leaderboard",
                "✦  Mission Quests unlock the next level",
                "✦  Compete via *278# or the web",
                "✦  Verified certificates on completion",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-white/75 text-sm">{f}</div>
              ))}
            </div>
          </div>

          {/* Quote */}
          <div className="border-t border-white/15 pt-5">
            <p className="text-white/80 text-sm italic leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
            <p className="text-white/50 text-xs mt-1.5 font-semibold">— {quote.author}</p>
          </div>
        </div>

        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-nuru-purple/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-nuru-gold/10 blur-3xl pointer-events-none" />
      </div>

      {/* ── Right: auth form panel ── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0E0E12] relative overflow-y-auto">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 80% 20%, rgba(107,78,255,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(245,185,66,0.04) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 min-h-screen">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nuru-purple to-nuru-purpleDeep grid place-items-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-display font-extrabold text-lg text-nuru-ink">Nuru AI Academy</span>
          </div>

          <div className="w-full max-w-[380px]">
            {/* Nuru mascot */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-nuru-purple/15 to-nuru-gold/10 grid place-items-center">
                  <Nuru size={52} mood="wave" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-white grid place-items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
            </div>

            {/* Card */}
            <div className="bg-white dark:bg-[#16161D] rounded-3xl border border-gray-100 dark:border-white/8 shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-7">
              {children}
            </div>

            {/* Footer */}
            <p className="text-center text-[11px] text-nuru-muted mt-5 leading-relaxed">
              🔒 Protected by Supabase Auth · Data encrypted at rest · Tanzania
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailField({
  email, setEmail,
}: { email: string; setEmail: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase mb-1.5 block">
        Email address
      </label>
      <div className="flex items-center gap-2.5 bg-nuru-bg border-2 border-nuru-line rounded-xl px-3.5 py-2.5 focus-within:border-nuru-purple transition-colors">
        <Mail size={14} className="text-nuru-muted shrink-0" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 bg-transparent text-sm text-nuru-ink outline-none placeholder:text-nuru-muted/60"
          autoComplete="email"
        />
      </div>
    </div>
  );
}

function PasswordField({
  password, setPassword, show, setShow, label,
}: {
  password: string;
  setPassword: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  label: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wide text-nuru-muted uppercase mb-1.5 block">
        {label}
      </label>
      <div className="flex items-center gap-2 bg-nuru-bg border-2 border-nuru-line rounded-xl px-3.5 py-2.5 focus-within:border-nuru-purple transition-colors">
        <Lock size={14} className="text-nuru-muted shrink-0" />
        <input
          type={show ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="flex-1 bg-transparent text-sm text-nuru-ink outline-none placeholder:text-nuru-muted/60"
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-nuru-muted hover:text-nuru-ink transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 leading-relaxed">{msg}</p>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.5 12.3c0-.85-.08-1.66-.22-2.45H12v4.63h6.44c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1C3.25 21.3 7.31 24 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6v-3.1H1.28a12 12 0 0 0 0 10.8l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}