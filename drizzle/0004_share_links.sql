CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`asset_id` text,
	`folder_id` text,
	`organization_id` text NOT NULL,
	`expires_at` integer,
	`allow_download` integer DEFAULT true,
	`view_count` integer DEFAULT 0,
	`max_views` integer,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unique` ON `share_links` (`token`);
--> statement-breakpoint
CREATE INDEX `share_links_token_idx` ON `share_links` (`token`);
--> statement-breakpoint
CREATE INDEX `share_links_asset_idx` ON `share_links` (`asset_id`);
--> statement-breakpoint
CREATE INDEX `share_links_folder_idx` ON `share_links` (`folder_id`);
--> statement-breakpoint
CREATE INDEX `share_links_org_idx` ON `share_links` (`organization_id`);
