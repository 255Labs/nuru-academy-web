import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * USSD Gateway Handler — *278# AI Knowledge Competition
 *
 * Security:
 *  #1  Telco origin verified via HMAC-SHA256 of the raw request body,
 *      using USSD_GATEWAY_SECRET shared with Africa's Talking / Buni Mobile.
 *      Without a matching signature the request is rejected 401 before any
 *      DB access happens.
 *  #15 Correct answers never sent to the client — grading is done server-side
 *      via ussd_grade_answer() which uses SECURITY DEFINER and is only
 *      callable by the service role. The questions endpoint only returns
 *      question_text, type, and options — never `correct`.
 */

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

// Fix #1: verify Africa's Talking / Buni Mobile HMAC signature
function verifyUssdSignature(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.USSD_GATEWAY_SECRET;
  // If no secret configured (local dev), warn but allow — hard-fail in prod check below
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("USSD_GATEWAY_SECRET not set in production — rejecting all requests");
      return false;
    }
    console.warn("USSD_GATEWAY_SECRET not set — skipping signature check (dev only)");
    return true;
  }

  // Africa's Talking: signature in X-AfricasTalking-Signature header (hex HMAC-SHA256)
  // Buni Mobile: signature in X-Buni-Signature header
  const atSig = request.headers.get("x-africastalking-signature") ??
                request.headers.get("x-buni-signature") ??
                request.headers.get("x-ussd-signature");

  if (!atSig) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(atSig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function con(msg: string) {
  return new NextResponse(`CON ${msg}`, { status: 200, headers: { "Content-Type": "text/plain" } });
}
function end(msg: string) {
  return new NextResponse(`END ${msg}`, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: NextRequest) {
  // Fix #1: read raw body once for signature verification
  const rawBody = await request.text();

  if (!verifyUssdSignature(request, rawBody)) {
    console.error("USSD: signature verification failed — rejecting request");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: Record<string, string>;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      body = JSON.parse(rawBody);
    } else {
      const params = new URLSearchParams(rawBody);
      body = Object.fromEntries(params.entries());
    }
  } catch {
    return end("Session error. Please try again.");
  }

  const { sessionId, phoneNumber, text = "" } = body;

  // Sanitise inputs — Fix #11: bound length
  if (!sessionId || !phoneNumber) return end("Session error. Please try again.");
  const safeSessionId = String(sessionId).slice(0, 64);
  const safePhone = String(phoneNumber).slice(0, 20).replace(/[^+\d]/g, "");
  const safeParts = String(text).slice(0, 200).split("*").filter(Boolean);
  const lastInput = safeParts[safeParts.length - 1] ?? "";

  const supabase = getAdmin();

  // Load existing session
  const { data: session } = await supabase
    .from("ussd_sessions")
    .select("*")
    .eq("session_id", safeSessionId)
    .maybeSingle();

  // ── State machine ──────────────────────────────────────────────────────────

  if (!session || session.state === "MENU") {
    const { data: comps } = await supabase
      .from("ussd_competitions")
      .select("id, title")
      .eq("status", "active")
      .order("starts_at")
      .limit(5);

    if (!comps || comps.length === 0) {
      await supabase.from("ussd_sessions").upsert({
        session_id: safeSessionId, phone_number: safePhone,
        state: "MENU", updated_at: new Date().toISOString(),
      });
      return end("No active competitions right now.\nDial *278# when a competition is live.\nLearn at nuruai.academy");
    }

    await supabase.from("ussd_sessions").upsert({
      session_id: safeSessionId, phone_number: safePhone,
      state: "PICK_COMP", updated_at: new Date().toISOString(),
    });

    const menu = comps.map((c, i) => `${i + 1}. ${c.title.slice(0, 30)}`).join("\n");
    return con(`Nuru AI Academy\nSelect competition:\n${menu}\n0. Exit`);
  }

  if (session.state === "PICK_COMP") {
    if (lastInput === "0") return end("Goodbye! Dial *278# to compete anytime.");

    const idx = parseInt(lastInput) - 1;
    if (isNaN(idx) || idx < 0 || idx > 4) return con("Invalid choice.\n1. Try again\n0. Exit");

    const { data: comps } = await supabase
      .from("ussd_competitions")
      .select("id, title, quiz_id")
      .eq("status", "active")
      .order("starts_at")
      .limit(5);

    const comp = comps?.[idx];
    if (!comp) return con("Invalid choice.\n1. Try again\n0. Exit");

    const { data: entry } = await supabase
      .from("ussd_entries")
      .upsert(
        { competition_id: comp.id, phone_number: safePhone },
        { onConflict: "competition_id,phone_number" }
      )
      .select()
      .single();

    await supabase.from("ussd_sessions").update({
      state: "IN_QUESTION", competition_id: comp.id, entry_id: entry?.id,
      question_idx: 0, score: 0, updated_at: new Date().toISOString(),
    }).eq("session_id", safeSessionId);

    return con(`${comp.title.slice(0, 40)}\n\nAnswer AI questions.\nEach correct = 1 point.\n\n1. Start\n0. Back`);
  }

  if (session.state === "IN_QUESTION") {
    const { data: compData } = await supabase
      .from("ussd_competitions")
      .select("quiz_id")
      .eq("id", session.competition_id)
      .single();

    if (!compData?.quiz_id) return end("Competition setup error. Please try again later.");

    // Fix #15: fetch questions WITHOUT correct_answer — only display fields
    const { data: questions } = await supabase
      .from("questions")
      .select("id, question_text, type, options, sort_position")
      .eq("quiz_id", compData.quiz_id)
      .order("sort_position");

    if (!questions || questions.length === 0) return end("No questions available yet.");

    let qIdx = session.question_idx ?? 0;

    // Process answer for the previous question
    if (lastInput && lastInput !== "1" && qIdx > 0) {
      const prevQ = questions[qIdx - 1];
      if (prevQ) {
        // Fix #15: grade via service-role RPC — never compares correct_answer client-side
        const { data: gradeResult } = await supabase.rpc("ussd_grade_answer", {
          p_quiz_id: compData.quiz_id,
          p_question_id: prevQ.id,
          p_answer: lastInput,
        });

        const correct = (gradeResult as Array<{ correct: boolean }>)?.[0]?.correct ?? false;
        const newScore = (session.score ?? 0) + (correct ? 1 : 0);

        await supabase.from("ussd_sessions").update({
          score: newScore, updated_at: new Date().toISOString(),
        }).eq("session_id", safeSessionId);

        if (session.entry_id) {
          await supabase.from("ussd_entries").update({
            score: newScore, answers_given: qIdx,
            completed: qIdx >= questions.length,
          }).eq("id", session.entry_id);
        }

        if (qIdx >= questions.length) {
          await supabase.from("ussd_sessions").update({ state: "DONE" }).eq("session_id", safeSessionId);
          return end(`Complete!\n\nScore: ${newScore}/${questions.length}\n\nThanks for competing!\nnuruai.academy/compete`);
        }
      }
    } else if (lastInput === "1" && qIdx === 0) {
      // "Start" pressed on intro screen — serve first question
    }

    const q = questions[qIdx];
    if (!q) {
      return end(`Done! Score: ${session.score ?? 0}/${questions.length}`);
    }

    const qText = q.question_text.length > 80
      ? q.question_text.substring(0, 77) + "..."
      : q.question_text;

    let optionsText = "";
    if (q.type === "mcq" && q.options) {
      const opts = (Array.isArray(q.options) ? q.options : JSON.parse(q.options)) as string[];
      optionsText = "\n" + opts.slice(0, 4).map((o: string, i: number) => `${i + 1}. ${o.slice(0, 35)}`).join("\n");
    } else if (q.type === "tf") {
      optionsText = "\n1. True\n2. False";
    }

    await supabase.from("ussd_sessions").update({
      question_idx: qIdx + 1,
      state: "IN_QUESTION",
      updated_at: new Date().toISOString(),
    }).eq("session_id", safeSessionId);

    return con(`Q${qIdx + 1}/${questions.length}: ${qText}${optionsText}`);
  }

  if (session.state === "DONE") {
    return end(`You already completed this.\nScore: ${session.score}\n\nnuruai.academy/compete`);
  }

  return end("Session error. Dial *278# to start over.");
}

export async function GET() {
  return new NextResponse("Nuru AI Academy USSD Gateway. POST to this endpoint.", { status: 200 });
}
