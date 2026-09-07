"use server";

import { prisma } from "@coledia/db";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { getTenantId } from "./tenant";
import { hasFeature } from "./plan";
import { logAuditAsync } from "./audit";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId: getTenantId() },
    },
  });

  if (!membership || !["owner", "admin", "operator"].includes(membership.role)) {
    throw new Error("Forbidden");
  }

  return { session, tenantId: getTenantId() };
}

async function requireCertFeature() {
  if (!(await hasFeature("quizzesCertificates"))) {
    throw new Error("plan_required");
  }
}

export type CertificateTemplateInput = {
  name: string;
  title: string;
  subtitle?: string | null;
  bodyText?: string | null;
  primaryColor: string;
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
  signatureName?: string | null;
  signatureImageUrl?: string | null;
  isDefault?: boolean;
};

export async function createCertificateTemplate(data: CertificateTemplateInput) {
  const { tenantId } = await requireAdmin();
  await requireCertFeature();

  const template = await prisma.certificateTemplate.create({
    data: {
      tenantId,
      name: data.name,
      title: data.title || "Certificate of Completion",
      subtitle: data.subtitle || null,
      bodyText: data.bodyText || null,
      primaryColor: data.primaryColor || "#0c2340",
      backgroundImageUrl: data.backgroundImageUrl || null,
      logoUrl: data.logoUrl || null,
      signatureName: data.signatureName || null,
      signatureImageUrl: data.signatureImageUrl || null,
      isDefault: data.isDefault ?? false,
    },
  });

  // Only one default template per tenant
  if (template.isDefault) {
    await prisma.certificateTemplate.updateMany({
      where: { tenantId, id: { not: template.id } },
      data: { isDefault: false },
    });
  }

  revalidatePath("/admin/certificates");
  logAuditAsync({ action: "create", entityType: "certificate", entityId: template.id, metadata: { name: data.name } });
  return { id: template.id };
}

export async function updateCertificateTemplate(
  id: string,
  data: Partial<CertificateTemplateInput>,
) {
  const { tenantId } = await requireAdmin();
  await requireCertFeature();

  const template = await prisma.certificateTemplate.update({
    where: { id, tenantId },
    data,
  });

  if (data.isDefault) {
    await prisma.certificateTemplate.updateMany({
      where: { tenantId, id: { not: id } },
      data: { isDefault: false },
    });
  }

  revalidatePath("/admin/certificates");
  revalidatePath(`/admin/certificates/${id}`);
  logAuditAsync({ action: "update", entityType: "certificate", entityId: template.id });
  return { id: template.id };
}

export async function deleteCertificateTemplate(id: string) {
  const { tenantId } = await requireAdmin();
  await requireCertFeature();

  // Detach courses first
  await prisma.course.updateMany({
    where: { tenantId, certificateTemplateId: id },
    data: { certificateTemplateId: null },
  });

  await prisma.certificateTemplate.delete({ where: { id, tenantId } });
  logAuditAsync({ action: "delete", entityType: "certificate", entityId: id });
  revalidatePath("/admin/certificates");
}

/** Assign a template to a set of courses (replaces previous assignments). */
export async function assignTemplateToCourses(
  templateId: string,
  courseIds: string[],
) {
  const { tenantId } = await requireAdmin();
  await requireCertFeature();

  await prisma.course.updateMany({
    where: { tenantId, certificateTemplateId: templateId },
    data: { certificateTemplateId: null },
  });
  if (courseIds.length > 0) {
    await prisma.course.updateMany({
      where: { tenantId, id: { in: courseIds } },
      data: { certificateTemplateId: templateId },
    });
  }

  revalidatePath("/admin/certificates");
}
