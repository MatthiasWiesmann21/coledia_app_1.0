/**
 * File upload security validation for Coledia.
 * Ported from Project-PrivateCloudStorag/src/lib/fileSecurity.ts
 */

import path from "path";

// Allowed MIME types and their magic bytes (file signatures)
const ALLOWED_FILE_TYPES: Record<
  string,
  { extensions: string[]; magicBytes: number[][]; isText?: boolean }
> = {
  // Images
  "image/jpeg": {
    extensions: [".jpg", ".jpeg"],
    magicBytes: [[0xff, 0xd8, 0xff]],
  },
  "image/png": {
    extensions: [".png"],
    magicBytes: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  "image/gif": {
    extensions: [".gif"],
    magicBytes: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ],
  },
  "image/webp": {
    extensions: [".webp"],
    magicBytes: [[0x52, 0x49, 0x46, 0x46]],
  },
  "image/svg+xml": {
    extensions: [".svg"],
    magicBytes: [],
    isText: true,
  },
  "image/bmp": {
    extensions: [".bmp"],
    magicBytes: [[0x42, 0x4d]],
  },

  // Videos
  "video/mp4": {
    extensions: [".mp4"],
    magicBytes: [
      [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
      [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70],
    ],
  },
  "video/webm": {
    extensions: [".webm"],
    magicBytes: [[0x1a, 0x45, 0xdf, 0xa3]],
  },
  "video/quicktime": {
    extensions: [".mov"],
    magicBytes: [
      [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70],
      [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
      [0x71, 0x74, 0x20, 0x20],
    ],
  },

  // Audio
  "audio/mpeg": {
    extensions: [".mp3"],
    magicBytes: [[0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]],
  },
  "audio/wav": {
    extensions: [".wav"],
    magicBytes: [[0x52, 0x49, 0x46, 0x46]],
  },
  "audio/flac": {
    extensions: [".flac"],
    magicBytes: [[0x66, 0x4c, 0x61, 0x43]],
  },

  // Documents
  "application/pdf": {
    extensions: [".pdf"],
    magicBytes: [[0x25, 0x50, 0x44, 0x46]],
  },
  "application/msword": {
    extensions: [".doc"],
    magicBytes: [[0xd0, 0xcf, 0x11, 0xe0]],
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: [".docx"],
    magicBytes: [[0x50, 0x4b, 0x03, 0x04]],
  },
  "application/vnd.ms-excel": {
    extensions: [".xls"],
    magicBytes: [[0xd0, 0xcf, 0x11, 0xe0]],
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extensions: [".xlsx"],
    magicBytes: [[0x50, 0x4b, 0x03, 0x04]],
  },
  "application/vnd.ms-powerpoint": {
    extensions: [".ppt"],
    magicBytes: [[0xd0, 0xcf, 0x11, 0xe0]],
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extensions: [".pptx"],
    magicBytes: [[0x50, 0x4b, 0x03, 0x04]],
  },

  // Text
  "text/plain": { extensions: [".txt"], magicBytes: [], isText: true },
  "text/csv": { extensions: [".csv"], magicBytes: [], isText: true },
  "text/markdown": {
    extensions: [".md", ".markdown"],
    magicBytes: [],
    isText: true,
  },
  "application/json": { extensions: [".json"], magicBytes: [], isText: true },
  "text/html": { extensions: [".html", ".htm"], magicBytes: [], isText: true },
  "text/css": { extensions: [".css"], magicBytes: [], isText: true },

  // Archives
  "application/zip": { extensions: [".zip"], magicBytes: [[0x50, 0x4b, 0x03, 0x04]] },
};

// Extensions that should never be allowed
const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".dll", ".bat", ".cmd", ".sh", ".php", ".jsp", ".asp", ".aspx",
  ".py", ".rb", ".pl", ".cgi", ".jar", ".war", ".ear", ".msi", ".com",
  ".scr", ".vbs", ".js", ".wsf", ".hta", ".ps1", ".psm1", ".psd1",
  ".pyc", ".pyo", ".class",
]);

