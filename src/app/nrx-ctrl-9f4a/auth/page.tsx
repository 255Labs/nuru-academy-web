"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

export default function AdminPinPage() {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/nrx-ctrl-9f4a/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      window.location.href = "/nrx-ctrl-9f4a";
    } else {
      setError("Incorrect PIN. Try again.");
      setPin("");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-nuru-bg flex items-center justify-center p-6">
      <div className="bg-nuru-card rounded-3xl border border-nuru-line shadow-pop p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl grid place-items-center mb-4"
            style={{ background: "linear-gradient(135deg, #6B4EFF, #3E2A9E)" }}>
            <ShieldCheck size={26} className="text-white" />
          </div>
          <h1 className="font-display font-extrabold text-xl text-nuru-ink">Admin verification</h1>
          <p className="text-sm text-nuru-muted mt-1 text-center">
            Enter your admin PIN to continue
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2 bg-nuru-bg border-2 border-nuru-line rounded-2xl px-4 py-3 focus-within:border-nuru-purple transition-colors">
            <input
              type={show ? "text" : "password"}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              autoFocus
              className="flex-1 bg-transparent text-sm text-nuru-ink outline-none tracking-widest"
            />
            <button type="button" onClick={() => setShow(!show)}
              className="text-nuru-muted hover:text-nuru-ink">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-semibold text-center">{error}</p>
          )}

          <button type="submit" disabled={!pin || busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-nuru-purple text-white font-bold text-sm disabled:opacity-50 hover:bg-nuru-purpleDeep transition-colors">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            Verify & Enter
          </button>
        </form>

        <p className="text-[10px] text-nuru-muted text-center mt-4">
          This session is logged. Unauthorized access attempts are recorded.
        </p>
      </div>
    </div>
  );
}
