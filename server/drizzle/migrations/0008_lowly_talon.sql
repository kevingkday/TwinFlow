CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`target_location` text,
	`user_intent` text DEFAULT 'sales_client_acquisition',
	`user_mission` text,
	`target_industries` text,
	`target_triggers` text,
	`target_roles` text,
	`value_prop` text,
	`icp_query` text,
	`is_default` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `signals` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
ALTER TABLE `users` ADD `active_campaign_id` text;