"use client";

import { useEffect, useRef, useState } from "react";
import { X, Smartphone, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGameStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

type Stage = "form" | "waiting" | "success" | "failed" | "error";

/**
 * Real mobile money checkout: enters a phone number, triggers an actual
 * USSD-PUSH prompt via /api/payments/initiate, then polls track_purchases
 * (RLS-scoped to the caller's own row) until the webhook
 * (/api/payments/webhook) confirms success or failure — the same table
 * both sides read/write, so this is watching for the real outcome, not a
 * fixed timer pretending to be one.
 */
export function PurchaseTrackModal({
  trackId, trackName, priceTZS, tone, onClose, onUnlocked,
}: {
  trackId: string;
  trackName: string;
  priceTZS: string;
  tone: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [stage, setStage] = useState<Stage>("form");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydrate = useGameStore((s) => s.hydrate);
  const t = useT();

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function submit() {
    setError(null);
    setStage("waiting");
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start the payment.");
        setStage("form");
        return;
      }
      setOrderReference(data.orderReference);
      startPolling(data.orderReference);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStage("form");
    }
  }

  function startPolling(ref: string) {
    const supabase = createClient();
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("track_purchases")
        .select("status")
        .eq("order_reference", ref)
        .single();

      if (data?.status === "success") {
        clearInterval(pollRef.current!);
        setStage("success");
        // Re-hydrate from the real backend so purchasedTracks (and
        // everything else) reflects the confirmed unlock immediately.
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { loadUserGameData } = await import("@/lib/supabase/queries");
          const fresh = await loadUserGameData(supabase, user.id);
          if (fresh) hydrate(fresh);
        }
        onUnlocked();
      } else if (data?.status === "failed") {
        clearInterval(pollRef.current!);
        setStage("failed");
      } else if (attempts > 40) {
        // ~2 minutes at 3s intervals — stop polling, but the webhook can
        // still land later; the purchase itself isn't lost, just not
        // reflected live anymore in this open modal.
        clearInterval(pollRef.current!);
        setStage("error");
      }
    }, 3000);
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm grid place-items-center p-5" onClick={stage === "form" ? onClose : undefined}>
      <div
        className="bg-nuru-card rounded-3xl w-full max-w-[420px] shadow-2xl animate-pop p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {stage === "form" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-nuru-ink">{t("purchase.title")} — {trackName}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-nuru-bg grid place-items-center">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-nuru-muted mb-4">
              TZS {priceTZS} — {t("purchase.phone_hint")}.
            </p>
            <label className="text-xs font-bold text-nuru-muted uppercase tracking-wide">{t("purchase.phone")}</label>
            <div className="flex items-center gap-2 mt-1.5 mb-4 px-3.5 py-3 rounded-xl bg-nuru-bg border border-nuru-line">
              <Smartphone size={16} className="text-nuru-muted" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="bg-transparent flex-1 text-sm outline-none"
              />
            </div>
            {error && <p className="text-sm text-nuru-rose mb-4">{error}</p>}
            <button
              onClick={submit}
              disabled={!phone}
              className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-50"
              style={{ background: tone }}
            >
              {t("purchase.pay").replace("{price}", priceTZS)}
            </button>
          </>
        )}

        {stage === "waiting" && (
          <div className="flex flex-col items-center text-center py-6">
            <Loader2 size={40} className="animate-spin mb-4" style={{ color: tone }} />
            <h3 className="font-display font-bold text-lg text-nuru-ink">{t("purchase.waiting")}</h3>
            <p className="text-sm text-nuru-muted mt-2 leading-relaxed">
              {t("purchase.waiting_sub").replace("{price}", priceTZS)}
              {orderReference && <span className="block text-xs text-nuru-muted/70 mt-2">Ref: {orderReference}</span>}
            </p>
          </div>
        )}

        {stage === "success" && (
          <div className="flex flex-col items-center text-center py-6">
            <CheckCircle2 size={44} className="text-nuru-green mb-3" />
            <h3 className="font-display font-bold text-lg text-nuru-ink">{t("purchase.success")}</h3>
            <p className="text-sm text-nuru-muted mt-2">{t("purchase.success_sub")}</p>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-xl text-white font-bold" style={{ background: tone }}>
              {t("general.done")}
            </button>
          </div>
        )}

        {stage === "failed" && (
          <div className="flex flex-col items-center text-center py-6">
            <XCircle size={44} className="text-nuru-rose mb-3" />
            <h3 className="font-display font-bold text-lg text-nuru-ink">{t("purchase.failed")}</h3>
            <p className="text-sm text-nuru-muted mt-2">{t("general.error")}</p>
            <button onClick={() => setStage("form")} className="mt-5 px-5 py-2.5 rounded-xl border border-nuru-line font-bold text-sm">
              {t("purchase.retry")}
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="flex flex-col items-center text-center py-6">
            <p className="text-sm text-nuru-muted leading-relaxed">{t("general.error")}</p>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-xl border border-nuru-line font-bold text-sm">
              {t("general.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
