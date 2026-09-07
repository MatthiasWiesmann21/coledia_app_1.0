import Link from "next/link";
import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { requireFeature } from "@/lib/plan";
import { getTranslations } from "next-intl/server";
import { Award, Plus } from "lucide-react";

export default async function AdminCertificatesPage() {
  const { tenantId } = await requireAdmin();
  await requireFeature("quizzesCertificates");
  const t = await getTranslations("certificates");

  const templates = await prisma.certificateTemplate.findMany({
    where: { tenantId },
    include: { _count: { select: { courses: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("templatesTitle")}</h1>
        <Link
          href="/admin/certificates/new"
          className="inline-flex items-center gap-2 rounded-lg bg-(--tenant-primary) px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("newTemplate")}
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {t("noTemplates")}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <li key={tpl.id}>
              <Link
                href={`/admin/certificates/${tpl.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: tpl.primaryColor }}
                  >
                    <Award className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tpl.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{tpl.title}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("usedByCourses", { count: tpl._count.courses })}
                  {tpl.isDefault && ` · ${t("defaultBadge")}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
