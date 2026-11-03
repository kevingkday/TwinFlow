ALTER TABLE `users` ADD `legal_business_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `street_address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `city` text;--> statement-breakpoint
ALTER TABLE `users` ADD `state` text;--> statement-breakpoint
ALTER TABLE `users` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `users` ADD `country` text DEFAULT 'CA';--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` text DEFAULT 'America/Vancouver';--> statement-breakpoint
ALTER TABLE `campaigns` ADD `legal_business_name` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `street_address` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `city` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `state` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `country` text DEFAULT 'CA';--> statement-breakpoint
ALTER TABLE `campaigns` ADD `timezone` text DEFAULT 'America/Vancouver';
