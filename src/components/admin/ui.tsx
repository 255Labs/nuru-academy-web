"use client";

import { useEffect } from "react";
import { CheckCircle, AlertCircle, X, Loader2 } from "lucide-react";

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-white/35 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, accent = "#6B4EFF", trend }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent?: string; trend?: "up" | "down" | "flat";
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] p-5"
      style={{ background: "#1E1E2A" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg grid place-items-center"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === "up" ? "bg-emerald-500/10 text-emerald-400"
            : trend === "down" ? "bg-red-500/10 text-red-400"
            : "bg-white/5 text-white/30"
          }`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-white/35">{label}</div>
      {sub && <div className="text-[10px] text-white/20 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ headers, children, empty }: {
  headers: string[]; children: React.ReactNode; empty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden" style={{ background: "#1E1E2A" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-white/30 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-white/20 text-sm">
                Nothing here yet
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function TR({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick}
      className={`border-b border-white/[0.04] last:border-0 ${onClick ? "cursor-pointer hover:bg-white/[0.02]" : ""} transition-colors`}>
      {children}
    </tr>
  );
}

export function TD({ children, mono = false, muted = false }: {
  children: React.ReactNode; mono?: boolean; muted?: boolean;
}) {
  return (
    <td className={`px-4 py-3 ${mono ? "font-mono text-xs" : "text-sm"} ${muted ? "text-white/30" : "text-white/70"}`}>
      {children}
    </td>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ label, color = "purple" }: {
  label: string;
  color?: "purple" | "green" | "red" | "amber" | "blue" | "grey";
}) {
  const MAP = {
    purple: "bg-purple-500/15 text-purple-300 border-purple-500/20",
    green:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    red:    "bg-red-500/15 text-red-300 border-red-500/20",
    amber:  "bg-amber-500/15 text-amber-300 border-amber-500/20",
    blue:   "bg-blue-500/15 text-blue-300 border-blue-500/20",
    grey:   "bg-white/8 text-white/30 border-white/10",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${MAP[color]}`}>
      {label}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ label, onClick, icon: Icon, variant = "primary", size = "md", disabled = false, type = "button" }: {
  label: string; onClick?: () => void; icon?: React.ElementType;
  variant?: "primary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md"; disabled?: boolean;
  type?: "button" | "submit";
}) {
  const sz = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const VAR = {
    primary: "bg-[#6B4EFF] hover:bg-[#5738E8] text-white",
    danger:  "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20",
    ghost:   "text-white/40 hover:text-white/80 hover:bg-white/[0.04]",
    outline: "border border-white/[0.12] text-white/60 hover:border-white/25 hover:text-white/90",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${sz} ${VAR}`}>
      {Icon && <Icon size={size === "sm" ? 12 : 14} />}
      {label}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-8 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-xl border border-white/[0.1] shadow-2xl`}
        style={{ background: "#1E1E2A" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="font-bold text-white text-sm">{title}</h3>
          <button onClick={onClose} className="text-white/25 hover:text-white/70 transition-colors p-1">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Form fields ───────────────────────────────────────────────────────────────
export function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/40 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-[#13131A] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#6B4EFF]/60 transition-colors";

export function Input({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className={inputCls + (disabled ? " opacity-40 cursor-not-allowed" : "")} />
  );
}

export function Textarea({ value, onChange, rows = 3, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)}
      rows={rows} placeholder={placeholder}
      className={inputCls + " resize-none"} />
  );
}

export function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={inputCls + " cursor-pointer"}>
      {children}
    </select>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ msg, err, onClear }: {
  msg: string | null; err: string | null; onClear: () => void;
}) {
  useEffect(() => {
    if (msg || err) { const t = setTimeout(onClear, 3000); return () => clearTimeout(t); }
  }, [msg, err, onClear]);
  if (!msg && !err) return null;
  return (
    <div className={`fixed bottom-5 right-5 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border ${
      err
        ? "bg-red-500/10 border-red-500/20 text-red-300"
        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
    }`}
      style={{ backdropFilter: "blur(12px)" }}>
      {err ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
      {err || msg}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
export function Card({ title, subtitle, action, children, padding = true }: {
  title?: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; padding?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07]" style={{ background: "#1E1E2A" }}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <div className="font-semibold text-white/80 text-sm">{title}</div>
            {subtitle && <div className="text-xs text-white/25 mt-0.5">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={padding ? "p-5" : ""}>{children}</div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={20} className="animate-spin text-white/20" />
    </div>
  );
}

// ── Search input ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = "Search…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#13131A] border border-white/[0.1] rounded-lg pl-9 pr-3 py-2 text-sm text-white/70 placeholder:text-white/20 outline-none focus:border-[#6B4EFF]/60 transition-colors" />
    </div>
  );
}
