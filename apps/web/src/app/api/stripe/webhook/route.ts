import { NextResponse } from "next/server";

/**
 * Stripe webhook handler — Phase 1 implementation.
 * Handles: checkout.session.completed, customer.subscription.updated/deleted
 */
export async function POST(request: Request) {
  // TODO: Phase 1 — implement Stripe webhook handling
  // const event = stripe.webhooks.constructEvent(body, sig, secret);
  // switch (event.type) { ... }
  return NextResponse.json({ received: true });
}
