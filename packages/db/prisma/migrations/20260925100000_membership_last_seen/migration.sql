-- Per-tenant presence: "online" members are those seen recently in THIS tenant.

-- AlterTable
ALTER TABLE `Membership` ADD COLUMN `lastSeenAt` DATETIME(3) NULL;
