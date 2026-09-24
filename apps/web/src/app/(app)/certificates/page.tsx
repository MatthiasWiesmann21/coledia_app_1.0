import { prisma } from "@coledia/db";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getTenantId } from "@/lib/tenant";
import { getUserLocale } from "@/i18n/get-locale";
import { requireFeatureOrBack } from "@/lib/plan";
import { MyCertificates } from "@/components/certificates/my-certificates";

export default async function MyCertificatesPage() {
  const session = await requireSession();
  const t = await getTranslations("certificates");
  const locale = await getUserLocale();

  await requireFeatureOrBack("quizzesCertificates", "/certificates");

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
