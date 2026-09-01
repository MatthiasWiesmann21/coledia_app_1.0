import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@coledia/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    // In development, skip email verification so signup works without a mail server
    requireEmailVerification: process.env.NODE_ENV === "production",
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
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
