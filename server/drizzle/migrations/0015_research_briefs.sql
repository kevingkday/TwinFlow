ALTER TABLE `signals` ADD COLUMN `source_excerpts` text;
--> statement-breakpoint
ALTER TABLE `signals` ADD COLUMN `source_snapshot` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `research_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_name` text NOT NULL,
	`company_domain` text,
	`signal_id` text,
	`brief_title` text NOT NULL,
	`verified_facts` text NOT NULL,
	`inferred_opportunities` text NOT NULL,
	`investigation_questions` text NOT NULL,
	`verification_log` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_research_briefs_user_org` ON `research_briefs` (`user_id`, `organization_name`);
