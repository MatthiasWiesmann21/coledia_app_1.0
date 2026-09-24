-- Optional event location and attendee cap (null = unlimited).

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `maxAttendees` INTEGER NULL;
