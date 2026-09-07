import Stripe from "stripe";
import { prisma } from "@coledia/db";

/**
 * Stripe integration helpers.
 *
 * - Tenant plan subscriptions (platform → tenant)
 * - Course sales via Stripe Connect Express (tenant owner receives payment)
 * - Webhook signature verification against the raw body
 *
 * Env vars:
 *  STRIPE_SECRET_KEY        — platform secret key
 *  STRIPE_WEBHOOK_SECRET    — webhook signing secret
 *  PLATFORM_FEE_PERCENT     — platform fee on course sales (default 5)
 *  NEXT_PUBLIC_APP_URL      — base URL for success/cancel redirects
 */

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
}

export function getPlatformFeePercent(): number {
  return parseFloat(process.env.PLATFORM_FEE_PERCENT ?? "5");
}

/** Price IDs for each plan (set in Stripe dashboard, configured via env). */
export function getPlanPriceId(plan: string): string | null {
  switch (plan) {
    case "club":
      return process.env.STRIPE_PRICE_CLUB ?? null;
    case "organization":
      return process.env.STRIPE_PRICE_ORGANIZATION ?? null;
    default:
      return null;
  }
}

/** Create a Checkout session for a tenant plan subscription. */
export async function createPlanCheckoutSession(opts: {
  tenantId: string;
  plan: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const priceId = getPlanPriceId(opts.plan);
  if (!priceId) throw new Error(`No Stripe price configured for plan: ${opts.plan}`);

  const tenant = await prisma.tenant.findUnique({
    where: { id: opts.tenantId },
    select: { stripeCustomerId: true, name: true },
  });

  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: tenant?.stripeCustomerId ?? undefined,
    customer_email: undefined, // Stripe will prompt if no customer
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      tenantId: opts.tenantId,
      plan: opts.plan,
      type: "plan_subscription",
    },
  });
}

/** Create a Checkout session for a course purchase (Connect). */
export async function createCourseCheckoutSession(opts: {
  tenantId: string;
  courseId: string;
  userId: string;
  courseTitle: string;
  amount: number; // in CHF (major units)
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const tenant = await prisma.tenant.findUnique({
    where: { id: opts.tenantId },
    select: { stripeConnectedAccountId: true, stripeChargesEnabled: true },
  });

  if (!tenant?.stripeConnectedAccountId || !tenant.stripeChargesEnabled) {
    throw new Error("Tenant has not connected a Stripe account for course sales");
  }

  const feePercent = getPlatformFeePercent();
  const amountInCents = Math.round(opts.amount * 100);
  const applicationFee = Math.round((amountInCents * feePercent) / 100);

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "chf",
            product_data: { name: opts.courseTitle },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: tenant.stripeConnectedAccountId,
        },
      },
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: {
        tenantId: opts.tenantId,
        courseId: opts.courseId,
        userId: opts.userId,
        type: "course_purchase",
      },
    },
    { stripeAccount: tenant.stripeConnectedAccountId },
  );
}

/** Create a Stripe Connect Express onboarding link for the tenant owner. */
export async function createConnectOnboardingLink(opts: {
  tenantId: string;
  returnUrl: string;
}): Promise<{ url: string; accountId: string }> {
  const stripe = getStripe();
  const tenant = await prisma.tenant.findUnique({
    where: { id: opts.tenantId },
    select: { stripeConnectedAccountId: true },
  });

  let accountId = tenant?.stripeConnectedAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { tenantId: opts.tenantId },
    });
    accountId = account.id;
    await prisma.tenant.update({
      where: { id: opts.tenantId },
      data: { stripeConnectedAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: opts.returnUrl,
    return_url: opts.returnUrl,
    type: "account_onboarding",
  });

  return { url: accountLink.url, accountId };
}

/** Get the Stripe Connect account status (charges enabled, details submitted). */
export async function getConnectAccountStatus(tenantId: string): Promise<{
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeConnectedAccountId: true, stripeChargesEnabled: true },
  });

  if (!tenant?.stripeConnectedAccountId) {
    return { connected: false, chargesEnabled: false, detailsSubmitted: false };
  }

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(tenant.stripeConnectedAccountId);
    const chargesEnabled = account.charges_enabled;
    if (chargesEnabled !== tenant.stripeChargesEnabled) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeChargesEnabled: chargesEnabled },
      });
    }
    return {
      connected: true,
      chargesEnabled,
      detailsSubmitted: account.details_submitted,
    };
  } catch {
    return {
      connected: true,
      chargesEnabled: tenant.stripeChargesEnabled,
      detailsSubmitted: false,
    };
  }
}

/** Create a billing portal session for subscription management. */
export async function createBillingPortalSession(opts: {
  tenantId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  const tenant = await prisma.tenant.findUnique({
    where: { id: opts.tenantId },
    select: { stripeCustomerId: true },
  });
  if (!tenant?.stripeCustomerId) {
    throw new Error("No Stripe customer found for this tenant");
  }
  return stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: opts.returnUrl,
  });
}
