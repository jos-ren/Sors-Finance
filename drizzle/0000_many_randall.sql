CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer,
	`amount` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `budgets_year_month_idx` ON `budgets` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `budgets_year_month_category_idx` ON `budgets` (`year`,`month`,`category_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`is_system` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_uuid_unique` ON `categories` (`uuid`);--> statement-breakpoint
CREATE INDEX `categories_order_idx` ON `categories` (`order`);--> statement-breakpoint
CREATE INDEX `categories_name_idx` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`source` text NOT NULL,
	`transaction_count` integer NOT NULL,
	`total_amount` real NOT NULL,
	`imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `imports_source_idx` ON `imports` (`source`);--> statement-breakpoint
CREATE TABLE `portfolio_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`bucket` text NOT NULL,
	`name` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_accounts_uuid_unique` ON `portfolio_accounts` (`uuid`);--> statement-breakpoint
CREATE INDEX `portfolio_accounts_bucket_idx` ON `portfolio_accounts` (`bucket`);--> statement-breakpoint
CREATE INDEX `portfolio_accounts_order_idx` ON `portfolio_accounts` (`order`);--> statement-breakpoint
CREATE TABLE `portfolio_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`current_value` real DEFAULT 0 NOT NULL,
	`notes` text,
	`order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`ticker` text,
	`quantity` real,
	`price_per_unit` real,
	`currency` text,
	`last_price_update` integer,
	`price_mode` text,
	`is_international` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `portfolio_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_items_uuid_unique` ON `portfolio_items` (`uuid`);--> statement-breakpoint
CREATE INDEX `portfolio_items_account_idx` ON `portfolio_items` (`account_id`);--> statement-breakpoint
CREATE INDEX `portfolio_items_active_idx` ON `portfolio_items` (`is_active`);--> statement-breakpoint
CREATE INDEX `portfolio_items_order_idx` ON `portfolio_items` (`order`);--> statement-breakpoint
CREATE TABLE `portfolio_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`date` integer NOT NULL,
	`total_savings` real DEFAULT 0 NOT NULL,
	`total_investments` real DEFAULT 0 NOT NULL,
	`total_assets` real DEFAULT 0 NOT NULL,
	`total_debt` real DEFAULT 0 NOT NULL,
	`net_worth` real DEFAULT 0 NOT NULL,
	`details` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_snapshots_uuid_unique` ON `portfolio_snapshots` (`uuid`);--> statement-breakpoint
CREATE INDEX `portfolio_snapshots_date_idx` ON `portfolio_snapshots` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`date` integer NOT NULL,
	`description` text NOT NULL,
	`match_field` text NOT NULL,
	`amount_out` real DEFAULT 0 NOT NULL,
	`amount_in` real DEFAULT 0 NOT NULL,
	`net_amount` real DEFAULT 0 NOT NULL,
	`source` text NOT NULL,
	`category_id` integer,
	`import_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_uuid_unique` ON `transactions` (`uuid`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_source_idx` ON `transactions` (`source`);--> statement-breakpoint
CREATE INDEX `transactions_import_idx` ON `transactions` (`import_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_category_idx` ON `transactions` (`date`,`category_id`);