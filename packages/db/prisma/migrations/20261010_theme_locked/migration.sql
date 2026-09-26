-- Branding: tenant-level theme lock. When enabled, themeMode is forced for
-- all users of the tenant and the user-facing theme toggle is hidden.
ALTER TABLE `Branding` ADD COLUMN `themeLocked` BOOLEAN NOT NULL DEFAULT false;
