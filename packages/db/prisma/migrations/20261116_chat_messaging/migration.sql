-- Chat messaging: tenant scoping, edit/soft-delete/mentions on messages and
-- per-user read state for unread counts and "seen" indicators.

-- 1. New message columns (tenantId nullable first so existing rows can be backfilled)
ALTER TABLE `Message` ADD COLUMN `tenantId` VARCHAR(191) NULL,
    ADD COLUMN `mentions` JSON NULL,
    ADD COLUMN `editedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` VARCHAR(191) NULL;

-- 2. Backfill tenantId from the channel's chat server or the DM conversation
UPDATE `Message` m
  JOIN `Channel` c ON c.`id` = m.`channelId`
  JOIN `ChatServer` s ON s.`id` = c.`chatServerId`
SET m.`tenantId` = s.`tenantId`
WHERE m.`tenantId` IS NULL;

UPDATE `Message` m
  JOIN `DirectConversation` d ON d.`id` = m.`directConversationId`
SET m.`tenantId` = d.`tenantId`
WHERE m.`tenantId` IS NULL;

-- Orphans (no channel and no conversation) cannot be attributed to a tenant
UPDATE `Message` SET `replyToId` = NULL
WHERE `replyToId` IN (SELECT `id` FROM (SELECT `id` FROM `Message` WHERE `tenantId` IS NULL) AS orphan);
DELETE FROM `Message` WHERE `tenantId` IS NULL;

ALTER TABLE `Message` MODIFY `tenantId` VARCHAR(191) NOT NULL;
CREATE INDEX `Message_tenantId_idx` ON `Message`(`tenantId`);

-- 3. Read state
CREATE TABLE `ChatReadState` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NULL,
    `directConversationId` VARCHAR(191) NULL,
    `lastReadAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChatReadState_channelId_idx`(`channelId`),
    INDEX `ChatReadState_directConversationId_idx`(`directConversationId`),
    UNIQUE INDEX `ChatReadState_userId_channelId_key`(`userId`, `channelId`),
    UNIQUE INDEX `ChatReadState_userId_directConversationId_key`(`userId`, `directConversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ChatReadState` ADD CONSTRAINT `ChatReadState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ChatReadState` ADD CONSTRAINT `ChatReadState_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ChatReadState` ADD CONSTRAINT `ChatReadState_directConversationId_fkey` FOREIGN KEY (`directConversationId`) REFERENCES `DirectConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
