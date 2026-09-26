import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user && data.session) {
      // ── Register this session as the ONE active session ──────────────────
      // Uses the JWT's jti (JWT ID) as a unique session token.
      // Any previous session for this user is overwritten — kicking them out.
      const jti = (data.session.access_token.split(".")[1]);
      let sessionToken = data.session.access_token;
      try {
        const payload = JSON.parse(Buffer.from(jti, "base64").toString());
        sessionToken = payload.jti ?? data.session.access_token;
      } catch { /* use full token as fallback */ }

      const deviceHint = request.headers.get("user-agent")?.slice(0, 120) ?? null;
      const ipAddress  = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? request.headers.get("x-real-ip")
        ?? null;

      await supabase.rpc("upsert_session", {
        p_session_token: sessionToken,
        p_device_hint:   deviceHint,
        p_ip_address:    ipAddress,
      });

      // ── Route to onboarding or dashboard ─────────────────────────────────
      const { count } = await supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id);

      if (!count) return NextResponse.redirect(`${origin}/onboarding`);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
