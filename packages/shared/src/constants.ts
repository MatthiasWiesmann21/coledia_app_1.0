/**
 * Coledia shared constants — plans, roles, statuses, limits, enums.
 * Used by both the web app and the realtime service.
 */

// ─── Pricing plans ───────────────────────────────────────────────
export const PLANS = {
  STARTER: "starter",
  CLUB: "club",
  ORGANIZATION: "organization",
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

export const PLAN_DETAILS: Record<Plan, {
  name: string;
  priceChf: number;
  memberLimit: number | null; // null = unlimited
  customBranding: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
}> = {
  starter: {
    name: "Starter",
    priceChf: 0,
    memberLimit: 50,
    customBranding: false,
    apiAccess: false,
    whiteLabel: false,
  },
  club: {
    name: "Club",
    priceChf: 29,
    memberLimit: 250,
    customBranding: true,
    apiAccess: false,
    whiteLabel: false,
  },
  organization: {
    name: "Organization",
    priceChf: 69,
    memberLimit: null,
    customBranding: true,
    apiAccess: true,
    whiteLabel: true,
  },
};

// ─── Roles ───────────────────────────────────────────────────────
export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  OPERATOR: "operator",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ADMIN_ROLES: Role[] = [ROLES.OWNER, ROLES.ADMIN, ROLES.OPERATOR];

// ─── Activity status ─────────────────────────────────────────────
export const ACTIVITY_STATUS = {
  ONLINE: "online",
  NOT_AVAILABLE: "not_available",
  DO_NOT_DISTURB: "do_not_disturb",
  INVISIBLE: "invisible",
} as const;

export type ActivityStatus = (typeof ACTIVITY_STATUS)[keyof typeof ACTIVITY_STATUS];

// ─── Course level ────────────────────────────────────────────────
export const COURSE_LEVELS = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
} as const;

export type CourseLevel = (typeof COURSE_LEVELS)[keyof typeof COURSE_LEVELS];

// ─── Course special status ───────────────────────────────────────
export const SPECIAL_STATUSES = {
  FEATURED: "featured",
  TRENDING: "trending",
  EXCLUSIVE: "exclusive",
} as const;

export type SpecialStatus = (typeof SPECIAL_STATUSES)[keyof typeof SPECIAL_STATUSES];

// ─── Category types (a category can be multiple) ─────────────────
export const CATEGORY_TYPES = {
  COURSE: "course",
  NEWS: "news",
  EVENT: "event",
} as const;

export type CategoryType = (typeof CATEGORY_TYPES)[keyof typeof CATEGORY_TYPES];

// ─── Video source types ──────────────────────────────────────────
export const VIDEO_TYPES = {
  YOUTUBE: "youtube",
  VIMEO: "vimeo",
  UPLOAD: "upload",
  EXTERNAL: "external",
} as const;

export type VideoType = (typeof VIDEO_TYPES)[keyof typeof VIDEO_TYPES];

// ─── Channel types (text only for now) ───────────────────────────
export const CHANNEL_TYPES = {
  TEXT: "text",
} as const;

export type ChannelType = (typeof CHANNEL_TYPES)[keyof typeof CHANNEL_TYPES];

// ─── Favourite / Like target types (polymorphic) ─────────────────
export const FAVOURITE_TARGETS = {
  CHAPTER: "chapter",
  COURSE: "course",
  POST: "post",
  EVENT: "event",
} as const;

export type FavouriteTarget = (typeof FAVOURITE_TARGETS)[keyof typeof FAVOURITE_TARGETS];

export const LIKE_TARGETS = {
  CHAPTER: "chapter",
  POST: "post",
  EVENT: "event",
  COMMENT: "comment",
} as const;

export type LikeTarget = (typeof LIKE_TARGETS)[keyof typeof LIKE_TARGETS];

// ─── Notification types ──────────────────────────────────────────
export const NOTIFICATION_TYPES = {
  NEW_POST: "new_post",
  EVENT_REMINDER: "event_reminder",
  CHAT_MENTION: "chat_mention",
  DIRECT_MESSAGE: "direct_message",
  COURSE_UPDATE: "course_update",
  MEMBER_JOINED: "member_joined",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ─── Notification channels ───────────────────────────────────────
export const NOTIFICATION_CHANNELS = {
  IN_APP: "in_app",
  EMAIL: "email",
  PUSH: "push",
} as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

// ─── Tenant status ───────────────────────────────────────────────
export const TENANT_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
  TRIALING: "trialing",
} as const;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];

// ─── Reserved subdomains (can't be used by clubs) ────────────────
export const RESERVED_SUBDOMAINS = [
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "docs",
  "blog",
  "help",
  "support",
  "staging",
  "demo",
  "coledia",
];
