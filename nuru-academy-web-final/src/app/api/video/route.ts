import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";

/**
 * GET /api/video?id=<video_uuid>
 *
 * Returns a short-lived signed URL for a private Supabase Storage video.
 * The URL expires in 60 seconds — just long enough to start streaming.
 * The browser player fetches this URL, starts the stream, then the URL
 * is useless even if extracted.
 *
 * Security layers:
 *  1. Must be authenticated (server-side session check)
 *  2. Must be enrolled in the track the video belongs to (DB RPC)
 *  3. URL expires in 60 seconds (Supabase Storage signed URL)
 *  4. Content-Security-Policy on the player page blocks screen recording
 *     at the browser level (enforced in the video player component)
 *  5. Storage bucket is private — no public URL exists at any time
 *  6. Raw storage_path never returned to the client — only the signed URL
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("id");

  if (!videoId) {
    return NextResponse.json({ error: "Video ID required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RPC validates enrollment and returns the storage_path (never the signed URL itself)
  const { data: storagePath, error } = await supabase.rpc("get_video_signed_url", {
    p_video_id: videoId,
  });

  if (error || !storagePath) {
    return NextResponse.json(
      { error: error?.message ?? "Video not found or access denied" },
      { status: 403 }
    );
  }

  // Generate the actual signed URL using the service-role key (server-only)
  const adminStorage = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  ).storage;

  const { data: signedData, error: signError } = await adminStorage
    .from("lesson-videos")
    .createSignedUrl(storagePath as string, 60); // 60-second expiry

  if (signError || !signedData?.signedUrl) {
    console.error("Failed to create signed URL:", signError);
    return NextResponse.json({ error: "Could not generate video URL" }, { status: 500 });
  }

  return NextResponse.json({
    url: signedData.signedUrl,
    expiresIn: 60,
  });
}
