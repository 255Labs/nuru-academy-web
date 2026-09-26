import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClickPesaToken } from "@/lib/clickpesa";
import { sendPaymentReceipt } from "@/lib/email";

/**
 * POST /api/nrx-ctrl-9f4a/reconcile-payments
 *
 * Admin-only. Actively closes the webhook-gap problem: when a ClickPesa
 * webhook never arrives (network issue, delivery failure, server downtime),
 * this queries ClickPesa directly for each stale pending payment and
 * self-heals it.
 *
 * Lesson from Tendai POS production experience: webhooks DO miss. A
 * customer can pay, ClickPesa receives it, but the webhook fails to reach
 * your server. Without reconciliation, that payment hangs as 'pending'
 * forever. This route fixes that.
 *
 * Body (optional JSON):
 *   { max_age_minutes?: number }  — how old a 'pending' row must be before
 *                                   we check it (default: 15 minutes)
 *
 * Returns:
 *   { checked, resolved, still_pending, results[] }
 *
 * Call this:
 *   - From the admin panel (manual "Reconcile" button in Revenue tab)
 *   - On a schedule via Vercel cron (add to vercel.json if desired)
 *
 * CONFIRMED ClickPesa query endpoint from their API reference:
 *   GET {base}/third-parties/payments/{orderReference}
 *   Response: { status, collectedAmount, collectedCurrency, paymentReference }
 *   Status values: SUCCESS | SETTLED | PROCESSING | PENDING | FAILED
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Verify admin role server-side
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  if (!process.env.CLICKPESA_CLIENT_ID || !process.env.CLICKPESA_API_KEY) {
    return NextResponse.json({ error: "ClickPesa not configured" }, { status: 503 });
  }

  let body: { max_age_minutes?: number } = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }
  const maxAgeMinutes = body.max_age_minutes ?? 15;

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

  // Find all pending payments older than the cutoff
  const { data: stalePending, error: fetchErr } = await admin
    .from("track_purchases")
    .select("id, user_id, track_id, order_reference, amount_tzs, created_at")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .not("order_reference", "is", null);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!stalePending || stalePending.length === 0) {
    return NextResponse.json({ checked: 0, resolved: 0, still_pending: 0, results: [] });
  }

  // Get ClickPesa auth token once — reuse for all queries
  let token: string;
  try {
    token = await getClickPesaToken();
  } catch (e) {
    return NextResponse.json({
      error: `Could not authenticate with ClickPesa: ${(e as Error).message}`,
    }, { status: 502 });
  }

  const CLICKPESA_BASE_URL = process.env.CLICKPESA_SANDBOX === "true"
    ? "https://api-sandbox.clickpesa.com/third-parties"
    : "https://api.clickpesa.com/third-parties";

  const results: Array<Record<string, unknown>> = [];
  let resolved = 0;

  for (const payment of stalePending) {
    try {
      // Query ClickPesa directly for this payment's current status
      const res = await fetch(`${CLICKPESA_BASE_URL}/payments/${payment.order_reference}`, {
        headers: { Authorization: token },
      });
      const text = await res.text();

      if (!res.ok) {
        results.push({
          order_reference: payment.order_reference,
          outcome: "query_failed",
          detail: text,
        });
        continue;
      }

      const remote = JSON.parse(text) as {
        status?: string;
        collectedAmount?: string;
        collectedCurrency?: string;
        paymentReference?: string;
      };

      if (remote.status === "SUCCESS" || remote.status === "SETTLED") {
        // Amount check — don't blindly trust a remote amount mismatch
        const receivedAmount = Number(remote.collectedAmount);
        const expectedAmount = Number(payment.amount_tzs);

        if (!receivedAmount || Math.abs(receivedAmount - expectedAmount) > 1) {
          results.push({
            order_reference: payment.order_reference,
            outcome: "amount_mismatch",
            remote_amount: receivedAmount,
            expected: expectedAmount,
          });
          continue;
        }

        // Confirm the payment
        const { error: confirmErr } = await admin.rpc("confirm_track_purchase", {
          p_order_reference: payment.order_reference,
          p_status: "success",
          p_clickpesa_payment_id: remote.paymentReference ?? null,
        });

        if (confirmErr) {
          results.push({
            order_reference: payment.order_reference,
            outcome: "confirm_failed",
            detail: confirmErr.message,
          });
          continue;
        }

        // Send receipt email — non-blocking
        try {
          const { data: profile } = await admin
            .from("profiles")
            .select("email, username")
            .eq("id", payment.user_id)
            .single();

          if (profile?.email) {
            const trackNames: Record<string, string> = {
              beginner: "AI for Everyone",
              intermediate: "LLMs Under the Hood",
              expert: "The Model Landscape",
            };
            await sendPaymentReceipt({
              email: profile.email,
              username: profile.username ?? "Learner",
              trackName: trackNames[payment.track_id] ?? payment.track_id,
              amount: receivedAmount,
              orderReference: payment.order_reference,
            });
          }
        } catch (emailErr) {
          console.error("Reconciliation receipt email failed (non-fatal):", emailErr);
        }

        results.push({
          order_reference: payment.order_reference,
          outcome: "resolved_success",
          user_id: payment.user_id,
          track_id: payment.track_id,
          amount: receivedAmount,
        });
        resolved++;

      } else if (remote.status === "FAILED") {
        await admin
          .from("track_purchases")
          .update({ status: "failed" })
          .eq("order_reference", payment.order_reference);

        results.push({ order_reference: payment.order_reference, outcome: "resolved_failed" });
        resolved++;

      } else {
        // Still PROCESSING/PENDING on ClickPesa's side — genuinely in-flight
        results.push({
          order_reference: payment.order_reference,
          outcome: "still_processing",
          remote_status: remote.status,
        });
      }
    } catch (e) {
      results.push({
        order_reference: payment.order_reference,
        outcome: "error",
        detail: (e as Error).message,
      });
    }
  }

  return NextResponse.json({
    checked: stalePending.length,
    resolved,
    still_pending: stalePending.length - resolved,
    results,
  });
}
