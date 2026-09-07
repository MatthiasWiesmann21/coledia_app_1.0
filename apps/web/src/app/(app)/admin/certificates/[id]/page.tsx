import { prisma } from "@coledia/db";
import { requireAdmin } from "@/lib/admin-guard";
import { requireFeature } from "@/lib/plan";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CertificateTemplateEditor } from "@/components/admin/certificate-template-editor";

export default async function CertificateTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireAdmin();
  await requireFeature("quizzesCertificates");
  const t = await getTranslations("certificates");

  const [template, courses] = await Promise.all([
    id === "new"
      ? null
      : prisma.certificateTemplate.findFirst({
          where: { id, tenantId },
          include: { courses: { select: { id: true } } },
        }),
    prisma.course.findMany({
      where: { tenantId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  if (id !== "new" && !template) notFound();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">
        {template ? `${t("editTemplate")}: ${template.name}` : t("newTemplate")}
      </h1>
      <CertificateTemplateEditor
        template={
          template
            ? {
                id: template.id,
                name: template.name,
                title: template.title,
                subtitle: template.subtitle,
                bodyText: template.bodyText,
                primaryColor: template.primaryColor,
                backgroundImageUrl: template.backgroundImageUrl,
                logoUrl: template.logoUrl,
                signatureName: template.signatureName,
                signatureImageUrl: template.signatureImageUrl,
                isDefault: template.isDefault,
              }
            : null
        }
        courses={courses}
        assignedCourseIds={template?.courses.map((c) => c.id) ?? []}
      />
      <Link
        href="/admin/certificates"
        className="mt-6 inline-block text-sm text-(--tenant-primary) hover:underline"
      >
        ← {t("backToTemplates")}
      </Link>
    </div>
  );
}
