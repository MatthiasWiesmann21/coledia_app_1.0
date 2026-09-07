import { prisma } from "@coledia/db";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { getUserLocale } from "@/i18n/get-locale";
import { hasFeature } from "@/lib/plan";
import { MyCertificates } from "@/components/certificates/my-certificates";
import { Lock } from "lucide-react";
import Link from "next/link";

export default async function MyCertificatesPage() {
  const session = await requireSession();
  const t = await getTranslations("certificates");
  const locale = await getUserLocale();

  if (!(await hasFeature("quizzesCertificates"))) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("lockedHint")}</p>
        <Link href="/upgrade?feature=quizzesCertificates" className="text-sm text-(--tenant-primary) hover:underline">
          {t("lockedCta")}
        </Link>
      </div>
    );
  }

  const certificates = await prisma.certificate.findMany({
    where: { userId: session.user.id, course: { tenantId: getTenantId() } },
    include: {
      course: {
        select: {
          title: true,
          category: { select: { name: true, color: true } },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{t("myCertificates")}</h1>
      <MyCertificates
        locale={locale}
        items={certificates.map((c) => ({
          id: c.id,
          issuedAt: c.issuedAt.toISOString(),
          certificateUrl: c.certificateUrl,
          courseTitle: c.course.title,
          categoryName: c.course.category?.name ?? null,
          categoryColor: c.course.category?.color ?? null,
        }))}
      />
    </div>
  );
}
