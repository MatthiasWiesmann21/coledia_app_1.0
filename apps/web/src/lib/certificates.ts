import { prisma } from "@coledia/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getTenantId } from "./tenant";
import { readFile, resolveStoragePath, storagePathToUrl } from "./storage";
import { notify } from "./notifications";
import { tenantHasFeature } from "./plan";
import fs from "fs/promises";
import path from "path";

/**
 * Certificate issuance + PDF rendering.
 *
 * Templates are tenant-managed (CertificateTemplate). Placeholders in
 * bodyText: {{name}}, {{course}}, {{date}}. PDFs are stored under
 * uploads/{tenantId}/certificates/ and served via /api/uploads/.
 */

// pdf-lib standard fonts are WinAnsi-encoded — strip unsupported characters
function sanitizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x00-\xFF]/g, "?");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const num = parseInt(
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean,
    16,
  );
  return {
    r: ((num >> 16) & 0xff) / 255,
    g: ((num >> 8) & 0xff) / 255,
    b: (num & 0xff) / 255,
  };
}

async function loadImageBytes(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  const prefix = "/api/uploads/";
  if (!url.startsWith(prefix)) return null;
  try {
    return await readFile(url.slice(prefix.length));
  } catch {
    return null;
  }
}

async function embedImage(pdfDoc: PDFDocument, buffer: Buffer) {
  // Try PNG, then JPG
  try {
    return await pdfDoc.embedPng(buffer);
  } catch {
    try {
      return await pdfDoc.embedJpg(buffer);
    } catch {
      return null;
    }
  }
}

function applyPlaceholders(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

/** Draw text centered horizontally. */
function drawCentered(
  page: import("pdf-lib").PDFPage,
  text: string,
  y: number,
  font: import("pdf-lib").PDFFont,
  size: number,
  color: { r: number; g: number; b: number },
  pageWidth: number,
) {
  const safe = sanitizeText(text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: Math.max(40, (pageWidth - width) / 2),
    y,
    size,
    font,
    color: rgb(color.r, color.g, color.b),
  });
}

export async function generateCertificatePdf(opts: {
  userName: string;
  courseTitle: string;
  tenantId: string;
  template: {
    title: string;
    subtitle: string | null;
    bodyText: string | null;
    primaryColor: string;
    backgroundImageUrl: string | null;
    logoUrl: string | null;
    signatureName: string | null;
    signatureImageUrl: string | null;
  } | null;
}): Promise<Uint8Array> {
  const { userName, courseTitle, template } = opts;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const primary = hexToRgb(template?.primaryColor ?? "#0c2340");
  const muted = { r: 0.35, g: 0.38, b: 0.42 };
  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Background
  const bgBytes = await loadImageBytes(template?.backgroundImageUrl ?? null);
  if (bgBytes) {
    const bg = await embedImage(pdfDoc, bgBytes);
    if (bg) page.drawImage(bg, { x: 0, y: 0, width, height });
  } else {
    // Simple framed card look
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: rgb(primary.r, primary.g, primary.b),
      borderWidth: 3,
    });
  }

  let y = height - 100;

  // Logo
  const logoBytes = await loadImageBytes(template?.logoUrl ?? null);
  if (logoBytes) {
    const logo = await embedImage(pdfDoc, logoBytes);
    if (logo) {
      const scale = 64 / logo.height;
      const w = logo.width * scale;
      page.drawImage(logo, { x: (width - w) / 2, y, width: w, height: 64 });
      y -= 50;
    }
  }

  // Title + subtitle
  drawCentered(page, template?.title ?? "Certificate of Completion", y, fontBold, 30, primary, width);
  y -= 34;
  if (template?.subtitle) {
    drawCentered(page, template.subtitle, y, fontItalic, 14, muted, width);
    y -= 30;
  } else {
    y -= 16;
  }

  // Recipient name
  drawCentered(page, userName, y, fontBold, 26, { r: 0.08, g: 0.1, b: 0.16 }, width);
  y -= 40;

  // Body text
  const body = applyPlaceholders(
    template?.bodyText ?? "has successfully completed the course {{course}} on {{date}}.",
    { name: userName, course: courseTitle, date: dateStr },
  );
  drawCentered(page, body, y, font, 13, muted, width);
  y -= 34;

  // Course title
  drawCentered(page, courseTitle, y, fontBold, 18, primary, width);
  y -= 26;

  // Date
  drawCentered(page, dateStr, y, font, 12, muted, width);

  // Signature
  const sigBytes = await loadImageBytes(template?.signatureImageUrl ?? null);
  if (sigBytes) {
    const sig = await embedImage(pdfDoc, sigBytes);
    if (sig) {
      const scale = 48 / sig.height;
      const w = sig.width * scale;
      page.drawImage(sig, { x: width - 220, y: 70, width: w, height: 48 });
    }
  }
  if (template?.signatureName) {
    page.drawLine({
      start: { x: width - 280, y: 62 },
      end: { x: width - 100, y: 62 },
      thickness: 1,
      color: rgb(muted.r, muted.g, muted.b),
    });
    page.drawText(sanitizeText(template.signatureName), {
      x: width - 270,
      y: 48,
      size: 11,
      font: fontItalic,
      color: rgb(muted.r, muted.g, muted.b),
    });
  }

  return pdfDoc.save();
}

