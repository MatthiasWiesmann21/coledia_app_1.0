-- Notification preferences become per tenant. Existing (global) preferences are
-- copied to every tenant the user is a member of, then the global rows are removed.

-- AlterTable
ALTER TABLE `NotificationPreference` ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- New unique key first (it also backs the userId foreign key), then drop the old one
CREATE UNIQUE INDEX `NotificationPreference_userId_tenantId_type_channel_key` ON `NotificationPreference`(`userId`, `tenantId`, `type`, `channel`);
DROP INDEX `NotificationPreference_userId_type_channel_key` ON `NotificationPreference`;

-- Copy each global preference to each of the user's tenants
INSERT INTO `NotificationPreference` (`id`, `userId`, `tenantId`, `type`, `channel`, `enabled`)
SELECT UUID(), p.`userId`, m.`tenantId`, p.`type`, p.`channel`, p.`enabled`
FROM `NotificationPreference` p
JOIN `Membership` m ON m.`userId` = p.`userId`
WHERE p.`tenantId` IS NULL;

DELETE FROM `NotificationPreference` WHERE `tenantId` IS NULL;

ALTER TABLE `NotificationPreference` MODIFY `tenantId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `NotificationPreference_tenantId_idx` ON `NotificationPreference`(`tenantId`);

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
