CREATE TABLE `plaid_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`user_id` integer NOT NULL,
	`plaid_item_id` integer NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`official_name` text,
	`type` text NOT NULL,
	`subtype` text NOT NULL,
	`mask` text,
	`portfolio_account_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plaid_item_id`) REFERENCES `plaid_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`portfolio_account_id`) REFERENCES `portfolio_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaid_accounts_uuid_unique` ON `plaid_accounts` (`uuid`);--> statement-breakpoint
CREATE INDEX `plaid_accounts_user_idx` ON `plaid_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `plaid_accounts_item_idx` ON `plaid_accounts` (`plaid_item_id`);--> statement-breakpoint
CREATE INDEX `plaid_accounts_account_idx` ON `plaid_accounts` (`account_id`);--> statement-breakpoint
CREATE INDEX `plaid_accounts_portfolio_idx` ON `plaid_accounts` (`portfolio_account_id`);--> statement-breakpoint
CREATE TABLE `plaid_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`user_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`access_token` text NOT NULL,
	`institution_id` text NOT NULL,
	`institution_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_sync` integer,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaid_items_uuid_unique` ON `plaid_items` (`uuid`);--> statement-breakpoint
CREATE INDEX `plaid_items_user_idx` ON `plaid_items` (`user_id`);--> statement-breakpoint
CREATE INDEX `plaid_items_item_idx` ON `plaid_items` (`item_id`);--> statement-breakpoint
CREATE INDEX `plaid_items_status_idx` ON `plaid_items` (`status`);