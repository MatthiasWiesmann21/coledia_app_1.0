import { NextResponse } from "next/server";
import { requireRoomAccess } from "@/lib/chat/access";
import { publish } from "@/lib/chat/bus";
import { prisma } from "@coledia/db";
import { displayName } from "@/lib/chat/serialize";

/** POST /api/chat/typing — ephemeral typing indicator for a room. */
export async function POST(request: Request) {
  let body: { room?: unknown; typing?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const { ctx, room } = await requireRoomAccess(body.room);
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true },
    });
    publish(room.key, "typing", {
      room: room.key,
      userId: ctx.userId,
      name: user ? displayName(user) : "",
      typing: body.typing === true,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
