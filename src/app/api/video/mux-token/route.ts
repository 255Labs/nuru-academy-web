import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMuxPlaybackToken } from "@/lib/mux";
import { rateLimit, rateLimitResponse, VIDEO_LIMIT } from "@/lib/rateLimit";

/**
 * GET /api/video/mux-token?playbackId=xxx
 *
 * Generates a signed Mux playback token for a DRM-protected video.
 * Token expires in 6 hours. Only authenticated enrolled learners can get one.
 * Rate limited to 30 requests per hour per user.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(req, VIDEO_LIMIT, user.id);
  if (!rl.allowed) return rateLimitResponse(rl);

  const playbackId = req.nextUrl.searchParams.get("playbackId");
  if (!playbackId) return NextResponse.json({ error: "playbackId required" }, { status: 400 });

  // Verify the user is enrolled in a track that has this video
  const { data: video } = await supabase
    .from("lesson_videos")
    .select("module_id, mux_playback_id, modules(track_id)")
    .eq("mux_playback_id", playbackId)
    .eq("is_active", true)
    .single();

  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  // Check enrollment
  const trackId = (video.modules as unknown as { track_id: string } | null)?.track_id;
  if (trackId) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("track_id", trackId)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled in this track" }, { status: 403 });
    }
  }

  try {
    const token = await getMuxPlaybackToken(playbackId, user.id);
    return NextResponse.json({
      token,
      playbackId,
      // Token expires in 6 hours — client should refresh before then
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate token";
    // If Mux keys not configured, return a helpful error
    if (msg.includes("MUX_SIGNING_KEY")) {
      return NextResponse.json({
        error: "Mux DRM not configured. Add MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY to environment variables.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
