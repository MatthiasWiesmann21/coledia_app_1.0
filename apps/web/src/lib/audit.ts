import { prisma, Prisma } from "@coledia/db";
import { getTenantId } from "./tenant";
import { getSession } from "./session";

/**
 * Audit log helpers — write tenant-scoped AuditLog records for significant
 * mutations. Always fire-and-forget (void) so a logging failure never
 * breaks the user-facing operation.
 */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "invite"
  | "role_change"
  | "settings_change"
  | "publish"
  | "unpublish"
  | "billing_change"
  | "api_key_create"
  | "api_key_revoke"
  | "webhook_create"
  | "webhook_update"
  | "webhook_delete"
  | "certificate_issue"
  | "login"
  | "logout";

export type AuditEntityType =
  | "course"
  | "chapter"
  | "quiz"
  | "post"
  | "event"
  | "document"
  | "folder"
  | "user"
  | "user_group"
  | "settings"
  | "subscription"
  | "payment"
  | "api_key"
  | "webhook"
  | "certificate"
  | "custom_page"
  | "notification";

/** Write an audit log entry for the current tenant + session user. */
export async function logAudit(opts: {
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  /** Override tenant/user when running outside a request (e.g. webhooks). */
  tenantId?: string;
  userId?: string;
}): Promise<void> {
  try {
    const tenantId = opts.tenantId ?? getTenantId();
    let userId = opts.userId;
    if (!userId) {
      try {
        const session = await getSession();
        userId = session?.user?.id;
      } catch {
        // no session available (e.g. webhook handler) — leave null
      }
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        metadata: (opts.metadata as Prisma.JsonValue) ?? undefined,
      },
    });
  } catch (err) {
    // Audit logging must never break the calling operation.
    console.error("[audit] failed to write log:", err);
  }
}

/** Fire-and-forget wrapper for use in server actions where we don't want
 *  to await the audit write. */
export function logAuditAsync(opts: Parameters<typeof logAudit>[0]): void {
  void logAudit(opts);
}
