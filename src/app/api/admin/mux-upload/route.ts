import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMuxUpload, getMuxUploadAsset, getMuxAsset } from "@/lib/mux";
import { rateLimit, rateLimitResponse, ADMIN_LIMIT } from "@/lib/rateLimit";

/**
 * POST /api/nrx-ctrl-9f4a/mux-upload
 * Body: { action: 'create_upload', moduleId, lessonDay, title }
 *   → Returns { uploadId, uploadUrl } — client posts video directly to uploadUrl
 *
 * POST /api/nrx-ctrl-9f4a/mux-upload
 * Body: { action: 'complete', uploadId, moduleId, lessonDay, title }
 *   → Polls Mux for asset ID, stores in lesson_videos table
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rl = rateLimit(req, ADMIN_LIMIT, user.id);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json();
  const { action } = body;

  // ── Step 1: Create upload URL ──────────────────────────────────────────────
  if (action === "create_upload") {
    const { moduleId, lessonDay, title } = body;
    if (!moduleId || !lessonDay || !title) {
      return NextResponse.json({ error: "moduleId, lessonDay, title required" }, { status: 400 });
    }

    try {
      const { uploadId, uploadUrl } = await createMuxUpload({ moduleId, lessonDay, title });
      return NextResponse.json({ uploadId, uploadUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Mux upload creation failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Step 2: Complete upload — get asset ID and store in DB ────────────────
  if (action === "complete") {
    const { uploadId, moduleId, lessonDay, title } = body;
    if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

    try {
      const { assetId, status } = await getMuxUploadAsset(uploadId);

      if (!assetId) {
        // Still processing — client should poll again
        return NextResponse.json({ status, assetId: null, ready: false });
      }

      // Get the playback ID from the asset
      const asset = await getMuxAsset(assetId);

      // Deactivate any previous video for this module+day
      await supabase
        .from("lesson_videos")
        .update({ is_active: false })
        .eq("module_id", moduleId)
        .eq("lesson_day", parseInt(lessonDay));

      // Store in lesson_videos table
      const { error: dbErr } = await supabase
        .from("lesson_videos")
        .insert({
          module_id:    moduleId,
          lesson_day:   parseInt(lessonDay),
          title,
          storage_path: `mux:${assetId}`,    // prefix to distinguish from Supabase Storage
          mux_asset_id: assetId,
          mux_playback_id: asset.playbackId,
          duration_secs: asset.duration ? Math.round(asset.duration) : null,
          is_active:    true,
          uploaded_at:  new Date().toISOString(),
        });

      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

      return NextResponse.json({
        ready: true,
        assetId,
        playbackId: asset.playbackId,
        status: asset.status,
        duration: asset.duration,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete upload";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
