-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `externalRef` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Tenant_externalRef_key` ON `Tenant`(`externalRef`);
