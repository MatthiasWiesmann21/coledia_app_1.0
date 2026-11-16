import { NextResponse } from "next/server";
import { requireRoomAccess } from "@/lib/chat/access";
import { validateFile } from "@/lib/file-security";
import { assertStorageQuota } from "@/lib/storage-quota";
import { saveFile, sanitizeFilename } from "@/lib/storage";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * POST /api/chat/attachments — upload a file for a chat message (multipart:
 * `file`, `room`). Returns metadata the client passes to sendMessage; the
 * storage path embeds the uploader id so it can't be reused by others.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  let ctx;
  try {
    ({ ctx } = await requireRoomAccess(form.get("room")));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateFile(file, buffer, MAX_SIZE);
  if (!validation.valid || !validation.mimeType) {
    return NextResponse.json({ error: validation.error ?? "File type not allowed" }, { status: 400 });
  }
  // SVG can carry scripts — never render it from chat
  if (validation.mimeType === "image/svg+xml") {
    return NextResponse.json({ error: "SVG files are not allowed" }, { status: 400 });
  }

  const quotaError = await assertStorageQuota(ctx.tenantId, file.size);
  if (quotaError) return NextResponse.json({ error: quotaError }, { status: 413 });

  const name = sanitizeFilename(file.name);
  const storagePath = await saveFile(buffer, ctx.tenantId, "chat", `${ctx.userId}-${name}`);

  return NextResponse.json({
    name,
    mimeType: validation.mimeType,
    size: file.size,
    storagePath,
  });
}