/**
 * Issue a certificate for a course to a user.
 * Idempotent — does nothing if the certificate already exists.
 */
export async function issueCertificateForCourse(
  userId: string,
  courseId: string,
): Promise<{ issued: boolean }> {
  try {
    const tenantId = getTenantId();

    const existing = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return { issued: false };

    const [user, course] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.course.findFirst({
        where: { id: courseId, tenantId },
        include: { certificateTemplate: true },
      }),
    ]);
    if (!user || !course) return { issued: false };

    // Resolve template: course override → tenant default → built-in
    const template =
      course.certificateTemplate ??
      (await prisma.certificateTemplate.findFirst({
        where: { tenantId, isDefault: true },
      }));

    const certificate = await prisma.certificate.create({
      data: { userId, courseId },
    });

    const pdf = await generateCertificatePdf({
      userName: user.name ?? user.email,
      courseTitle: course.title,
      tenantId,
      template,
    });

    const dir = resolveStoragePath(`${tenantId}/certificates`);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${certificate.id}.pdf`;
    await fs.writeFile(path.join(dir, filename), pdf);

    const url = storagePathToUrl(`${tenantId}/certificates/${filename}`);
    await prisma.certificate.update({
      where: { id: certificate.id },
      data: { certificateUrl: url },
    });

    void notify({
      tenantId,
      type: "certificate_issued",
      title: `Certificate issued: ${course.title}`,
      body: "Congratulations! Your certificate is ready to download.",
      link: "/certificates",
      userIds: [userId],
    });

    return { issued: true };
  } catch (err) {
    console.error("[certificates] issuance failed:", err);
    return { issued: false };
  }
}

/**
 * Issue the course certificate only when the user has completed every
 * published chapter AND passed every quiz of the course (published chapters).
 * Certificates are a plan feature (quizzesCertificates).
 */
export async function maybeIssueCertificate(
  userId: string,
  courseId: string,
): Promise<{ issued: boolean }> {
  const tenantId = getTenantId();
  if (!(await tenantHasFeature(tenantId, "quizzesCertificates"))) return { issued: false };

  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
    select: { id: true },
  });
  if (!course) return { issued: false };

  const [totalChapters, completedChapters, quizzes] = await Promise.all([
    prisma.chapter.count({ where: { courseId, published: true } }),
    prisma.chapterProgress.count({
      where: { userId, completed: true, chapter: { courseId, published: true } },
    }),
    prisma.quiz.findMany({
      where: { chapter: { courseId, published: true } },
      select: { attempts: { where: { userId, passed: true }, select: { id: true }, take: 1 } },
    }),
  ]);

  if (totalChapters === 0 || completedChapters < totalChapters) return { issued: false };
  if (quizzes.some((q) => q.attempts.length === 0)) return { issued: false };

  return issueCertificateForCourse(userId, courseId);
}

/** Default placeholder template hints shown in the admin editor. */
export const CERTIFICATE_PLACEHOLDERS = ["{{name}}", "{{course}}", "{{date}}"];
