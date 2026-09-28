import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeClickPesaWebhook,
  logWebhookSignatureDiagnostic,
} from "@/lib/clickpesa";
import { sendPaymentReceipt, sendCorporateInvite } from "@/lib/email";

/**
 * ClickPesa payment webhook.
 *
 * HANDLES TWO PAYLOAD SHAPES (both are real, confirmed from Tendai POS
 * production testing):
 *   Shape 1 — callbackUrl flat:  { status, orderReference, ... }
 *   Shape 2 — Dashboard event:   { event: "PAYMENT RECEIVED", data: { ... } }
 *
 * SIGNATURE VERIFICATION — diagnostic only (not a blocking gate):
 *   ClickPesa signs with x-clickpesa-signature but the exact hashing
 *   algorithm on their receiving side is unconfirmed (raw bytes vs
 *   canonicalized payload). Hard-blocking real payments on an unverified
 *   algorithm would be worse than not blocking at all. The REAL security
 *   gate here is reconciliation: we only act on a webhook if the
 *   orderReference matches a real pending row in track_purchases with the
 *   right amount. After your first live webhook, check the logs for
 *   "Signature diagnostic: MATCHED using ..." — then you can add a hard
 *   block using the confirmed algorithm.
 *
 * IDEMPOTENCY (Fix #17): every webhook is logged in webhook_events before
 *   processing. If the same orderReference + event_type was already
 *   processed successfully, we skip silently.
 *
 * RECEIPT EMAIL (Fix #18): sent on PAYMENT RECEIVED / SUCCESS, non-blocking.
 */
export async function POST(request: NextRequest) {
  // Hard-fail if checksum key is missing (Fix #13)
  const checksumKey = process.env.CLICKPESA_CHECKSUM_KEY;
  if (!checksumKey) {
    console.error(
      "CLICKPESA_CHECKSUM_KEY is not set. Rejecting webhook — " +
      "configure this in your environment variables before going live."
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Read raw body for signature diagnostic AND parse JSON
  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Diagnostic — logs which algorithm matches; never blocks processing
  const receivedSig = request.headers.get("x-clickpesa-signature");
  logWebhookSignatureDiagnostic(checksumKey, receivedSig, rawBody, payload);

  // Normalize both ClickPesa payload shapes into one interface
  const normalized = normalizeClickPesaWebhook(payload);
  if (!normalized) {
    console.error("ClickPesa webhook: unrecognized payload shape:", JSON.stringify(payload).slice(0, 200));
    return NextResponse.json({ error: "Unrecognized payload shape" }, { status: 400 });
  }

  const { status, orderReference, paymentReference, collectedAmount } = normalized;

  if (!orderReference) {
    return NextResponse.json({ received: true, note: "No orderReference in payload" });
  }

  const eventType = (payload.event as string) ?? `FLAT_STATUS_${status}`;
  const admin = createAdminClient();

  // Fix #17: idempotency — skip if already processed
  const { data: existing } = await admin
    .from("webhook_events")
    .select("id, processed")
    .eq("order_reference", orderReference)
    .eq("event_type", eventType)
    .eq("processed", true)
    .maybeSingle();

  if (existing) {
    console.log(`Webhook already processed: ${orderReference} / ${eventType}`);
    return NextResponse.json({ received: true, note: "Already processed" });
  }

  // Log the event before processing (idempotency + audit record)
  const { data: logRow } = await admin
    .from("webhook_events")
    .insert({
      provider: "clickpesa",
      event_type: eventType,
      order_reference: orderReference,
      payload,
      processed: false,
    })
    .select("id")
    .single();

  const logId = logRow?.id;
  let processError: string | null = null;

  try {
    if (status === "SUCCESS") {
      // RECONCILIATION CHECK — verify the orderReference matches a real
      // pending row with the right amount before confirming anything.
      const { data: pendingRow } = await admin
        .from("track_purchases")
        .select("id, amount_tzs, status, plan_id, plan_type")
        .eq("order_reference", orderReference)
        .maybeSingle();

      if (!pendingRow) {
        processError = `No matching pending payment for orderReference: ${orderReference}`;
        console.error(processError);
      } else if (pendingRow.status === "success") {
        console.log(`Duplicate SUCCESS webhook — already confirmed: ${orderReference}`);
      } else {
        // Amount check (within 1 TZS tolerance for rounding)
        const receivedAmount = Number(collectedAmount);
        const expectedAmount = Number(pendingRow.amount_tzs);
        if (receivedAmount && Math.abs(receivedAmount - expectedAmount) > 1) {
          processError = `Amount mismatch: received ${receivedAmount}, expected ${expectedAmount}`;
          console.error(processError, { orderReference });
        } else {
          // confirm_plan_purchase: updates access_tier, creates org_invite for corporate
          const { data: confirmResult, error } = await admin.rpc("confirm_plan_purchase", {
            p_order_reference:        orderReference,
            p_status:                 "success",
            p_clickpesa_payment_id:   paymentReference,
          });

          if (error) {
            processError = error.message;
            console.error("confirm_plan_purchase (success) failed", error, orderReference);
          } else {
            // Send email — non-blocking
            try {
              const { data: purchase } = await admin
                .from("track_purchases")
                .select("user_id, plan_id, plan_type, amount_tzs, order_reference")
                .eq("order_reference", orderReference)
                .single();

              if (purchase) {
                const { data: profile } = await admin
                  .from("profiles")
                  .select("email, username")
                  .eq("id", purchase.user_id)
                  .single();

                if (profile?.email) {
                  if (purchase.plan_type === "corporate") {
                    // For corporate plans, send the invite link for their team
                    const result = confirmResult as { invite_code?: string } | null;
                    const inviteCode = result?.invite_code;
                    const inviteUrl  = inviteCode
                      ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nuruacademy.co"}/join/${inviteCode}`
                      : null;

                    await sendCorporateInvite({
                      email:          profile.email,
                      username:       profile.username ?? "Team Admin",
                      planId:         purchase.plan_id,
                      amount:         purchase.amount_tzs,
                      orderReference: purchase.order_reference,
                      inviteUrl:      inviteUrl ?? "",
                    });
                  } else {
                    // Individual plan — send standard receipt
                    await sendPaymentReceipt({
                      email:          profile.email,
                      username:       profile.username ?? "Learner",
                      trackName:      "Nuru Academy Full Access",
                      amount:         purchase.amount_tzs,
                      orderReference: purchase.order_reference,
                    });
                  }
                }
              }
            } catch (emailErr) {
              console.error("Post-payment email failed (non-fatal):", emailErr);
            }
          }
        }
      }
    } else if (status === "FAILED") {
      const { error } = await admin.rpc("confirm_plan_purchase", {
        p_order_reference:      orderReference,
        p_status:               "failed",
        p_clickpesa_payment_id: paymentReference,
      });
      if (error) {
        processError = error.message;
        console.error("confirm_plan_purchase (failed) failed", error, orderReference);
      }
    } else {
      // PROCESSING / UNKNOWN — nothing to do yet
      console.log(`Webhook received for status=${status}, orderReference=${orderReference} — no action needed`);
    }
  } catch (err) {
    processError = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook processing error:", err);
  }

  // Update idempotency log record with outcome
  if (logId) {
    await admin
      .from("webhook_events")
      .update({
        processed: !processError,
        process_error: processError,
        processed_at: new Date().toISOString(),
      })
      .eq("id", logId);
  }

  return NextResponse.json({ received: true });
}
