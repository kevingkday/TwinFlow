CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `signals` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `name` text DEFAULT 'Operator' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `organization` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `icp_query` text;--> statement-breakpoint
ALTER TABLE `users` ADD `target_industries` text;--> statement-breakpoint
ALTER TABLE `users` ADD `target_triggers` text;--> statement-breakpoint
ALTER TABLE `users` ADD `target_roles` text;--> statement-breakpoint
ALTER TABLE `users` ADD `value_prop` text;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_completed` integer DEFAULT false NOT NULL;