/**
 * Client-safe file utilities (no Node.js fs/path imports).
 * Shared between server and client components.
 */

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
};

export function getMimeType(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "application/octet-stream";
  const ext = filename.slice(lastDot).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export function formatFileSize(bytes: number | bigint): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(bytes);
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

export function sanitizeFilename(filename: string): string {
  let sanitized = filename.replace(/\.{2,}[\\/]/g, "");
  sanitized = sanitized.replace(/[\\/]/g, "");
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, "");
  if (sanitized.length > 255) {
    const ext = getFileExtension(sanitized);
    sanitized = sanitized.slice(0, 255 - ext.length) + ext;
  }
  if (!sanitized || sanitized === ".") {
    sanitized = "unnamed_file" + getFileExtension(filename);
  }
  return sanitized;
}

export function getFileIcon(
  mimeType: string | null,
  fileType: string | null,
): string {
  if (mimeType?.startsWith("image/")) return "🖼️";
  if (mimeType?.startsWith("video/")) return "🎬";
  if (mimeType?.startsWith("audio/")) return "🎵";
  if (mimeType?.includes("pdf")) return "📄";
  if (
    mimeType?.includes("word") ||
    fileType === "doc" ||
    fileType === "docx"
  )
    return "📝";
  if (
    mimeType?.includes("sheet") ||
    fileType === "xls" ||
    fileType === "xlsx"
  )
    return "📊";
  if (
    mimeType?.includes("text") ||
    fileType === "txt" ||
    fileType === "md"
  )
    return "📃";
  return "📁";
}
