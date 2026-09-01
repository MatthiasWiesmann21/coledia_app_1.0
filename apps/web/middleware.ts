import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantFromHost } from "@/lib/tenant";

// Routes that should NOT be tenant-resolved (marketing + API webhooks)
const PUBLIC_ROUTES = ["/api/stripe/webhook", "/api/tls/ask", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // Skip middleware for webhook/auth callback routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const tenant = resolveTenantFromHost(host);

  if (tenant) {
    // Attach tenant info as headers for server components to read
    const response = NextResponse.next();
    response.headers.set("x-tenant-type", tenant.type);
    response.headers.set("x-tenant-identifier", tenant.identifier);
    return response;
  }

  // Marketing site or unknown host — continue without tenant
  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
