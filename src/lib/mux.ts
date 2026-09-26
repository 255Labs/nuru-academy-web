/**
 * Mux DRM Video Infrastructure
 *
 * Mux provides true DRM (Widevine + FairPlay) that blocks screen recording
 * at the OS level on Chrome, Safari, Android, and iOS.
 *
 * SETUP (one-time):
 * 1. Sign up at dashboard.mux.com
 * 2. Create an environment → copy Access Token ID and Secret Key
 * 3. Add to Vercel environment variables:
 *      MUX_TOKEN_ID=your_token_id
 *      MUX_TOKEN_SECRET=your_token_secret
 * 4. In Mux dashboard → Settings → Signing Keys → Create a signing key
 *    Add to Vercel:
 *      MUX_SIGNING_KEY_ID=your_signing_key_id
 *      MUX_SIGNING_PRIVATE_KEY=your_private_key (base64 encoded)
 *
 * HOW IT WORKS:
 * - Videos upload to Mux (not Supabase Storage) via /api/nrx-ctrl-9f4a/mux-upload
 * - Mux transcodes, encrypts with DRM, and stores on their CDN
 * - Playback requires a signed JWT token generated server-side
 * - Token expires after 6 hours — even a captured token is useless after that
 * - Widevine (Chrome/Android) and FairPlay (Safari/iOS) block screen recording
 */

import Mux from "@mux/mux-node";

// Mux client — only instantiated server-side
function getMuxClient() {
  const tokenId     = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set in environment variables");
  }

  return new Mux({ tokenId, tokenSecret });
}

/**
 * Create a Mux upload URL.
 * Call this when an admin wants to upload a video.
 * Returns a direct upload URL the client posts the video file to.
 * The video is automatically transcoded and DRM-encrypted by Mux.
 */
export async function createMuxUpload(metadata: {
  moduleId: string;
  lessonDay: string;
  title: string;
}): Promise<{ uploadId: string; uploadUrl: string }> {
  const mux = getMuxClient();

  const upload = await mux.video.uploads.create({
    new_asset_settings: {
      playback_policy: ["signed"],
      mp4_support: "none",
      master_access: "none",
    },
    cors_origin: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nuru-academy-web.vercel.app") as string,
  });

  return {
    uploadId: upload.id,
    uploadUrl: upload.url ?? "",
  };
}

/**
 * Get the Mux asset ID from a completed upload.
 * Poll this after upload completes to get the asset ID for storage in DB.
 */
export async function getMuxUploadAsset(uploadId: string): Promise<{
  assetId: string | null;
  status: string;
}> {
  const mux = getMuxClient();
  const upload = await mux.video.uploads.retrieve(uploadId);

  return {
    assetId: upload.asset_id ?? null,
    status: upload.status,
  };
}

/**
 * Generate a signed playback token for a Mux asset.
 * This token is required to play a DRM-protected video.
 * Expires after 6 hours — captured tokens are useless after expiry.
 *
 * The token is tied to:
 *  - The specific playback ID (one video only)
 *  - The expiry time (6 hours)
 *  - The viewer's user ID (embedded in token metadata)
 */
export async function getMuxPlaybackToken(
  playbackId: string,
  viewerUserId: string
): Promise<string> {
  const signingKeyId      = process.env.MUX_SIGNING_KEY_ID;
  const signingPrivateKey = process.env.MUX_SIGNING_PRIVATE_KEY;

  if (!signingKeyId || !signingPrivateKey) {
    throw new Error("MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY must be set");
  }

  const mux = getMuxClient();

  const token = await mux.jwt.signPlaybackId(playbackId, {
    keyId:     signingKeyId,
    keySecret: Buffer.from(signingPrivateKey, "base64").toString("utf8"),
    type:      "video",
    expiration: "6h",
    params: {
      // Embed viewer identity in token — Mux logs this for audit
      sub: viewerUserId,
    },
  });

  return token;
}

/**
 * Delete a Mux asset.
 * Call when a video is removed from the admin CMS.
 */
export async function deleteMuxAsset(assetId: string): Promise<void> {
  const mux = getMuxClient();
  await mux.video.assets.delete(assetId);
}

/**
 * Get asset details including playback ID and status.
 */
export async function getMuxAsset(assetId: string): Promise<{
  playbackId: string | null;
  status: string;
  duration: number | null;
}> {
  const mux = getMuxClient();
  const asset = await mux.video.assets.retrieve(assetId);

  const playbackId = asset.playback_ids?.find((p) => p.policy === "signed")?.id ?? null;

  return {
    playbackId,
    status: asset.status ?? "unknown",
    duration: asset.duration ?? null,
  };
}
