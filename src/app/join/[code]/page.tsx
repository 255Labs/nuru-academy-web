"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building2, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type State =
  | { phase: "loading" }
  | { phase: "needs_auth" }
  | { phase: "redeeming" }
  | { phase: "success"; orgName: string }
  | { phase: "error"; message: string };

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router    = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();

      if (!user) {
        if (!cancelled) setState({ phase: "needs_auth" });
        return;
      }

      if (!cancelled) setState({ phase: "redeeming" });

      const { data, error } = await sb.rpc("redeem_org_invite", { p_code: code });

      if (cancelled) return;

      if (error) {
        setState({ phase: "error", message: error.message });
      } else {
        const orgName = (data as { org_name?: string } | null)?.org_name ?? "your organization";
        setState({ phase: "success", orgName });
        // Redirect to courses after a brief celebration moment
        setTimeout(() => router.push("/courses"), 3000);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [code, router]);

  function handleAuth() {
    // Redirect to sign-in, preserving the invite URL so they land back here
    router.push(`/auth?next=/join/${code}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 app-bg">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] p-8 text-center space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>

          {/* Brand mark */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl grid place-items-center shadow-pop"
              style={{ background: "linear-gradient(135deg, #7C5CFF 0%, #3E2A9E 100%)" }}>
              {state.phase === "success"
                ? <CheckCircle2 size={26} className="text-white" />
                : state.phase === "error"
                  ? <AlertCircle size={26} className="text-red-300" />
                  : <Building2 size={26} className="text-white" />
              }
            </div>
          </div>

          {/* Loading */}
          {state.phase === "loading" && (
            <>
              <Loader2 size={20} className="animate-spin text-nuru-purple mx-auto" />
              <p className="text-sm text-nuru-muted">Checking your invite…</p>
            </>
          )}

          {/* Needs auth */}
          {state.phase === "needs_auth" && (
            <>
              <h1 className="text-xl font-bold text-nuru-ink">You&apos;ve been invited!</h1>
              <p className="text-sm text-nuru-muted leading-relaxed">
                Sign in or create a free account to activate your corporate seat on Nuru Academy.
              </p>
              <button onClick={handleAuth}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg, #7C5CFF, #6040F0)" }}>
                Sign in to claim your seat
              </button>
              <p className="text-xs text-nuru-muted">
                Don&apos;t have an account? You can create one on the next page — it&apos;s free.
              </p>
            </>
          )}

          {/* Redeeming */}
          {state.phase === "redeeming" && (
            <>
              <Loader2 size={20} className="animate-spin text-nuru-purple mx-auto" />
              <h1 className="text-lg font-bold text-nuru-ink">Activating your seat…</h1>
              <p className="text-sm text-nuru-muted">Just a moment.</p>
            </>
          )}

          {/* Success */}
          {state.phase === "success" && (
            <>
              <h1 className="text-xl font-bold text-nuru-ink">You&apos;re in! 🎉</h1>
              <p className="text-sm text-nuru-muted leading-relaxed">
                Your seat for <strong className="text-nuru-ink">{state.orgName}</strong> is now active.
                Full access to all Nuru Academy courses has been unlocked.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} />
                Redirecting you to courses…
              </div>
            </>
          )}

          {/* Error */}
          {state.phase === "error" && (
            <>
              <h1 className="text-xl font-bold text-nuru-ink">Couldn&apos;t activate seat</h1>
              <p className="text-sm text-red-500 leading-relaxed">{state.message}</p>
              <p className="text-xs text-nuru-muted">
                If you believe this is a mistake, ask your organization admin to check the invite link or contact{" "}
                <a href="mailto:hello@nuruai.academy" className="text-nuru-purple hover:underline">hello@nuruai.academy</a>.
              </p>
              <button onClick={() => router.push("/")}
                className="w-full py-2.5 rounded-xl font-semibold text-nuru-ink/70 text-sm border border-nuru-line hover:border-nuru-purple/40 transition-colors">
                Go home
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-nuru-muted">
          <Sparkles size={11} className="text-nuru-purple" />
          Nuru Academy — AI Learning Platform
        </div>
      </div>
    </div>
  );
}
