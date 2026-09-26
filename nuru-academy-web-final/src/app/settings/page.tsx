"use client";

import { useState } from "react";
import {
  Mail, Globe, ShieldCheck, Sun, Moon,
  Save, LogOut, Loader2, User, FileText,
} from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AgeTierPicker } from "@/components/AgeTierPicker";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { useGameStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

const AVATAR_LETTERS = ["B", "N", "A", "J", "M", "S"];

export default function SettingsPage() {
  const profile      = useGameStore((s) => s.profile);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const theme        = useGameStore((s) => s.theme);
  const toggleTheme  = useGameStore((s) => s.toggleTheme);

  const [form, setForm]       = useState({ ...profile });
  const [saved, setSaved]     = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const t = useT();

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function save() {
    updateProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <Shell>
      <TopBar title={t("settings.title")} subtitle={t("settings.title")} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-8 items-start">

        {/* ── Left: Account form ─────────────────────────────────────────── */}
        <div className="space-y-8">

          {/* Profile card */}
          <Section title={t("settings.profile")} icon={<User size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label={t("general.display_name") ?? "Display name"}>
                <Input
                  value={form.displayName}
                  onChange={(v) => field("displayName", v)}
                  placeholder="Your name"
                />
              </Field>
              <Field label={t("settings.username")}>
                <div className="flex items-center bg-nuru-bg border-2 border-nuru-line rounded-xl px-4 py-3 focus-within:border-nuru-purple transition-colors">
                  <span className="text-nuru-muted text-sm select-none">@</span>
                  <input
                    value={form.username}
                    onChange={(e) =>
                      field("username", e.target.value.toLowerCase().replace(/\s+/g, ""))
                    }
                    placeholder="username"
                    className="flex-1 bg-transparent text-sm text-nuru-ink outline-none pl-1 placeholder:text-nuru-muted/50"
                  />
                </div>
              </Field>
            </div>

            <Field label={t("settings.email")} className="mt-6">
              <div className="flex items-center gap-3 bg-nuru-bg border-2 border-nuru-line rounded-xl px-4 py-3 focus-within:border-nuru-purple transition-colors">
                <Mail size={15} className="text-nuru-muted shrink-0" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent text-sm text-nuru-ink outline-none placeholder:text-nuru-muted/50"
                />
              </div>
            </Field>

            <Field label={t("settings.pref_lang")} className="mt-6">
              <div className="flex items-center gap-3 bg-nuru-bg border-2 border-nuru-line rounded-xl px-4 py-3 focus-within:border-nuru-purple transition-colors">
                <Globe size={15} className="text-nuru-muted shrink-0" />
                <select
                  value={form.language}
                  onChange={(e) =>
                    field("language", e.target.value as "English" | "Swahili")
                  }
                  className="flex-1 bg-transparent text-sm text-nuru-ink outline-none"
                >
                  <option>English</option>
                  <option>Swahili</option>
                </select>
              </div>
            </Field>
          </Section>

          {/* Bio card */}
          <Section title={t("settings.bio")} icon={<FileText size={16} />}>
            <textarea
              value={form.bio}
              onChange={(e) => field("bio", e.target.value)}
              rows={4}
              placeholder={t("settings.bio_ph")}
              className="w-full bg-nuru-bg border-2 border-nuru-line rounded-xl px-4 py-3 text-sm text-nuru-ink resize-none focus:border-nuru-purple outline-none transition-colors placeholder:text-nuru-muted/50"
            />
          </Section>

          {/* Avatar card */}
          <Section title={t("settings.avatar")}>
            <div className="flex flex-wrap gap-3">
              {AVATAR_LETTERS.map((l) => (
                <button
                  key={l}
                  onClick={() => field("avatarKey", l)}
                  className={`w-12 h-12 rounded-xl grid place-items-center font-bold text-base transition-all ${
                    form.avatarKey === l
                      ? "bg-nuru-purple text-white ring-2 ring-nuru-purple ring-offset-2 ring-offset-nuru-card shadow-pop"
                      : "bg-nuru-lav text-nuru-ink2 hover:bg-nuru-purple/20"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Section>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button
              onClick={save}
              className="flex items-center gap-2 bg-nuru-purple hover:bg-nuru-purpleDeep transition-colors text-white text-sm font-bold rounded-xl px-6 py-3"
            >
              <Save size={15} /> {t("settings.save")}
            </button>
            {saved && (
              <span className="text-sm font-semibold text-nuru-green animate-fade-in">
                ✓ {t("settings.saved_ok")}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: Preferences — sticky, scrolls independently ─────────── */}
        <div className="space-y-5 sticky top-6 max-h-[calc(100vh-4rem)] overflow-y-auto pb-4 scrollbar-hide">

          {/* Appearance */}
          <Section title={t("settings.appearance")}>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-nuru-bg border-2 border-nuru-line hover:border-nuru-purple/40 transition-colors"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-nuru-ink">
                {theme === "dark"
                  ? <Moon size={16} className="text-nuru-purple" />
                  : <Sun size={16} className="text-amber-500" />}
                {theme === "dark" ? t("settings.dark") : t("settings.light")}
              </span>
              <div
                className={`w-10 h-5 rounded-full relative transition-colors ${
                  theme === "dark" ? "bg-nuru-purple" : "bg-nuru-line"
                }`}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                  style={{ left: theme === "dark" ? 22 : 2 }}
                />
              </div>
            </button>
          </Section>

          {/* Role — local preview */}
          <Section title={t("settings.role_local")}>
            <p className="text-xs text-nuru-muted leading-relaxed mb-4">
              {t("settings.role_note")}{" "}
              <code className="text-[11px] bg-nuru-lav px-1.5 py-0.5 rounded font-mono">
                /admin
              </code>
            </p>
            <div className="flex gap-2">
              {(["student", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => updateProfile({ role: r })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold capitalize transition-all ${
                    profile.role === r
                      ? "bg-nuru-purple text-white shadow-pop"
                      : "bg-nuru-bg text-nuru-ink2 border-2 border-nuru-line hover:border-nuru-purple/40"
                  }`}
                >
                  {r === "admin" && <ShieldCheck size={14} />}
                  {t(r === "admin" ? "general.admin" : "general.student")}
                </button>
              ))}
            </div>
          </Section>

          {/* Language */}
          <Section title={t("settings.display_lang")}>
            <LanguageToggle />
          </Section>

          {/* Age / learning mode */}
          <Section title={t("settings.learning_mode")}>
            <p className="text-xs text-nuru-muted mb-4 leading-relaxed">
              {t("settings.learning_mode_sub")}
            </p>
            <AgeTierPicker />
          </Section>

          {/* Sign out */}
          <Section title={t("settings.session")}>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-nuru-rose border-2 border-nuru-rose/30 hover:bg-nuru-rose/10 transition-colors disabled:opacity-60"
            >
              {signingOut
                ? <Loader2 size={15} className="animate-spin" />
                : <LogOut size={15} />}
              {signingOut ? t("general.loading") : t("settings.sign_out")}
            </button>
          </Section>
        </div>
      </div>
    </Shell>
  );
}

// ── Reusable section card ──────────────────────────────────────────────────────
function Section({
  title, icon, children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-nuru-card rounded-2xl border border-nuru-line shadow-card p-6">
      <div className="flex items-center gap-2 mb-5">
        {icon && <span className="text-nuru-purple">{icon}</span>}
        <h3 className="font-bold text-nuru-ink text-[15px]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({
  label, children, className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] font-bold tracking-widest text-nuru-muted uppercase block mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Plain text input ───────────────────────────────────────────────────────────
function Input({
  value, onChange, placeholder, type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-nuru-bg border-2 border-nuru-line rounded-xl px-4 py-3 text-sm text-nuru-ink focus:border-nuru-purple outline-none transition-colors placeholder:text-nuru-muted/50"
    />
  );
}
