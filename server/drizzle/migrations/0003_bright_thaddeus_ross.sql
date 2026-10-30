CREATE TABLE `related_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'unexplored' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `signals` ADD `parent_signal_id` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `industry_tags` text;