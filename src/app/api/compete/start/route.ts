import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/compete/start
 * Body: { competition_id: string }
 *
 * Creates or returns the caller's ussd_entries row for this competition
 * and returns the question list WITHOUT correct answers.
 *
 * Security:
 *  - Must be authenticated (server session check)
 *  - Competition must be status='active'
 *  - Idempotent: hitting Start twice returns the same entry_id
 *  - Questions returned via web_compete_start() SECURITY DEFINER RPC —
 *    the correct field is never selected
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { competition_id } = body as { competition_id?: string };
  if (!competition_id) {
    return NextResponse.json({ error: "competition_id required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("web_compete_start", {
    p_competition_id: competition_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
