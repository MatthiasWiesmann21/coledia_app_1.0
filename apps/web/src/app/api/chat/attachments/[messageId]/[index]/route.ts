import { NextResponse } from "next/server";
import { prisma } from "@coledia/db";
import { requireMember } from "@/lib/guards";
import { checkRoomAccess, parseRoomKey, roomKeyOf } from "@/lib/chat/access";
import { storedAttachments } from "@/lib/chat/serialize";
import { readFile } from "@/lib/storage";

const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm", "audio/mpeg"]);

/** GET /api/chat/attachments/[messageId]/[index] — serve a chat attachment to room members. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string; index: string }> },
) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { messageId, index } = await params;

  const message = await prisma.message.findFirst({
    where: { id: messageId, tenantId: ctx.tenantId, deletedAt: null },
    select: { channelId: true, directConversationId: true, attachments: true },
  });
  const room = message ? parseRoomKey(roomKeyOf(message)) : null;
  if (!message || !room || !(await checkRoomAccess(ctx, room))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachment = storedAttachments(message.attachments)[Number(index)];
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await readFile(attachment.storagePath);
  } catch {
    console.error(`[storage] chat attachment missing on disk: ${attachment.storagePath}`);
    return NextResponse.json({ error: "The file is missing from storage." }, { status: 404 });
  }

  const inline = INLINE.has(attachment.mimeType) && new URL(request.url).searchParams.get("download") !== "1";
  const ascii = attachment.name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": inline ? attachment.mimeType : "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    },
  });
}
