ALTER TABLE `contacts` ADD `company` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `company_domain` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `source` text DEFAULT 'article' NOT NULL;
