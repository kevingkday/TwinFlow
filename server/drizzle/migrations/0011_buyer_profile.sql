ALTER TABLE `users` ADD `buyer_industries` text;--> statement-breakpoint
ALTER TABLE `users` ADD `buyer_roles` text;--> statement-breakpoint
ALTER TABLE `users` ADD `buyer_company_size` text;--> statement-breakpoint
ALTER TABLE `users` ADD `service_area` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `allow_national_search` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `buyer_industries` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `buyer_roles` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `buyer_company_size` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `service_area` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `allow_national_search` integer DEFAULT 0 NOT NULL;
