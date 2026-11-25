import { NextRequest, NextResponse } from "next/server";
import { routeMember } from "@/lib/guards";
import { saveFile, storagePathToUrl, sanitizeFilename } from "@/lib/storage";
import { validateImageFile } from "@/lib/file-security";
import { assertStorageQuota } from "@/lib/storage-quota";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

type ImageCategory =
  | "avatars"
  | "logo"
  | "course-thumbnails"
  | "post-images"
  | "event-thumbnails"
  | "certificates";

const ALLOWED_CATEGORIES: ImageCategory[] = [
  "avatars",
  "logo",
  "course-thumbnails",
  "post-images",
  "event-thumbnails",
  "certificates",
];

/**
 * POST /api/upload/images — upload an image (avatar, logo, thumbnail, etc.)
 *
 * FormData fields:
 *   file     — the image file (required)
 *   category — one of: avatars, logo, course-thumbnails, post-images, event-thumbnails (required)
 */
export async function POST(request: NextRequest) {
  const member = await routeMember();
  if (member instanceof Response) return member;
  const { tenantId } = member;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const rawCategory = formData.get("category") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!rawCategory || !ALLOWED_CATEGORIES.includes(rawCategory as ImageCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  const category = rawCategory as ImageCategory;

  // Any member can upload their own avatar; other categories require admin
  if (category !== "avatars" && !member.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read buffer + validate
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const validation = await validateImageFile(file, buffer, MAX_IMAGE_SIZE);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Enforce tenant storage quota (avatars count toward tenant usage too)
  const quotaError = await assertStorageQuota(tenantId, file.size);
  if (quotaError) {
    return NextResponse.json({ error: quotaError }, { status: 413 });
  }

  const sanitizedName = sanitizeFilename(file.name);

  // Determine storage category folder name
  const storageCategory = category === "logo" ? "images" : category;

  // Save to disk
  const storagePath = await saveFile(buffer, tenantId, storageCategory as any, sanitizedName);
  const fileUrl = storagePathToUrl(storagePath);

  return NextResponse.json({ url: fileUrl }, { status: 201 });
}
