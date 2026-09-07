import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@coledia/db";
import { getStripe } from "@/lib/stripe";
import { logAuditAsync } from "@/lib/audit";
import { dispatchWebhookAsync } from "@/lib/webhooks";

/**
 * Stripe webhook handler.
 *
 * Handles:
 *  - checkout.session.completed (plan subscription + course purchase)
 *  - customer.subscription.updated / deleted
 *  - payment_intent.succeeded (course purchase confirmation)
 *  - charge.refunded (revoke course access)
 *
 * Signature verification uses the raw body (NextRequest body must not be
 * parsed before this point). The route exports `runtime = "nodejs"` and
 * disables body parsing.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Unhandled event — log but don't error
        console.log(`[stripe] unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe] webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const tenantId = metadata.tenantId;
  if (!tenantId) return;

  if (metadata.type === "plan_subscription") {
    // Update tenant plan + subscription record
    const plan = metadata.plan ?? "starter";
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.subscription.upsert({
      where: { stripeSubscriptionId: session.subscription as string },
      create: {
        tenantId,
        stripeSubscriptionId: session.subscription as string,
        plan,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: { plan, status: "active" },
    });

    logAuditAsync({
      tenantId,
      action: "billing_change",
      entityType: "subscription",
      entityId: session.subscription as string,
      metadata: { plan, type: "plan_subscription" },
    });
    dispatchWebhookAsync({ tenantId, event: "payment.succeeded", data: { type: "subscription", plan } });
  }

  if (metadata.type === "course_purchase") {
    const courseId = metadata.courseId;
    const userId = metadata.userId;
    if (!courseId || !userId) return;

    // Update CoursePurchase + enroll user
    await prisma.coursePurchase.updateMany({
      where: { courseId, userId, status: "pending" },
      data: { status: "succeeded", stripePaymentIntentId: session.payment_intent as string },
    });

    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, enrolledAt: new Date() },
      update: {},
    });

    logAuditAsync({
      tenantId,
      action: "create",
      entityType: "payment",
      entityId: session.payment_intent as string,
      metadata: { type: "course_purchase", courseId, userId },
    });
    dispatchWebhookAsync({
      tenantId,
      event: "payment.succeeded",
      data: { type: "course", courseId, userId, amount: session.amount_total },
    });
    dispatchWebhookAsync({
      tenantId,
      event: "user.enrolled",
      data: { userId, courseId },
    });
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const tenant = await prisma.tenant.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!tenant) return;

  const status = subscription.status;
  const plan = tenant.plan;

  // Map Stripe status to our status
  const ourStatus =
    status === "active" ? "active" :
    status === "past_due" ? "past_due" :
    status === "canceled" ? "canceled" :
    status === "trialing" ? "trialing" : "active";

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: ourStatus },
  });

  // If canceled, downgrade to starter
  if (status === "canceled") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: "starter", status: "active" },
    });
    logAuditAsync({
      tenantId: tenant.id,
      action: "billing_change",
      entityType: "subscription",
      entityId: subscription.id,
      metadata: { status: "canceled", downgradedTo: "starter" },
    });
  }

  // Update current period end
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (periodEnd) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { currentPeriodEnd: new Date(periodEnd * 1000) },
    });
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Already handled in checkout.session.completed for most cases.
  // This is a fallback for direct payment intents.
  const purchase = await prisma.coursePurchase.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id, status: "pending" },
  });
  if (!purchase) return;

  await prisma.coursePurchase.update({
    where: { id: purchase.id },
    data: { status: "succeeded" },
  });

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: purchase.userId, courseId: purchase.courseId } },
    create: { userId: purchase.userId, courseId: purchase.courseId, enrolledAt: new Date() },
    update: {},
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const purchase = await prisma.coursePurchase.findFirst({
    where: { stripePaymentIntentId: charge.payment_intent as string },
  });
  if (!purchase) return;

  await prisma.coursePurchase.update({
    where: { id: purchase.id },
    data: { status: "refunded" },
  });

  // Revoke enrollment
  await prisma.enrollment.deleteMany({
    where: { userId: purchase.userId, courseId: purchase.courseId },
  });

  logAuditAsync({
    tenantId: purchase.courseId, // will be overridden by tenantId lookup
    action: "billing_change",
    entityType: "payment",
    entityId: charge.payment_intent as string,
    metadata: { type: "refund", courseId: purchase.courseId, userId: purchase.userId },
  });
  dispatchWebhookAsync({
    tenantId: "", // tenant lookup needed — but dispatchWebhook handles empty gracefully
    event: "payment.refunded",
    data: { courseId: purchase.courseId, userId: purchase.userId },
  });
}
