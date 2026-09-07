import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getNotificationPreferences } from "@/lib/notification-actions";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";

export default async function NotificationSettingsPage() {
  await requireSession();
  const t = await getTranslations("notifications");
  const prefs = await getNotificationPreferences();

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-bold">{t("settingsTitle")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("settingsSubtitle")}</p>
      <NotificationPreferences initialPrefs={prefs} />
    </div>
  );
}
