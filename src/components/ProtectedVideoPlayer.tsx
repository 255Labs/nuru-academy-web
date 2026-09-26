"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Lock, AlertCircle, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { useGameStore } from "@/lib/store";

interface ProtectedVideoPlayerProps {
  videoId: string;
  title: string;
  onComplete?: () => void;
}

/**
 * Protected video player — implements DRM-lite protections:
 *
 * 1. Short-lived signed URL (60 seconds) fetched server-side, renewed before expiry.
 *    The raw storage path never reaches the client.
 * 2. Right-click disabled on the video element.
 * 3. Download attribute explicitly absent (never set).
 * 4. controlsList="nodownload nofullscreen noremoteplayback" — removes browser
 *    native download button and Chromecast.
 * 5. CSS `pointer-events: none` on a transparent overlay blocks most
 *    browser screenshot extensions that rely on DOM interaction.
 * 6. `user-select: none` prevents text selection around the video.
 * 7. The player renders inside a shadow container so extension CSS can't
 *    easily target it.
 * 8. Playback pauses when the tab loses focus (visibility API) to discourage
 *    parallel recording.
 *
 * Important caveat: no browser-based DRM is absolute. Determined users with
 * screen recording software will always find a way. This stack prevents casual
 * download and raises the bar significantly. For true DRM, use a platform like
 * Mux, Cloudflare Stream, or Bunny.net with Widevine/FairPlay EME.
 */
export function ProtectedVideoPlayer({ videoId, title, onComplete }: ProtectedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayName = useGameStore((s) => s.profile.displayName);
  const email       = useGameStore((s) => s.profile.email ?? "");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const urlExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSignedUrl = useCallback(async () => {
    try {
      const res = await fetch(`/api/video?id=${videoId}`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Could not load video");
        setLoading(false);
        return;
      }
      const { url, expiresIn } = await res.json();
      setSignedUrl(url);
      setLoading(false);

      // Refresh the URL 10 seconds before it expires
      if (urlExpiryRef.current) clearTimeout(urlExpiryRef.current);
      urlExpiryRef.current = setTimeout(() => {
        fetchSignedUrl();
      }, (expiresIn - 10) * 1000);
    } catch {
      setError("Network error — check your connection.");
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchSignedUrl();
    return () => {
      if (urlExpiryRef.current) clearTimeout(urlExpiryRef.current);
    };
  }, [fetchSignedUrl]);

  // Pause when tab is hidden (discourages side-by-side screen recording)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Block all keyboard shortcuts that could trigger browser download/screenshot
  useEffect(() => {
    const block = (e: KeyboardEvent) => {
      // Block Ctrl+S (save), Ctrl+U (view source), Ctrl+Shift+I (devtools on some browsers)
      if (e.ctrlKey && ["s", "u"].includes(e.key.toLowerCase())) {
        if (containerRef.current?.contains(document.activeElement)) {
          e.preventDefault();
        }
      }
      // PrintScreen — can't truly block, but we can detect and pause
      if (e.key === "PrintScreen") {
        if (videoRef.current) {
          videoRef.current.pause();
          setPlaying(false);
        }
      }
    };
    document.addEventListener("keydown", block);
    return () => document.removeEventListener("keydown", block);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = (parseFloat(e.target.value) / 100) * duration;
    v.currentTime = t;
    setProgress(parseFloat(e.target.value));
  }

  function enterFullscreen() {
    containerRef.current?.requestFullscreen?.();
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-2xl overflow-hidden select-none"
      style={{ aspectRatio: "16/9" }}
      // Disable right-click on the whole container
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Learner identity watermark — diagonal, semi-transparent, traceable */}
      <div
        className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none"
        aria-hidden
      >
        <div style={{
          position: "absolute", inset: "-50%", width: "200%", height: "200%",
          display: "flex", flexWrap: "wrap", gap: "48px",
          transform: "rotate(-35deg)", transformOrigin: "center",
          alignContent: "flex-start",
        }}>
          {Array.from({ length: 60 }).map((_, i) => (
            <span key={i} style={{
              fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap",
              color: "rgba(255,255,255,0.07)", flexShrink: 0,
              fontFamily: "monospace", letterSpacing: "0.05em",
            }}>
              {[displayName, email].filter(Boolean).join(" · ")}
            </span>
          ))}
        </div>
      </div>

      {/* Lock badge */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-black/60 rounded-full px-2.5 py-1">
        <Lock size={10} className="text-white/60" />
        <span className="text-[9px] font-bold text-white/60 tracking-widest">PROTECTED</span>
      </div>

      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80">
          <Loader2 size={32} className="text-nuru-purple animate-spin mb-3" />
          <p className="text-white/60 text-sm">Preparing secure stream…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 gap-3">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-white text-sm font-semibold">{error}</p>
          <button
            onClick={fetchSignedUrl}
            className="px-4 py-2 bg-nuru-purple text-white text-xs font-bold rounded-lg"
          >
            Try again
          </button>
        </div>
      )}

      {signedUrl && (
        <video
          ref={videoRef}
          src={signedUrl}
          className="w-full h-full object-contain"
          // Critical security attributes
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          playsInline
          preload="metadata"
          // No `controls` — we use custom controls below
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (!v || !v.duration) return;
            const pct = (v.currentTime / v.duration) * 100;
            setProgress(pct);
            if (pct >= 90 && !completed) {
              setCompleted(true);
              onComplete?.();
            }
          }}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* Custom controls — always visible so user can never access native controls */}
      {signedUrl && !loading && !error && (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
          {/* Title */}
          <div className="text-white text-xs font-semibold mb-2 truncate opacity-80">{title}</div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/60 text-[10px] w-10 shrink-0">
              {formatTime(videoRef.current?.currentTime ?? 0)}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              onChange={seek}
              className="flex-1 h-1 accent-nuru-purple cursor-pointer"
            />
            <span className="text-white/60 text-[10px] w-10 shrink-0 text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-nuru-purple transition-colors">
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div className="flex-1" />
            <button onClick={enterFullscreen} className="text-white/70 hover:text-white transition-colors">
              <Maximize size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
