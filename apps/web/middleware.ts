import { NextResponse, type NextRequest } from "next/server";

// Routes that are public (no auth required)
const PUBLIC_ROUTES = [
  "/api/auth",
  "/api/stripe/webhook",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // TODO: Check Better-Auth session cookie here.
  // For now, allow all routes — auth will be enforced in Phase 1.
  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets and API webhooks
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
