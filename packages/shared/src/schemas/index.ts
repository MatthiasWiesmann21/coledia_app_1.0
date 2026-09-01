import { z } from "zod";

// ─── Tenant ──────────────────────────────────────────────────────
export const tenantSubdomainSchema = z
  .string()
  .min(3, "Subdomain must be at least 3 characters")
  .max(63, "Subdomain must be at most 63 characters")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Only lowercase letters, numbers and hyphens");

export const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  subdomain: tenantSubdomainSchema,
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

// ─── Branding ────────────────────────────────────────────────────
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #008080)")
  .nullable()
  .optional();

const optionalUrl = z.string().url().nullable().optional();

export const brandingSchema = z.object({
  // Container settings
  logoLightUrl: optionalUrl,
  logoDarkUrl: optionalUrl,
  logoClickUrl: optionalUrl,
  faviconUrl: optionalUrl,

  // Design — theme / button
  primaryColorLight: hexColor,
  primaryColorDark: hexColor,

  // Design — navigation
  navTextColorLight: hexColor,
  navTextColorDark: hexColor,
  navBgColorLight: hexColor,
  navBgColorDark: hexColor,

  // Design — auth page logos
  authLogoSignUpLight: optionalUrl,
  authLogoSignUpDark: optionalUrl,
  authLogoSignInLight: optionalUrl,
  authLogoSignInDark: optionalUrl,
  authLogoForgotLight: optionalUrl,
  authLogoForgotDark: optionalUrl,
});

export type Branding = z.infer<typeof brandingSchema>;

// ─── Category ────────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  isCourse: z.boolean().default(false),
  isNews: z.boolean().default(false),
  isEvent: z.boolean().default(false),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#008080"),
  textColorLight: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0c2340"),
  textColorDark: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f4f6f8"),
  published: z.boolean().default(false),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// ─── UserGroup ───────────────────────────────────────────────────
export const createUserGroupSchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateUserGroupInput = z.infer<typeof createUserGroupSchema>;

// ─── Membership ──────────────────────────────────────────────────
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "operator", "member"]).default("member"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
