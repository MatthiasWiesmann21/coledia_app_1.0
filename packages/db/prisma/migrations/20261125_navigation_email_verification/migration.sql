-- Per-tenant sign-up setting: require email verification before using the app
-- (default: sign-up goes straight into the app).
ALTER TABLE `Tenant` ADD COLUMN `requireEmailVerification` BOOLEAN NOT NULL DEFAULT false;

-- Sidebar navigation: order + enabled state of modules and custom pages.
CREATE TABLE `NavigationItem` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `moduleKey` VARCHAR(191) NULL,
    `customPageId` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NavigationItem_customPageId_key`(`customPageId`),
    INDEX `NavigationItem_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `NavigationItem_tenantId_moduleKey_key`(`tenantId`, `moduleKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NavigationItem` ADD CONSTRAINT `NavigationItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NavigationItem` ADD CONSTRAINT `NavigationItem_customPageId_fkey` FOREIGN KEY (`customPageId`) REFERENCES `CustomPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
