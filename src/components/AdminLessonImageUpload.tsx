"use client";

import { useRef, useState } from "react";
import { Upload, Copy, Check, ImageIcon, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGameStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

const MAX_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  lessonId: string;
  onUploaded?: (url: string) => void;
}

export function AdminLessonImageUpload({ lessonId, onUploaded }: Props) {
  const t = useT();
  const role = useGameStore((s) => s.profile.role);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  // All hooks must be above this guard
  if (role !== "admin") return null;

  async function handleFile(file: File) {
    setError(null);
    setUploadedUrl(null);
    setCopied(false);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t("upload.error_type"));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(t("upload.error_size"));
      return;
    }

    setUploading(true);
    setProgress(10);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `lessons/${lessonId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Simulate progress (Supabase JS v2 has no XHR progress events)
    const ticker = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 200);

    try {
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("lesson-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      clearInterval(ticker);

      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        setProgress(0);
        return;
      }

      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      setProgress(100);
      setUploadedUrl(data.publicUrl);
      onUploaded?.(data.publicUrl);
    } catch (err: unknown) {
      clearInterval(ticker);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function copyUrl() {
    if (!uploadedUrl) return;
    await navigator.clipboard.writeText(uploadedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed
          cursor-pointer transition-colors p-8 text-center select-none
          ${dragging
            ? "border-nuru-purple bg-nuru-lav"
            : "border-nuru-line bg-nuru-bg hover:border-nuru-purple hover:bg-nuru-lav/50"
          }
        `}
      >
        <ImageIcon size={32} className="text-nuru-muted" />
        <p className="text-sm text-nuru-muted">
          {t("upload.drop_zone")}{" "}
          <span className="text-nuru-purple font-semibold">{t("upload.browse")}</span>
        </p>
        <p className="text-xs text-nuru-muted/70">PNG, JPG, WEBP, GIF · max {MAX_MB}MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {/* Progress */}
      {uploading && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-nuru-muted">
            <span className="flex items-center gap-1.5">
              <Upload size={12} className="animate-bounce" />
              {t("upload.uploading")}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-nuru-lav overflow-hidden">
            <div
              className="h-full bg-nuru-purple transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {uploadedUrl && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-nuru-green flex items-center gap-1.5">
            <Check size={13} /> {t("upload.complete")}
          </div>
          <img
            src={uploadedUrl}
            alt="Uploaded lesson image"
            className="rounded-xl border border-nuru-line object-cover max-h-48 w-full"
          />
          <button
            onClick={copyUrl}
            className="flex items-center gap-2 rounded-xl border border-nuru-line bg-nuru-bg px-3 py-2 text-xs font-mono text-nuru-muted hover:bg-nuru-lav transition-colors"
          >
            {copied ? <Check size={12} className="text-nuru-green" /> : <Copy size={12} />}
            <span className="flex-1 truncate text-left">{uploadedUrl}</span>
            <span className="text-nuru-purple font-sans font-semibold shrink-0">
              {copied ? t("upload.copied") : t("upload.copy_url")}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
