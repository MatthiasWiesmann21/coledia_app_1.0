import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Guard for the internal tenant API (`/api/internal/*`).
 *
 * Authenticates machine-to-machine calls from the Coledia Controlcenter using
 * a shared secret passed as `Authorization: Bearer <INTERNAL_API_SECRET>`.
 * Comparison is timing-safe (hashed before comparing so differing lengths
 * don't leak timing information).
 */
export function requireInternalSecret(
  req: NextRequest,
): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[internal-api] INTERNAL_API_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  const expectedDigest = createHash("sha256").update(secret).digest();
  const actualDigest = createHash("sha256").update(token).digest();

  if (token.length === 0 || !timingSafeEqual(expectedDigest, actualDigest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
