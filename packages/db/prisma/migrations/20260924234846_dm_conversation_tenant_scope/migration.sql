-- DirectConversation uniqueness must include tenantId: the same pair of
-- (global) users can have independent DM conversations in different tenants.

-- MySQL requires an index backing the user1Id foreign key; the unique
-- (user1Id, user2Id) key currently serves that role, so create a plain
-- index on user1Id before dropping it.
-- CreateIndex
CREATE INDEX `DirectConversation_user1Id_idx` ON `DirectConversation`(`user1Id`);

-- DropIndex
ALTER TABLE `DirectConversation` DROP INDEX `DirectConversation_user1Id_user2Id_key`;

-- CreateIndex
CREATE UNIQUE INDEX `DirectConversation_tenantId_user1Id_user2Id_key` ON `DirectConversation`(`tenantId`, `user1Id`, `user2Id`);
