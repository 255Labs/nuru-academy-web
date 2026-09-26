import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { rateLimit, rateLimitResponse, DELETION_LIMIT } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = rateLimit(req, DELETION_LIMIT, user.id);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { confirmation } = await req.json();
  if (confirmation !== "DELETE MY ACCOUNT") {
    return NextResponse.json({ error: 'Please type "DELETE MY ACCOUNT" exactly to confirm' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  try {
    const { data: profile } = await supabase
      .from("profiles").select("display_name, email").eq("id", user.id).single();
    const userEmail = profile?.email ?? user.email ?? "";
    const userName  = profile?.display_name ?? "Learner";

    // Remove session and sign out
    await supabase.from("user_sessions").delete().eq("user_id", user.id);
    await supabase.auth.signOut({ scope: "global" });

    // Delete all user data
    for (const table of [
      "ai_chats", "study_log", "daily_quest_completions", "quiz_attempts",
      "enrollments", "track_purchases", "user_achievements", "duel_participants",
      "certificates", "user_sessions",
    ]) {
      await admin.from(table).delete().eq("user_id", user.id);
    }
    await admin.from("player_stats").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id);

    // Goodbye email
    if (process.env.RESEND_API_KEY && userEmail) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Nuru AI Academy <hello@nuruai.academy>",
          to: userEmail,
          subject: "Your Nuru account has been deleted",
          html: `<div style="font-family:sans-serif;max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE8FF;">
            <div style="background:linear-gradient(135deg,#1A1A2E,#2D1B69);padding:32px;text-align:center;">
              <div style="font-size:32px">👋</div>
              <div style="color:#fff;font-size:20px;font-weight:700;margin-top:8px">Account deleted</div>
              <div style="color:rgba(255,255,255,0.6);margin-top:4px">Goodbye, ${userName}</div>
            </div>
            <div style="padding:32px;color:#5A5268;font-size:14px;line-height:1.6">
              <p>Your Nuru AI Academy account and all data have been permanently deleted.</p>
              <p>Deleted: profile, XP, progress, certificates, chat history, and purchase records.</p>
              <p>You are always welcome to create a new account at <a href="https://nuru-academy-web.vercel.app" style="color:#6B4EFF">nuru-academy-web.vercel.app</a>.</p>
            </div>
          </div>`,
        });
      } catch { /* don't fail if email fails */ }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Deletion failed. Contact hello@nuruai.academy" }, { status: 500 });
  }
}
