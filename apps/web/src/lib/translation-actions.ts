"use server";

import { prisma } from "@coledia/db";
import { getSession } from "./session";
import { getTenantId } from "./tenant";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: session.user.id,
        tenantId: getTenantId(),
      },
    },
  });

  if (
    !membership ||
    !["owner", "admin", "operator"].includes(membership.role)
  ) {
    throw new Error("Forbidden");
  }

  return { session, tenantId: getTenantId() };
}

/**
 * Get all translations for a specific entity (e.g. a course).
 * Returns a map: { field: { language: value } }
 */
export async function getTranslations(
  entityType: string,
  entityId: string,
): Promise<Record<string, Record<string, string>>> {
  const { tenantId } = await requireAdmin();

  const translations = await prisma.translation.findMany({
    where: { entityType, entityId, tenantId },
  });

  const result: Record<string, Record<string, string>> = {};
  for (const t of translations) {
    if (!result[t.field]) result[t.field] = {};
    result[t.field][t.language] = t.value;
  }
  return result;
}

/**
 * Save a single translation (upsert).
 * If value is empty, the translation is deleted.
 */
export async function saveTranslation(data: {
  entityType: string;
  entityId: string;
  field: string;
  language: string;
  value: string;
}) {
  const { tenantId } = await requireAdmin();

  if (!data.value.trim()) {
    // Delete if empty
    await prisma.translation
      .delete({
        where: {
          entityType_entityId_field_language: {
            entityType: data.entityType,
            entityId: data.entityId,
            field: data.field,
            language: data.language,
          },
        },
      })
      .catch(() => {}); // Ignore if doesn't exist
    return;
  }

  await prisma.translation.upsert({
    where: {
      entityType_entityId_field_language: {
        entityType: data.entityType,
        entityId: data.entityId,
        field: data.field,
        language: data.language,
      },
    },
    update: { value: data.value },
    create: {
      tenantId,
      entityType: data.entityType,
      entityId: data.entityId,
      field: data.field,
      language: data.language,
      value: data.value,
    },
  });
}

/**
 * Save multiple translations at once (batch upsert).
 * Each item: { field, language, value }
 */
export async function saveTranslations(data: {
  entityType: string;
  entityId: string;
  translations: { field: string; language: string; value: string }[];
}) {
  const { tenantId } = await requireAdmin();

  for (const item of data.translations) {
    if (!item.value.trim()) {
      await prisma.translation
        .delete({
          where: {
            entityType_entityId_field_language: {
              entityType: data.entityType,
              entityId: data.entityId,
              field: item.field,
              language: item.language,
            },
          },
        })
        .catch(() => {});
      continue;
    }

    await prisma.translation.upsert({
      where: {
        entityType_entityId_field_language: {
          entityType: data.entityType,
          entityId: data.entityId,
          field: item.field,
          language: item.language,
        },
      },
      update: { value: item.value },
      create: {
        tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        field: item.field,
        language: item.language,
        value: item.value,
      },
    });
  }
}

/**
 * Get translated content for user-facing pages.
 * Returns the best available translation for the user's preferred language,
 * falling back to the default field value from the entity.
 *
 * Returns: { field: translatedValue }
 */
export async function getTranslatedFields(
  entityType: string,
  entityId: string,
  fields: string[],
  language: string,
  fallbackValues: Record<string, string | null>,
): Promise<Record<string, string | null>> {
  const tenantId = getTenantId();

  const translations = await prisma.translation.findMany({
    where: { entityType, entityId, tenantId, field: { in: fields } },
  });

  const result: Record<string, string | null> = {};
  for (const field of fields) {
    const fieldTranslations = translations.filter((t) => t.field === field);
    const inLang = fieldTranslations.find((t) => t.language === language);
    if (inLang) {
      result[field] = inLang.value;
    } else {
      // Fall back to default language (en), then to the entity's stored value
      const inDefault = fieldTranslations.find((t) => t.language === "en");
      result[field] = inDefault?.value ?? fallbackValues[field] ?? null;
    }
  }
  return result;
}
