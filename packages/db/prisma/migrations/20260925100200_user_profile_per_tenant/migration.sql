-- User profiles become per tenant. Each existing (global) profile is copied to
-- every tenant the user is a member of, then the global rows are removed.

-- AlterTable
ALTER TABLE `UserProfile` ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- New unique key first (it also backs the userId foreign key), then drop the old one
CREATE UNIQUE INDEX `UserProfile_userId_tenantId_key` ON `UserProfile`(`userId`, `tenantId`);
DROP INDEX `UserProfile_userId_key` ON `UserProfile`;

-- Copy each global profile to each of the user's tenants
INSERT INTO `UserProfile` (`id`, `userId`, `tenantId`, `username`, `bio`, `avatarUrl`, `status`, `language`, `acceptedTermsAt`, `createdAt`, `updatedAt`)
SELECT UUID(), p.`userId`, m.`tenantId`, p.`username`, p.`bio`, p.`avatarUrl`, p.`status`, p.`language`, p.`acceptedTermsAt`, p.`createdAt`, p.`updatedAt`
FROM `UserProfile` p
JOIN `Membership` m ON m.`userId` = p.`userId`
WHERE p.`tenantId` IS NULL;

DELETE FROM `UserProfile` WHERE `tenantId` IS NULL;

ALTER TABLE `UserProfile` MODIFY `tenantId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `UserProfile_tenantId_idx` ON `UserProfile`(`tenantId`);

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
