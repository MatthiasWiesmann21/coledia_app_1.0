CREATE TABLE `OwnerAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tier` VARCHAR(191) NOT NULL DEFAULT 'free',
    `stripeCustomerId` VARCHAR(191) NULL,
    `stripeSubscriptionId` VARCHAR(191) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OwnerAccount_userId_key`(`userId`),
    UNIQUE INDEX `OwnerAccount_stripeCustomerId_key`(`stripeCustomerId`),
    UNIQUE INDEX `OwnerAccount_stripeSubscriptionId_key`(`stripeSubscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Container` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subdomain` VARCHAR(191) NOT NULL,
    `customDomain` VARCHAR(191) NULL,
    `dokployApplicationId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'provisioning',
    `plan` VARCHAR(191) NOT NULL DEFAULT 'starter',
    `provisionError` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Container_tenantId_key`(`tenantId`),
    UNIQUE INDEX `Container_subdomain_key`(`subdomain`),
    UNIQUE INDEX `Container_customDomain_key`(`customDomain`),
    UNIQUE INDEX `Container_dokployApplicationId_key`(`dokployApplicationId`),
    INDEX `Container_ownerId_status_idx`(`ownerId`, `status`),
    INDEX `Container_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OwnerAccount` ADD CONSTRAINT `OwnerAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Container` ADD CONSTRAINT `Container_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `OwnerAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Container` ADD CONSTRAINT `Container_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