// Patterns that might indicate malicious content in text files
const SUSPICIOUS_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /eval\s*\(/i,
  /document\.cookie/i,
  /document\.write/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /data:text\/html/i,
  /<\?php/i,
  /<%.*%>/,
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

export function validateFileSize(
  size: number,
  maxBytes: number,
): FileValidationResult {
  if (size > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed (${Math.round(maxBytes / 1024 / 1024)}MB)`,
    };
  }
  if (size <= 0) {
    return { valid: false, error: "File appears to be empty" };
  }
  return { valid: true };
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

export function isDangerousExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return DANGEROUS_EXTENSIONS.has(ext);
}

export function validateFileExtension(filename: string): FileValidationResult {
  const ext = getFileExtension(filename);
  if (!ext) return { valid: false, error: "File has no extension" };
  if (isDangerousExtension(filename)) {
    return {
      valid: false,
      error: `File type "${ext}" is not allowed for security reasons`,
    };
  }
  const allowed = Object.values(ALLOWED_FILE_TYPES).some((t) =>
    t.extensions.includes(ext),
  );
  if (!allowed) return { valid: false, error: `File type "${ext}" is not allowed` };
  return { valid: true };
}

export function validateMimeType(
  declaredMime: string,
  filename: string,
): FileValidationResult {
  const ext = getFileExtension(filename);
  const expectedType = Object.entries(ALLOWED_FILE_TYPES).find(([, type]) =>
    type.extensions.includes(ext),
  );
  if (!expectedType) return { valid: false, error: "Unknown file type" };

  const [expectedMime] = expectedType;

  if (
    declaredMime !== expectedMime &&
    !isMimeTypeCompatible(declaredMime, expectedMime)
  ) {
    return {
      valid: false,
      error: `MIME type mismatch: declared "${declaredMime}" but expected "${expectedMime}"`,
    };
  }

  return { valid: true, mimeType: expectedMime };
}

function isMimeTypeCompatible(declared: string, expected: string): boolean {
  if (expected === "image/jpeg" && declared === "image/jpg") return true;
  if (expected === "text/plain" && declared.startsWith("text/")) return true;
  const declaredCategory = declared.split("/")[0];
  const expectedCategory = expected.split("/")[0];
  return declaredCategory === expectedCategory;
}

export async function validateMagicBytes(
  buffer: Buffer,
  mimeType: string,
): Promise<FileValidationResult> {
  const fileType = ALLOWED_FILE_TYPES[mimeType];
  if (!fileType) return { valid: true }; // Allow unknown MIME if no entry
  if (fileType.isText || fileType.magicBytes.length === 0) return { valid: true };

  const matches = fileType.magicBytes.some((signature) => {
    if (buffer.length < signature.length) return false;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }
    return true;
  });

  if (!matches) {
    return {
      valid: false,
      error: `File content does not match expected type "${mimeType}". Possible extension spoofing.`,
    };
  }
  return { valid: true };
}

export function scanTextContent(content: string): FileValidationResult {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      return { valid: false, error: "File contains potentially malicious content" };
    }
  }
  return { valid: true };
}

export function containsPathTraversal(filepath: string): boolean {
  const normalized = filepath.replace(/\\/g, "/");
  return (
    normalized.includes("../") ||
    normalized.includes("..\\") ||
    normalized.startsWith("/") ||
    normalized.startsWith("\\") ||
    normalized.includes("//") ||
    /[:*?"<>|]/.test(normalized)
  );
}

/** Comprehensive file validation */
export async function validateFile(
  file: File,
  buffer: Buffer,
  maxBytes: number,
): Promise<FileValidationResult> {
  // Size
  const sizeValidation = validateFileSize(file.size, maxBytes);
  if (!sizeValidation.valid) return sizeValidation;

  // Dangerous extension
  if (isDangerousExtension(file.name)) {
    return {
      valid: false,
      error: "File type is not allowed for security reasons",
    };
  }

  // Extension
  const extValidation = validateFileExtension(file.name);
  if (!extValidation.valid) return extValidation;

  // MIME type
  const mimeValidation = validateMimeType(file.type, file.name);
  if (!mimeValidation.valid) return mimeValidation;
  const expectedMime = mimeValidation.mimeType;
  if (!expectedMime)
    return { valid: false, error: "Could not determine file type" };

  // Magic bytes
  const magicValidation = await validateMagicBytes(buffer, expectedMime);
  if (!magicValidation.valid) return magicValidation;

  // Text scan for text files
  const fileType = ALLOWED_FILE_TYPES[expectedMime];
  if (fileType?.isText) {
    try {
      const textContent = buffer.toString("utf-8");
      const contentValidation = scanTextContent(textContent);
      if (!contentValidation.valid) return contentValidation;
    } catch {
      return {
        valid: false,
        error: "File content does not match declared text format",
      };
    }
  }

  return { valid: true, mimeType: expectedMime };
}

/** Validate as image only (for avatar/logo/thumbnail uploads) */
export async function validateImageFile(
  file: File,
  buffer: Buffer,
  maxBytes: number = 5 * 1024 * 1024, // 5MB default
): Promise<FileValidationResult> {
  const result = await validateFile(file, buffer, maxBytes);
  if (!result.valid) return result;
  if (!result.mimeType?.startsWith("image/")) {
    return { valid: false, error: "Only image files are allowed" };
  }
  return result;
}

/** Resolves a safe storage filename, refusing path traversal */
export function safeStoragePath(filename: string): string | null {
  if (containsPathTraversal(filename)) return null;
  // Remove any leading dots/slashes that survived sanitization
  const cleaned = filename.replace(/^[/\\]+/, "").replace(/\0/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return null;
  return cleaned;
}
