-- DirectConversation uniqueness must include tenantId: the same pair of
-- (global) users can have independent DM conversations in different tenants.

-- DropIndex
ALTER TABLE `DirectConversation` DROP INDEX `DirectConversation_user1Id_user2Id_key`;

-- CreateIndex
CREATE UNIQUE INDEX `DirectConversation_tenantId_user1Id_user2Id_key` ON `DirectConversation`(`tenantId`, `user1Id`, `user2Id`);
