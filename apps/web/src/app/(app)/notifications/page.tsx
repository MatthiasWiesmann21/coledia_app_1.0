import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getUserLocale } from "@/i18n/get-locale";
import { getMyNotifications } from "@/lib/notification-actions";
import { NotificationList } from "@/components/notifications/notification-list";

export default async function NotificationsPage() {
  await requireSession();
  const t = await getTranslations("notifications");
  const locale = await getUserLocale();
  const items = await getMyNotifications(100);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>
      <NotificationList initialItems={items} locale={locale} />
    </div>
  );
}
