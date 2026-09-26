import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initiateUssdPush } from "@/lib/clickpesa";
import { rateLimit, rateLimitResponse, PAYMENT_LIMIT } from "@/lib/rateLimit";

/**
 * Starts a real mobile money payment: creates our own pending order
 * (initiate_track_purchase — RLS-scoped to the caller, real price pulled
 * from public.tracks, never trusted from the client), then sends the
 * actual USSD-PUSH prompt to the customer's phone via ClickPesa.
 *
 * The webhook route (src/app/api/payments/webhook/route.ts) is what
 * actually confirms the payment succeeded — this route only *starts* it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { trackId, phoneNumber } = (await request.json()) as { trackId?: string; phoneNumber?: string };

  if (!trackId || !phoneNumber) {
    return NextResponse.json({ error: "trackId and phoneNumber are required" }, { status: 400 });
  }

  // Basic sanity check — ClickPesa expects international format without a
  // leading "+", e.g. 255712345678. Real validation of Tanzanian mobile
  // prefixes is intentionally left to ClickPesa's own API, which will
  // reject an unsupported number with a clear error rather than silently
  // failing — no need to duplicate that logic here.
  const normalizedPhone = phoneNumber.replace(/[^\d]/g, "");
  if (normalizedPhone.length < 9) {
    return NextResponse.json({ error: "Enter a valid phone number, e.g. 0712345678" }, { status: 400 });
  }
  const internationalPhone = normalizedPhone.startsWith("255")
    ? normalizedPhone
    : `255${normalizedPhone.replace(/^0/, "")}`;

  const { data: initResult, error: initError } = await supabase.rpc("initiate_track_purchase", {
    p_track_id: trackId,
    p_phone_number: internationalPhone,
  });

  if (initError || !initResult) {
    return NextResponse.json({ error: initError?.message ?? "Could not start the order" }, { status: 400 });
  }

  const { order_reference: orderReference, amount_tzs: amountTZS } = initResult as unknown as {
    order_reference: string;
    amount_tzs: number;
  };

  try {
    const pushResult = await initiateUssdPush({
      amountTZS,
      orderReference,
      phoneNumber: internationalPhone,
    });
    return NextResponse.json({
      orderReference,
      amountTZS,
      status: pushResult.status,
      channel: pushResult.channel,
    });
  } catch (err) {
    console.error("ClickPesa initiate-ussd-push-request failed", err);
    // The USSD push itself failed — mark the pending row as failed so it
    // doesn't linger as 'pending' forever and pollute reconciliation queries.
    // (Lesson from Tendai POS: record first, push second, clean up on push failure.)
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      await admin
        .from("track_purchases")
        .update({ status: "failed" })
        .eq("order_reference", orderReference)
        .eq("status", "pending");
    } catch (cleanupErr) {
      console.error("Failed to mark pending payment as failed after push error:", cleanupErr);
    }
    return NextResponse.json(
      { error: "Couldn't reach the payment provider. Please try again in a moment." },
      { status: 502 }
    );
  }
}
