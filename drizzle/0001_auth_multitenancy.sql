-- Migration: Add Better Auth tables and multi-tenancy support
-- This migration handles existing data by creating a default organization

-- ============================================================================
-- Phase 1: Create Better Auth tables (no dependencies on existing data)
-- ============================================================================

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);
--> statement-breakpoint

CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint

CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);
--> statement-breakpoint

CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_org_user_idx` ON `members` (`organization_id`,`user_id`);
--> statement-breakpoint

CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`inviter_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- ============================================================================
-- Phase 2: Create default organization for existing data migration
-- ============================================================================

INSERT INTO `organizations` (`id`, `name`, `slug`, `created_at`)
VALUES ('default-org', 'Default Workspace', 'default', unixepoch());
--> statement-breakpoint

-- ============================================================================
-- Phase 3: Add organization_id to existing tables (nullable first)
-- ============================================================================

-- Drop old unique indexes that need to become composite
DROP INDEX IF EXISTS `folders_slug_unique`;
--> statement-breakpoint
DROP INDEX IF EXISTS `tags_name_unique`;
--> statement-breakpoint
DROP INDEX IF EXISTS `tags_slug_unique`;
--> statement-breakpoint

-- Add organization_id columns as nullable
ALTER TABLE `folders` ADD `organization_id` text REFERENCES organizations(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `assets` ADD `organization_id` text REFERENCES organizations(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `tags` ADD `organization_id` text REFERENCES organizations(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `tags` ADD `updated_at` integer DEFAULT (unixepoch());
--> statement-breakpoint
ALTER TABLE `api_keys` ADD `organization_id` text REFERENCES organizations(id) ON DELETE CASCADE;
--> statement-breakpoint

-- ============================================================================
-- Phase 4: Migrate existing data to default organization
-- ============================================================================

UPDATE `folders` SET `organization_id` = 'default-org' WHERE `organization_id` IS NULL;
--> statement-breakpoint
UPDATE `assets` SET `organization_id` = 'default-org' WHERE `organization_id` IS NULL;
--> statement-breakpoint
UPDATE `tags` SET `organization_id` = 'default-org' WHERE `organization_id` IS NULL;
--> statement-breakpoint
UPDATE `api_keys` SET `organization_id` = 'default-org' WHERE `organization_id` IS NULL;
--> statement-breakpoint

-- ============================================================================
-- Phase 5: Create new composite indexes for tenant isolation
-- ============================================================================

CREATE UNIQUE INDEX `folders_org_slug_idx` ON `folders` (`organization_id`,`slug`);
--> statement-breakpoint
CREATE INDEX `folders_org_idx` ON `folders` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `assets_org_idx` ON `assets` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `assets_org_folder_idx` ON `assets` (`organization_id`,`folder_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_org_name_idx` ON `tags` (`organization_id`,`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_org_slug_idx` ON `tags` (`organization_id`,`slug`);
--> statement-breakpoint
CREATE INDEX `tags_org_idx` ON `tags` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `api_keys_org_idx` ON `api_keys` (`organization_id`);
