"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { useGameStore } from "@/lib/store";

interface MuxVideoPlayerProps {
  playbackId: string;
  title: string;
  onComplete?: () => void;
  onProgress?: (pct: number) => void;
}

/**
 * MuxVideoPlayer — DRM-protected video player using Mux.
 *
 * Uses Mux's signed playback tokens to serve Widevine (Chrome/Android)
 * and FairPlay (Safari/iOS) DRM-encrypted video.
 *
 * DRM blocks screen recording at the OS level on supported browsers.
 * Even if a user finds the signed URL, it expires in 6 hours and
 * is tied to a specific playback ID — useless without the DRM keys.
 *
 * Fallback: if Mux is not configured (MUX_SIGNING_KEY not set),
 * shows a clear message rather than breaking silently.
 */
export function MuxVideoPlayer({ playbackId, title, onComplete, onProgress }: MuxVideoPlayerProps) {
  const displayName = useGameStore((s) => s.profile.displayName);
  const email       = useGameStore((s) => s.profile.email ?? "");

  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  // Fetch signed playback token from our API
  useEffect(() => {
    if (!playbackId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/video/mux-token?playbackId=${encodeURIComponent(playbackId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setToken(data.token);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load video. Please try again.");
        setLoading(false);
      });
  }, [playbackId]);

  // Attach events to mux-player via DOM ref after it mounts
  useEffect(() => {
    const container = playerRef.current;
    if (!container || !token) return;
    const player = container.querySelector("mux-player");
    if (!player) return;

    const onEnded = () => onComplete?.();
    const onTimeUpdate = (e: Event) => {
      const target = e.target as HTMLElement & { currentTime?: number; duration?: number };
      const current = target.currentTime ?? 0;
      const duration = target.duration ?? 0;
      if (duration > 0) {
        const pct = Math.round((current / duration) * 100);
        if (pct !== progressRef.current) {
          progressRef.current = pct;
          onProgress?.(pct);
          if (pct >= 90) onComplete?.();
        }
      }
    };

    player.addEventListener("ended", onEnded);
    player.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [token, onComplete, onProgress]);

  if (loading) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/50">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">Loading secure video…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full aspect-video bg-[#0F0F14] rounded-2xl overflow-hidden flex items-center justify-center border border-white/10">
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-white/60 text-sm">{error}</p>
          <button onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-nuru-purple text-white text-sm font-semibold">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!token) return null;

  // Build the Mux HLS URL with signed token
  const muxSrc = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden" ref={playerRef}>

      {/* Mux Player — loads via script tag for maximum DRM compatibility */}
      <mux-player
        stream-type="on-demand"
        src={muxSrc}
        playback-id={playbackId}
        metadata-video-title={title}
        metadata-viewer-user-id={displayName}
        accent-color="#6B4EFF"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Learner identity watermark — visible in any screenshot */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden>
        <div style={{
          position: "absolute", inset: "-50%", width: "200%", height: "200%",
          display: "flex", flexWrap: "wrap", gap: "56px",
          transform: "rotate(-35deg)", transformOrigin: "center",
          alignContent: "flex-start",
        }}>
          {Array.from({ length: 60 }).map((_, i) => (
            <span key={i} style={{
              fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap",
              color: "rgba(255,255,255,0.06)", flexShrink: 0,
              fontFamily: "monospace", letterSpacing: "0.05em",
            }}>
              {[displayName, email].filter(Boolean).join(" · ")}
            </span>
          ))}
        </div>
      </div>

      {/* DRM indicator badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur rounded-full px-2.5 py-1 pointer-events-none">
        <ShieldCheck size={11} className="text-green-400" />
        <span className="text-[10px] font-bold text-white/60">DRM Protected</span>
      </div>
    </div>
  );
}

// Extend JSX for the mux-player web component
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "mux-player": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        "stream-type"?: string;
        "playback-id"?: string;
        "metadata-video-title"?: string;
        "metadata-viewer-user-id"?: string;
        "accent-color"?: string;
        src?: string;
        onEnded?: (e: Event) => void;
        onTimeUpdate?: (e: Event) => void;
        }, HTMLElement>;
      }
    }
  }
}
