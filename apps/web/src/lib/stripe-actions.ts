"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import {
  createPlanCheckoutSession,
  createCourseCheckoutSession,
  createConnectOnboardingLink,
  createBillingPortalSession,
  getConnectAccountStatus,
} from "./stripe";
import { logAuditAsync } from "./audit";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const tenantId = getTenantId();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!membership || membership.role !== "owner") {
    throw new Error("Only owners can manage billing");
  }
  return { session, tenantId };
}

/** Start a plan subscription checkout (upgrade/downgrade). */
export async function startPlanCheckout(plan: string) {
  const { tenantId } = await requireOwner();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await createPlanCheckoutSession({
    tenantId,
    plan,
    successUrl: `${appUrl}/billing?success=1`,
    cancelUrl: `${appUrl}/billing?canceled=1`,
  });
  if (!session.url) throw new Error("Failed to create checkout session");
  return { url: session.url };
}

/** Start a course purchase checkout (member-facing). */
export async function startCoursePurchase(courseId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const tenantId = getTenantId();

  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
    select: { id: true, title: true, price: true },
  });
  if (!course) throw new Error("Course not found");
  if (!course.price || Number(course.price) <= 0) {
    throw new Error("This course is free — no purchase needed");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const checkoutSession = await createCourseCheckoutSession({
    tenantId,
    courseId: course.id,
    userId: session.user.id,
    courseTitle: course.title,
    amount: Number(course.price),
    successUrl: `${appUrl}/courses/${course.id}?purchased=1`,
    cancelUrl: `${appUrl}/courses/${course.id}?canceled=1`,
  });

  if (!checkoutSession.url) throw new Error("Failed to create checkout session");

  // Create pending CoursePurchase record
  await prisma.coursePurchase.create({
    data: {
      userId: session.user.id,
      courseId: course.id,
      stripePaymentIntentId: checkoutSession.payment_intent as string,
      amount: course.price,
      status: "pending",
    },
  }).catch(() => {
    // unique constraint — may already exist from a previous attempt
  });

  return { url: checkoutSession.url };
}

/** Start Stripe Connect Express onboarding (owner only). */
export async function startConnectOnboarding() {
  const { tenantId } = await requireOwner();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { url } = await createConnectOnboardingLink({
    tenantId,
    returnUrl: `${appUrl}/billing?connect=1`,
  });
  logAuditAsync({ action: "billing_change", entityType: "settings", entityId: tenantId, metadata: { connectOnboarding: true } });
  if (!url) throw new Error("Failed to create onboarding link");
  return { url };
}

/** Open the Stripe billing portal (manage subscription). */
export async function openBillingPortal() {
  const { tenantId } = await requireOwner();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await createBillingPortalSession({
    tenantId,
    returnUrl: `${appUrl}/billing`,
  });
  if (!session.url) throw new Error("Failed to create billing portal session");
  return { url: session.url };
}

/** Get the current Connect account status for the billing UI. */
export async function getConnectStatus() {
  const { tenantId } = await requireOwner();
  return getConnectAccountStatus(tenantId);
}
