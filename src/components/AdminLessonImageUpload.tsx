"use client";

import {
  useState,
  useCallback,
  useRef,
  DragEvent,
  ChangeEvent,
} from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useT } from "@/lib/i18n";
import { useGameStore } from "@/lib/store";

interface AdminLessonImageUploadProps {
  lessonId: string;
  currentImageUrl?: string;
  onUploadComplete: (url: string) => void;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "complete"; url: string }
  | { status: "error"; message: string };

const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = "lesson-images";

export function AdminLessonImageUpload({
  lessonId,
  currentImageUrl,
  onUploadComplete,
}: AdminLessonImageUploadProps) {
  const t = useT();

  // All hooks must be called unconditionally before any early return
  const role = useGameStore((s) => s.profile.role);
  const supabase = createClientComponentClient();

  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImageUrl);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      // Inline validation so the callback captures t without stale closure issues
      if (!ACCEPTED_MIME_TYPES.includes(file.type as AcceptedMimeType)) {
        setUploadState({ status: "error", message: t("upload.error_type") });
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploadState({ status: "error", message: t("upload.error_size") });
        return;
      }

      // Optimistic preview so the UI feels immediate
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setUploadState({ status: "uploading", progress: 10 });

      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `lessons/${lessonId}/${timestamp}-${safeName}`;

        // Supabase JS v2 doesn't expose upload progress natively;
        // simulate two-phase progress to give meaningful feedback.
        setUploadState({ status: "uploading", progress: 30 });

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        setUploadState({ status: "uploading", progress: 90 });

        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(path);

        setUploadState({ status: "complete", url: publicUrl });
        onUploadComplete(publicUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setUploadState({ status: "error", message });
        // Revert to the original image if we had one
        setPreviewUrl(currentImageUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [lessonId, supabase, onUploadComplete, currentImageUrl, t]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset so the same file can be re-selected after an error
    e.target.value = "";
  };

  const handleCopyUrl = async () => {
    if (uploadState.status !== "complete") return;
    try {
      await navigator.clipboard.writeText(uploadState.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text in the span so the user can copy manually
      const el = document.getElementById("upload-url-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  // Admin guard — renders nothing for non-admin users.
  // Placed after all hook calls to satisfy React's rules of hooks.
  if (role !== "admin") return null;

  const isUploading = uploadState.status === "uploading";

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label={t("upload.drop_zone")}
        aria-disabled={isUploading}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isUploading) {
            fileInputRef.current?.click();
          }
        }}
        className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed
          transition-all duration-200 select-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuru-purple focus-visible:ring-offset-2
          ${isUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
          ${
            dragging
              ? "border-nuru-purple bg-nuru-purple/5 scale-[1.01]"
              : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 hover:border-nuru-purple/60 hover:bg-nuru-purple/5"
          }`}
      >
        {/* Preview thumbnail or placeholder icon */}
        {previewUrl ? (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover"
              aria-hidden="true"
            />
            {/* Drag-over overlay on an existing preview */}
            {dragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-nuru-purple/40 rounded-xl">
                <UploadCloud
                  className="w-10 h-10 text-white"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        ) : (
          <ImageIcon
            className="w-10 h-10 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
        )}

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-nuru-ink dark:text-white">
            {t("upload.drop_zone")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("upload.browse")}
          </p>
        </div>
      </div>

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />

      {/* Upload progress bar */}
      {uploadState.status === "uploading" && (
        <div
          className="flex flex-col gap-2"
          role="status"
          aria-live="polite"
          aria-label={t("upload.uploading")}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-nuru-ink dark:text-gray-300">
              {t("upload.uploading")}
            </span>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {uploadState.progress}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-nuru-purple transition-all duration-500 ease-out"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success: show public URL with copy button */}
      {uploadState.status === "complete" && (
        <div
          className="flex flex-col gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {t("upload.complete")}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span
              id="upload-url-text"
              className="flex-1 truncate text-xs font-mono text-gray-600 dark:text-gray-400
                bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5
                border border-gray-200 dark:border-gray-700 select-all"
            >
              {uploadState.url}
            </span>
            <button
              type="button"
              onClick={handleCopyUrl}
              aria-label={copied ? t("upload.copied") : t("upload.copy_url")}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                bg-nuru-purple text-white hover:bg-nuru-purple/90 active:scale-95 transition-all"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {copied ? t("upload.copied") : t("upload.copy_url")}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {uploadState.status === "error" && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle
            className="w-4 h-4 text-nuru-rose flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-red-700 dark:text-red-300">
            {uploadState.message}
          </p>
        </div>
      )}
    </div>
  );
}

// ADD TO i18n_additions.ts
// ─────────────────────────────────────────────────────────────────────────────
// "upload.drop_zone": {
//   en: "Drop an image here",
//   sw: "Buruza picha hapa",
//   fr: "Déposez une image ici",
//   am: "ምስልን እዚህ ይጣሉ",
//   ha: "Jefa hoto a nan",
//   yo: "Sọ àwòrán sílẹ̀ níbí",
//   zu: "Ehlisa isithombe lapha",
// },
// "upload.browse": {
//   en: "or click to browse — JPEG, PNG, WebP up to 5 MB",
//   sw: "au bonyeza kuvinjari — JPEG, PNG, WebP hadi 5 MB",
//   fr: "ou cliquez pour parcourir — JPEG, PNG, WebP jusqu'à 5 Mo",
//   am: "ወይም ለማሰስ ጠቅ ያድርጉ — JPEG፣ PNG፣ WebP እስከ 5 MB",
//   ha: "ko danna don bincika — JPEG, PNG, WebP har 5 MB",
//   yo: "tàbí tẹ̀ láti wá — JPEG, PNG, WebP títí dé 5 MB",
//   zu: "noma chofoza ukuze ukhangele — JPEG, PNG, WebP kuya ku-5 MB",
// },
// "upload.uploading": {
//   en: "Uploading...",
//   sw: "Inapakia...",
//   fr: "Téléchargement...",
//   am: "በመጫን ላይ...",
//   ha: "Ana loda...",
//   yo: "Ń gbéeré...",
//   zu: "Iyalayisha...",
// },
// "upload.complete": {
//   en: "Upload complete",
//   sw: "Upakiaji umekamilika",
//   fr: "Téléchargement terminé",
//   am: "መጫን ተጠናቋል",
//   ha: "Loda ta kammala",
//   yo: "Gbígbéeré parí",
//   zu: "Ukulayisha kuphelile",
// },
// "upload.error_size": {
//   en: "File exceeds the 5 MB limit. Please choose a smaller image.",
//   sw: "Faili inazidi kikomo cha 5 MB. Tafadhali chagua picha ndogo.",
//   fr: "Le fichier dépasse la limite de 5 Mo. Choisissez une image plus petite.",
//   am: "ፋይሉ ከ5 MB ገደብ አልፏል። ትንሽ ምስል ይምረጡ።",
//   ha: "Fayil ya wuce iyakar 5 MB. Da fatan a zaɓi hoto ƙarami.",
//   yo: "Fáìlì jù 5 MB lọ. Jọ̀wọ́ yan àwòrán tó kéré.",
//   zu: "Ifayela lidlula umkhawulo we-5 MB. Sicela ukhethe isithombe esincane.",
// },
// "upload.error_type": {
//   en: "Only JPEG, PNG, and WebP images are accepted.",
//   sw: "Picha za JPEG, PNG, na WebP tu zinakubaliwa.",
//   fr: "Seules les images JPEG, PNG et WebP sont acceptées.",
//   am: "JPEG፣ PNG እና WebP ምስሎች ብቻ ይቀበላሉ።",
//   ha: "Hotunan JPEG, PNG, da WebP kawai ake karɓa.",
//   yo: "Àwọn àwòrán JPEG, PNG, àti WebP nìkan ni a gba.",
//   zu: "Izithombe ze-JPEG, PNG, ne-WebP kuphela ezamukelwa.",
// },
// "upload.copy_url": {
//   en: "Copy URL",
//   sw: "Nakili URL",
//   fr: "Copier l'URL",
//   am: "URL ቅዳ",
//   ha: "Kwafi URL",
//   yo: "Daakọ URL",
//   zu: "Kopisha i-URL",
// },
// "upload.copied": {
//   en: "Copied",
//   sw: "Imenakiliwa",
//   fr: "Copié",
//   am: "ተቅድቷል",
//   ha: "An kwafi",
//   yo: "Ti daakọ",
//   zu: "Ikhopishiwe",
// },
