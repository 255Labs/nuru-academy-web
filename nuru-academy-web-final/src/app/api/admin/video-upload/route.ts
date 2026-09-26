import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";

/**
 * POST /api/admin/video-upload
 *
 * Admin-only. Uploads a video to the private 'lesson-videos' Supabase
 * Storage bucket and records its metadata in lesson_videos.
 *
 * Body: multipart/form-data
 *   file       — the video file (mp4, webm)
 *   module_id  — which module this belongs to
 *   lesson_day — which day (1-5) within the module
 *   title      — display title
 *
 * The storage path is generated server-side and never includes user-
 * controlled input — just a UUID so it can never be guessed or enumerated.
 * The bucket is private: no public URL exists.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify admin role server-side
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const moduleId = formData.get("module_id") as string | null;
  const lessonDay = parseInt(formData.get("lesson_day") as string ?? "1");
  const title = formData.get("title") as string | null;

  if (!file || !moduleId || !title) {
    return NextResponse.json({ error: "file, module_id, and title are required" }, { status: 400 });
  }

  // Validate file type
  const allowed = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Only MP4, WebM, and MOV files are supported" },
      { status: 400 }
    );
  }

  // Max 1 GB
  if (file.size > 1024 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 1 GB)" }, { status: 400 });
  }

  // Generate a random, non-guessable storage path
  const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const storagePath = `${moduleId}/day${lessonDay}-${crypto.randomUUID()}.${ext}`;

  const adminStorage = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  ).storage;

  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await adminStorage
    .from("lesson-videos")
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
  }

  // Record metadata in DB (storage path only, never the signed URL)
  const adminDb = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // Deactivate any previous video for this module+day
  await adminDb
    .from("lesson_videos")
    .update({ is_active: false })
    .eq("module_id", moduleId)
    .eq("lesson_day", lessonDay);

  const { data: videoRow, error: dbError } = await adminDb
    .from("lesson_videos")
    .upsert({
      module_id: moduleId,
      lesson_day: lessonDay,
      title,
      storage_path: storagePath,
      uploaded_by: user.id,
      is_active: true,
    }, { onConflict: "module_id,lesson_day" })
    .select("id")
    .single();

  if (dbError) {
    // Clean up the uploaded file if DB insert fails
    await adminStorage.from("lesson-videos").remove([storagePath]);
    return NextResponse.json({ error: "Database error: " + dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    videoId: videoRow?.id,
    message: `Video uploaded for module ${moduleId}, day ${lessonDay}`,
  });
}
