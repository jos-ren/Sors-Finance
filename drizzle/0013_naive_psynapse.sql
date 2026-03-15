CREATE TABLE `portfolio_item_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`source` text NOT NULL,
	`type` text,
	`changes` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `portfolio_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `portfolio_item_history_item_idx` ON `portfolio_item_history` (`item_id`);--> statement-breakpoint
CREATE INDEX `portfolio_item_history_user_idx` ON `portfolio_item_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `portfolio_item_history_created_idx` ON `portfolio_item_history` (`created_at`);--> statement-breakpoint
ALTER TABLE `portfolio_items` ADD `type` text;--> statement-breakpoint
UPDATE `portfolio_items` SET `type` = `ticker_type` WHERE `ticker_type` IS NOT NULL;--> statement-breakpoint
UPDATE `portfolio_items` SET `type` = 'bank' WHERE `type` IS NULL AND `plaid_account_id` IS NOT NULL;--> statement-breakpoint
UPDATE `portfolio_items` SET `type` = 'other' WHERE `type` IS NULL;