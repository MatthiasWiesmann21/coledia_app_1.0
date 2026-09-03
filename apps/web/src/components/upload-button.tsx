"use client";

import { useState, useRef } from "react";
import { X, ImagePlus } from "lucide-react";
import { cn } from "@coledia/ui/lib/utils";

interface UploadButtonProps {
  /** Upload category — determines storage folder */
  category: "avatars" | "logo" | "course-thumbnails" | "post-images" | "event-thumbnails";
  /** Current value (URL or empty string) */
  value: string | null;
  /** Called with the new URL after upload, or null when removed */
  onChange: (url: string | null) => void;
  /** Label text shown above the upload area */
  label?: string;
  /** Max file size in MB (default: 5) */
  maxSizeMB?: number;
  /** Aspect ratio for the preview (default: 16/9) */
  aspectRatio?: "square" | "16/9" | "21/9";
  /** Compact mode — smaller preview */
  compact?: boolean;
}

/**
 * Reusable upload button for images (avatars, logos, thumbnails).
 * Replaces the old URL text inputs with a native file upload.
 *
 * - Click to select file, or drag & drop onto the area
 * - Uploads via POST /api/upload/images
 * - Returns the public URL via onChange
 */
export function UploadButton({
  category,
  value,
  onChange,
  label,
  maxSizeMB = 5,
  aspectRatio = "16/9",
  compact = false,
}: UploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(file: File | null) {
    if (!file) return;
    setError(null);

    // Client-side validation
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const res = await fetch("/api/upload/images", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Upload failed");
        setUploading(false);
        return;
      }

      const data = await res.json();
      onChange(data.url);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "21/9"
        ? "aspect-[21/9]"
        : "aspect-[16/9]";

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-sm font-medium">{label}</span>
      )}

      {value ? (
        /* Preview + remove */
        <div className={cn("group relative overflow-hidden rounded-lg border border-[var(--border)]", compact && "max-w-[200px]")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Uploaded image"
            className={cn("w-full object-cover", aspectClass)}
          />
          <button
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        /* Upload area */
        <button
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition",
            compact && "max-w-[200px]",
            dragOver
              ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/5"
              : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--tenant-primary)]/50 hover:bg-[var(--muted)]",
            uploading && "opacity-60",
            aspectClass,
          )}
        >
          {uploading ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--tenant-primary)] border-t-transparent" />
          ) : (
            <ImagePlus className="h-6 w-6 text-[var(--muted-foreground)]" />
          )}
          <span className="text-sm text-[var(--muted-foreground)]">
            {uploading ? "Uploading..." : "Click or drag to upload"}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {maxSizeMB}MB max
          </span>
        </button>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
