import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Re-export client-safe utilities so server code can import everything from one place
export {
  getMimeType,
  formatFileSize,
  getFileExtension,
  sanitizeFilename,
} from "./file-utils";

import { sanitizeFilename } from "./file-utils";

const STORAGE_PATH = (process.env.STORAGE_PATH || "./uploads").replace(/^\.\//, "");

export async function ensureStorageDirectory(basePath: string) {
  try {
    await fs.access(basePath);
  } catch {
    await fs.mkdir(basePath, { recursive: true });
  }
}

/** Resolve a storage-relative path (e.g. "tenantId/documents/file.pdf") to an
 *  absolute disk path by prefixing the project working directory + STORAGE_PATH. */
export function resolveStoragePath(storagePath: string): string {
  return path.join(process.cwd(), STORAGE_PATH, storagePath);
}

/** Save a file to tenant-scoped storage. Returns a forward-slash relative path
 *  (e.g. "clx123/documents/1718200000-a1b2-file.pdf"). */
export async function saveFile(
  buffer: Buffer,
  tenantId: string,
  category: "documents" | "images" | "avatars" | "videos",
  filename: string,
): Promise<string> {
  const dir = path.join(STORAGE_PATH, tenantId, category);
  await ensureStorageDirectory(dir);

  const uniqueFilename = generateUniqueFilename(filename);
  await fs.writeFile(path.join(dir, uniqueFilename), buffer);

  // Return forward-slash relative path without the uploads/ prefix
  return `${tenantId}/${category}/${uniqueFilename}`;
}

/** Convert a storage-relative path to a public URL path. */
export function storagePathToUrl(storagePath: string): string {
  // storagePath already uses forward slashes and has no prefix
  return `/api/uploads/${storagePath.replace(/\\/g, "/")}`;
}

export async function readFile(storagePath: string): Promise<Buffer> {
  return fs.readFile(resolveStoragePath(storagePath));
}

export async function deleteFile(storagePath: string): Promise<void> {
  try {
    await fs.unlink(resolveStoragePath(storagePath));
  } catch {
    console.error("Failed to delete file:", storagePath);
  }
}

function generateUniqueFilename(filename: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  const sanitized = sanitizeFilename(filename);
  return `${timestamp}-${random}-${sanitized}`;
}
