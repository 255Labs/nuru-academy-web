import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/compete/answer
 * Body: { entry_id, question_id, question_index, answer, time_secs? }
 *
 * Submits one answer for a web competition entry.
 * Returns: { correct, new_score, is_last, total_q }
 *
 * Security:
 *  - Must be authenticated
 *  - Entry must belong to the caller (enforced in web_compete_answer RPC)
 *  - Competition must be active (enforced in RPC)
 *  - Each question can only be answered once (enforced in RPC)
 *  - Correct answers never sent to or from the client — grading is DB-side
 *
 * Rate limiting: max 1 answer per second per user (prevents scripted flooding)
 */

const answerTimestamps = new Map<string, number>();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Rate limit: 1 answer per second per user
  const now = Date.now();
  const last = answerTimestamps.get(user.id) ?? 0;
  if (now - last < 1000) {
    return NextResponse.json({ error: "Too fast — one answer per second" }, { status: 429 });
  }
  answerTimestamps.set(user.id, now);

  const body = await request.json().catch(() => ({}));
  const { entry_id, question_id, question_index, answer, time_secs } =
    body as {
      entry_id?: string;
      question_id?: string;
      question_index?: number;
      answer?: string;
      time_secs?: number;
    };

  if (!entry_id || !question_id || question_index === undefined || !answer) {
    return NextResponse.json(
      { error: "entry_id, question_id, question_index, and answer are required" },
      { status: 400 }
    );
  }

  // Bound answer length
  if (String(answer).length > 200) {
    return NextResponse.json({ error: "Answer too long" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("web_compete_answer", {
    p_entry_id:       entry_id,
    p_question_id:    question_id,
    p_question_index: question_index,
    p_answer:         String(answer),
    p_time_secs:      time_secs ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
