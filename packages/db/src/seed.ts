import { prisma } from "./index.js";

/**
 * Seed script — creates a dev tenant + branding + admin user.
 *
 * Run with: pnpm db:seed
 *
 * The seed creates:
 * - 1 Tenant (subdomain: "demo", plan: "organization")
 * - 1 Branding record (default Coledia brand colors)
 * - 1 User (admin@coledia.dev / password set via Better-Auth in the app)
 * - 1 Membership (owner role)
 * - 3 Categories (Course, News, Event — all published)
 * - 1 UserGroup ("All Members")
 * - 1 ChatServer ("General")
 * - 1 Channel ("general" text channel)
 *
 * The script is idempotent — it skips records that already exist.
 * The TENANT_ID env var is set to the created tenant's ID for easy copy-paste.
 */

async function main() {
  const tenantId = "demo-tenant-001";
  const adminEmail = "admin@coledia.dev";

  console.log("🌱 Seeding Coledia database...\n");

  // ─── Tenant ──────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      subdomain: "demo",
      name: "Demo Club",
      status: "active",
      plan: "organization",
    },
  });
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── Branding ────────────────────────────────────────────────
  const branding = await prisma.branding.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      primaryColorLight: "#008080",
      primaryColorDark: "#2aa99b",
      navTextColorLight: "#0c2340",
      navTextColorDark: "#f4f6f8",
      navBgColorLight: "#ffffff",
      navBgColorDark: "#0e2542",
    },
  });
  console.log(`✓ Branding: ${branding.id}`);

  // ─── User ────────────────────────────────────────────────────
  // Note: the actual user + password hash is created via Better-Auth
  // in the app's sign-up flow. Here we just create the User record
  // directly for dev purposes. The password hash is a placeholder —
  // use the sign-up page to create a real account.
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  let user;
  if (existingUser) {
    user = existingUser;
    console.log(`✓ User already exists: ${user.email}`);
  } else {
    user = await prisma.user.create({
      data: {
        id: "demo-user-001",
        email: adminEmail,
        emailVerified: true,
        name: "Admin User",
      },
    });
    console.log(`✓ User: ${user.email} (sign up via the app to set a password)`);
  }

  // ─── User Profile ────────────────────────────────────────────
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      username: "admin",
      bio: "Demo club administrator",
      status: "online",
    },
  });
  console.log(`✓ UserProfile for ${user.email}`);

  // ─── Membership ──────────────────────────────────────────────
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: "owner",
    },
  });
  console.log(`✓ Membership: owner role`);

  // ─── Categories ──────────────────────────────────────────────
  const categories = [
    {
      id: "cat-general",
      name: "General",
      isCourse: true,
      isNews: true,
      isEvent: true,
      color: "#008080",
      published: true,
    },
    {
      id: "cat-web-dev",
      name: "Web Development",
      isCourse: true,
      isNews: true,
      isEvent: true,
      color: "#1f78b4",
      published: true,
    },
    {
      id: "cat-announcements",
      name: "Announcements",
      isCourse: false,
      isNews: true,
      isEvent: false,
      color: "#e6550d",
      published: true,
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        ...cat,
        tenantId: tenant.id,
      },
    });
  }
  console.log(`✓ Categories: ${categories.length} created`);

  // ─── UserGroup ───────────────────────────────────────────────
  const userGroup = await prisma.userGroup.upsert({
    where: { id: "ug-all-members" },
    update: {},
    create: {
      id: "ug-all-members",
      tenantId: tenant.id,
      name: "All Members",
    },
  });
  console.log(`✓ UserGroup: ${userGroup.name}`);

  // ─── Chat Server + Channel ───────────────────────────────────
  const chatServer = await prisma.chatServer.upsert({
    where: { id: "cs-general" },
    update: {},
    create: {
      id: "cs-general",
      tenantId: tenant.id,
      name: "General",
      createdById: user.id,
    },
  });

  await prisma.channel.upsert({
    where: { id: "ch-general" },
    update: {},
    create: {
      id: "ch-general",
      chatServerId: chatServer.id,
      name: "general",
      type: "text",
    },
  });

  await prisma.chatServerMember.upsert({
    where: {
      userId_chatServerId: {
        userId: user.id,
        chatServerId: chatServer.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      chatServerId: chatServer.id,
      role: "admin",
    },
  });
  console.log(`✓ ChatServer: ${chatServer.name} + #general channel`);

  // ─── Done ────────────────────────────────────────────────────
  console.log("\n✅ Seed complete!\n");
  console.log("Add this to your apps/web/.env:");
  console.log(`  TENANT_ID="${tenant.id}"`);
  console.log(`  DATABASE_URL="${process.env.DATABASE_URL}"`);
  console.log("\nThen sign up via the app at http://localhost:3000/sign-up");
  console.log(`using email: ${adminEmail} (or a new email)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
