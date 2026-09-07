import { prisma, PrismaClient } from "./index";

/**
 * Tenant-scoped Prisma client extension.
 *
 * Every tenant-scoped model is auto-filtered by tenantId on reads,
 * and tenantId is required on creates. This is the PRIMARY isolation
 * control — MySQL has no native RLS, so this extension + restricted
 * views + least-privilege DB role form the defense-in-depth strategy.
 *
 * Usage:
 *   const db = tenantScoped(tenantId);
 *   await db.course.findMany();          // auto-filtered by tenantId
 *   await db.course.create({ data: { title: "..." } }); // tenantId auto-injected
 */

// Models where tenantId is a direct field (not via a relation)
const DIRECT_TENANT_MODELS = [
  "branding",
  "membership",
  "userGroup",
  "category",
  "course",
  "post",
  "comment",
  "like",
  "favourite",
  "event",
  "eventRegistration",
  "folder",
  "document",
  "chatServer",
  "notification",
  "subscription",
  "payment",
  "auditLog",
  "apiKey",
  "webhook",
  "certificateTemplate",
  "customPage",
] as const;

/**
 * Build the query extension object for all tenant-scoped models.
 * Each model gets findMany/findFirst/count/create/update/delete/etc.
 * auto-injecting tenantId into where clauses and create data.
 */
function buildTenantQueryExtension(tenantId: string) {
  const extension: Record<string, Record<string, (args: any) => any>> = {};

  for (const model of DIRECT_TENANT_MODELS) {
    extension[model] = {
      findMany(args: any) {
        args.where = { ...args.where, tenantId };
        return args;
      },
      findFirst(args: any) {
        args.where = { ...args.where, tenantId };
        return args;
      },
      count(args: any) {
        args.where = { ...args.where, tenantId };
        return args;
      },
      create(args: any) {
        args.data = { ...args.data, tenantId };
        return args;
      },
      createMany(args: any) {
        if (Array.isArray(args.data)) {
          args.data = args.data.map((d: any) => ({ ...d, tenantId }));
        } else {
          args.data = { ...args.data, tenantId };
        }
        return args;
      },
      update(args: any) {
        args.where = { ...args.where, tenantId };
        return args;
      },
      updateMany(args: any) {
        args.where = { ...args.where, tenantId };
        return args;
      },
      upsert(args: any) {
        args.where = { ...args.where, tenantId };
        args.create = { ...args.create, tenantId };
        return args;
      },
      delete(args: any) {
        args.where = { ...args.where, tenantId };
        return args;
      },
      deleteMany(args: any) {
        args.where = { ...args.where, tenantId };
        return args;
      },
    };
  }

  return extension;
}

export function tenantScoped(tenantId: string) {
  return prisma.$extends({
    name: "tenantScoped",
    query: buildTenantQueryExtension(tenantId) as any,
  });
}

export { prisma };
