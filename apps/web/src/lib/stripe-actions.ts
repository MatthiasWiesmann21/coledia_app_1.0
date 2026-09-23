"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import {
  createCourseCheckoutSession,
  createConnectOnboardingLink,
  getConnectAccountStatus,
} from "./stripe";
import { tenantHasFeature } from "./plan";
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

/** Start a course purchase checkout (member-facing). */
export async function startCoursePurchase(courseId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const tenantId = getTenantId();

  if (!(await tenantHasFeature(tenantId, "sellCourses"))) {
    throw new Error("Course sales require the Club plan or higher");
  }

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

/** Start Stripe Connect Express onboarding (owner only, Club plan+). */
export async function startConnectOnboarding() {
  const { tenantId } = await requireOwner();

  if (!(await tenantHasFeature(tenantId, "sellCourses"))) {
    throw new Error("Stripe Connect requires the Club plan or higher");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { url } = await createConnectOnboardingLink({
    tenantId,
    returnUrl: `${appUrl}/billing?connect=1`,
  });
  logAuditAsync({ action: "billing_change", entityType: "settings", entityId: tenantId, metadata: { connectOnboarding: true } });
  if (!url) throw new Error("Failed to create onboarding link");
  return { url };
}

/** Get the current Connect account status for the billing UI. */
export async function getConnectStatus() {
  const { tenantId } = await requireOwner();
  return getConnectAccountStatus(tenantId);
}
