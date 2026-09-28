import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initiateUssdPush } from "@/lib/clickpesa";

/**
 * Starts a mobile money payment for a plan (individual, corporate, or
 * the launch-discount price if still available).
 *
 * Body: {
 *   planId:      string          — references public.plans.id
 *   phoneNumber: string          — customer's TZ mobile number
 *   orgName?:    string          — required for corporate plans
 *   orgDomain?:  string          — optional email domain for corp org
 * }
 *
 * Flow:
 *   1. Authenticate user
 *   2. Call initiate_plan_purchase RPC (server-side price lookup, discount
 *      seat lock via FOR UPDATE, org row creation if corporate)
 *   3. Send USSD-push prompt via ClickPesa
 *   4. On push failure, mark the pending row as 'failed' for clean reconciliation
 *
 * The webhook route (src/app/api/payments/webhook/route.ts) confirms
 * the payment once ClickPesa calls back.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    planId?: string;
    phoneNumber?: string;
    orgName?: string;
    orgDomain?: string;
  };

  const { planId, phoneNumber, orgName, orgDomain } = body;

  if (!planId || !phoneNumber) {
    return NextResponse.json({ error: "planId and phoneNumber are required" }, { status: 400 });
  }

  // Normalize TZ phone number to international format (255XXXXXXXXX)
  // Real prefix validation is left to ClickPesa — it rejects bad numbers
  // with a clear error rather than silently failing.
  const normalizedPhone = phoneNumber.replace(/[^\d]/g, "");
  if (normalizedPhone.length < 9) {
    return NextResponse.json({ error: "Enter a valid phone number, e.g. 0712345678" }, { status: 400 });
  }
  const internationalPhone = normalizedPhone.startsWith("255")
    ? normalizedPhone
    : `255${normalizedPhone.replace(/^0/, "")}`;

  // Call the DB RPC — this:
  //   • looks up the real price (or discount price if still available)
  //   • atomically decrements discount seats if applicable (FOR UPDATE lock)
  //   • creates an org row if the plan is corporate
  //   • inserts a 'pending' track_purchases row
  const { data: initResult, error: initError } = await supabase.rpc("initiate_plan_purchase", {
    p_plan_id:     planId,
    p_phone_number: internationalPhone,
    p_org_name:    orgName  ?? null,
    p_org_domain:  orgDomain ?? null,
  });

  if (initError || !initResult) {
    return NextResponse.json(
      { error: initError?.message ?? "Could not start the order" },
      { status: 400 }
    );
  }

  const { order_reference: orderReference, amount_tzs: amountTZS } = initResult as unknown as {
    order_reference: string;
    amount_tzs: number;
  };

  // Send the actual USSD-push to the customer's phone via ClickPesa
  try {
    const pushResult = await initiateUssdPush({
      amountTZS,
      orderReference,
      phoneNumber: internationalPhone,
    });
    return NextResponse.json({
      orderReference,
      amountTZS,
      status:  pushResult.status,
      channel: pushResult.channel,
    });
  } catch (err) {
    console.error("ClickPesa initiate-ussd-push failed", err);

    // Mark the pending row as failed so it doesn't linger in reconciliation.
    // (Pattern from Tendai POS: record first, push second, clean up on failure.)
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
