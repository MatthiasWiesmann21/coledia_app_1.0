import { prisma } from "@coledia/db";
import { NOTIFICATION_CHANNELS, type NotificationType } from "@coledia/shared";
import { sendEmail } from "./email";

/**
 * Notification service — create in-app notifications (honoring user
 * preferences), optionally queue an email, and push a realtime event.
 *
 * Preference semantics:
 * - in_app: default ON (absence of a pref row = enabled), a disabled row
 *   suppresses the notification entirely.
 * - email: default OFF (opt-in), an enabled row triggers sendEmail() (stub).
 */

export interface NotifyInput {
  tenantId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Explicit recipient user ids. */
  userIds?: string[];
  /** Notify all members of these user groups. */
  userGroupIds?: string[];
  /** Notify all members of the tenant. */
  allMembers?: boolean;
  /** Notify only owner/admin/operator memberships. */
  adminsOnly?: boolean;
  /** Users to exclude (e.g. the actor who triggered the event). */
  excludeUserIds?: string[];
}

async function resolveRecipients(input: NotifyInput): Promise<string[]> {
  const ids = new Set<string>(input.userIds ?? []);

  if (input.userGroupIds?.length) {
    const members = await prisma.userGroupMember.findMany({
      where: { userGroupId: { in: input.userGroupIds } },
      select: { userId: true },
    });
    for (const m of members) ids.add(m.userId);
  }

  if (input.allMembers || input.adminsOnly) {
    const memberships = await prisma.membership.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.adminsOnly
          ? { role: { in: ["owner", "admin", "operator"] } }
          : {}),
      },
      select: { userId: true },
    });
    for (const m of memberships) ids.add(m.userId);
  }

  for (const excluded of input.excludeUserIds ?? []) ids.delete(excluded);
  return [...ids];
}

/** Push a realtime event to connected users via the realtime service. */
async function pushRealtime(tenantId: string, userIds: string[]) {
  const url = process.env.REALTIME_INTERNAL_URL ?? "http://localhost:3001";
  const secret = process.env.REALTIME_INTERNAL_SECRET;
  if (!secret || userIds.length === 0) return;

  try {
    await fetch(`${url}/emit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ tenantId, userIds, event: "notification:new" }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Realtime service down — the bell refetches on focus/open, so users recover.
  }
}

/**
 * Create notifications for the resolved recipients.
 * Never throws — notification delivery must not break the triggering action.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const recipients = await resolveRecipients(input);
    if (recipients.length === 0) return;

    // Load preference rows for these users + this type
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: recipients }, type: input.type },
      select: { userId: true, channel: true, enabled: true },
    });

    const inAppDisabled = new Set(
      prefs
        .filter((p) => p.channel === NOTIFICATION_CHANNELS.IN_APP && !p.enabled)
        .map((p) => p.userId),
    );
    const emailEnabled = new Set(
      prefs
        .filter((p) => p.channel === NOTIFICATION_CHANNELS.EMAIL && p.enabled)
        .map((p) => p.userId),
    );

    const inAppRecipients = recipients.filter((id) => !inAppDisabled.has(id));

    if (inAppRecipients.length > 0) {
      await prisma.notification.createMany({
        data: inAppRecipients.map((userId) => ({
          userId,
          tenantId: input.tenantId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
        })),
      });
      void pushRealtime(input.tenantId, inAppRecipients);
    }

    const emailRecipients = recipients.filter((id) => emailEnabled.has(id));
    if (emailRecipients.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: emailRecipients } },
        select: { email: true },
      });
      for (const user of users) {
        void sendEmail({
          to: user.email,
          subject: input.title,
          html: `<p>${input.body ?? input.title}</p>${
            input.link ? `<p><a href="${input.link}">Open</a></p>` : ""
          }`,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[notifications] notify failed:", err);
  }
}
