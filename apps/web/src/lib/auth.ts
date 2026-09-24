import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@coledia/db";
import { getPlanLimits } from "@coledia/shared";
import { sendEmail } from "./email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    // Default: required in production, skipped in dev (no mail server).
    // AUTH_REQUIRE_EMAIL_VERIFICATION=true|false overrides in any environment.
    requireEmailVerification:
      process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true" ||
      (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "false" &&
        process.env.NODE_ENV === "production"),
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your Coledia password",
          html: `<p>Hi${user.name ? ` ${user.name}` : ""},</p>
<p>Click the link below to reset your password. The link expires in 1 hour.</p>
<p><a href="${url}">Reset password</a></p>
<p>If you didn't request this, you can ignore this email.</p>`,
          text: `Reset your password: ${url}`,
        });
      } catch (err) {
        console.error("[auth] Failed to send password reset email:", err);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await sendEmail({
          to: user.email,
          subject: "Verify your Coledia email address",
          html: `<p>Hi${user.name ? ` ${user.name}` : ""},</p>
<p>Welcome to Coledia! Click the link below to verify your email address.</p>
<p><a href="${url}">Verify email address</a></p>
<p>If you didn't create an account, you can ignore this email.</p>`,
          text: `Verify your email address: ${url}`,
        });
      } catch (err) {
        console.error("[auth] Failed to send verification email:", err);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      twoFactorEnabled: {
        type: "boolean",
        defaultValue: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          // Enforce the plan's member limit — block sign-up when the tenant is full
          const tenantId = process.env.TENANT_ID;
          if (!tenantId) return;

          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { plan: true },
          });
          const { memberLimit } = getPlanLimits(tenant?.plan ?? "starter");
          if (memberLimit === null) return;

          const count = await prisma.membership.count({ where: { tenantId } });
          if (count >= memberLimit) {
            throw new APIError("FORBIDDEN", {
              message: "member_limit_reached",
            });
          }
        },
        after: async (user) => {
          // Auto-create a membership for the new user in the current tenant
          const tenantId = process.env.TENANT_ID;
          if (!tenantId) return;

          await prisma.membership.upsert({
            where: {
              userId_tenantId: { userId: user.id, tenantId },
            },
            update: {},
            create: {
              userId: user.id,
              tenantId,
              role: "member",
            },
          });

          // Notify tenant admins about the new member
          const { notify } = await import("./notifications");
          void notify({
            tenantId,
            type: "member_joined",
            title: `New member: ${user.name ?? user.email}`,
            link: "/admin/users",
            adminsOnly: true,
            excludeUserIds: [user.id],
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // A user is a global identity: the same account can sign in on any
          // container. Ensure they get a membership in this tenant on sign-in,
          // so users who registered on another tenant are treated as members
          // here too (respecting the plan's member limit).
          const tenantId = process.env.TENANT_ID;
          if (!tenantId) return;

          const existing = await prisma.membership.findUnique({
            where: {
              userId_tenantId: { userId: session.userId, tenantId },
            },
            select: { id: true },
          });
          if (existing) return;

          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { plan: true },
          });
          const { memberLimit } = getPlanLimits(tenant?.plan ?? "starter");
          if (memberLimit !== null) {
            const count = await prisma.membership.count({ where: { tenantId } });
            if (count >= memberLimit) return;
          }

          await prisma.membership.create({
            data: { userId: session.userId, tenantId, role: "member" },
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
