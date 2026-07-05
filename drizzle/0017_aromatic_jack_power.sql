CREATE TABLE `budget_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_groups_uuid_unique` ON `budget_groups` (`uuid`);--> statement-breakpoint
CREATE INDEX `budget_groups_order_idx` ON `budget_groups` (`order`);--> statement-breakpoint
CREATE INDEX `budget_groups_user_idx` ON `budget_groups` (`user_id`);--> statement-breakpoint
CREATE TABLE `budget_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`subcategory_id` integer NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`item_type` text DEFAULT 'expense' NOT NULL,
	`target_amount` real,
	`is_active` integer DEFAULT true NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subcategory_id`) REFERENCES `budget_subcategories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_items_uuid_unique` ON `budget_items` (`uuid`);--> statement-breakpoint
CREATE INDEX `budget_items_subcategory_idx` ON `budget_items` (`subcategory_id`);--> statement-breakpoint
CREATE INDEX `budget_items_order_idx` ON `budget_items` (`order`);--> statement-breakpoint
CREATE INDEX `budget_items_active_idx` ON `budget_items` (`is_active`);--> statement-breakpoint
CREATE INDEX `budget_items_user_idx` ON `budget_items` (`user_id`);--> statement-breakpoint
CREATE TABLE `budget_subcategories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`group_id` integer NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `budget_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_subcategories_uuid_unique` ON `budget_subcategories` (`uuid`);--> statement-breakpoint
CREATE INDEX `budget_subcategories_group_idx` ON `budget_subcategories` (`group_id`);--> statement-breakpoint
CREATE INDEX `budget_subcategories_order_idx` ON `budget_subcategories` (`order`);--> statement-breakpoint
CREATE INDEX `budget_subcategories_user_idx` ON `budget_subcategories` (`user_id`);--> statement-breakpoint
CREATE TABLE `data_migrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`applied_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_migrations_name_unique` ON `data_migrations` (`name`);--> statement-breakpoint
--> HAND-EDITED: rename old budgets to budgets_legacy (keep rows for the TS data
--> migration's category→item budget mapping) instead of dropping. New empty
--> budgets table is created here; rows are copied in lib/db/data-migrations.ts.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP INDEX IF EXISTS `budgets_year_month_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `budgets_year_month_category_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `budgets_user_idx`;--> statement-breakpoint
ALTER TABLE `budgets` RENAME TO `budgets_legacy`;--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`budget_item_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`amount` real NOT NULL,
	`user_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`budget_item_id`) REFERENCES `budget_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `budgets_year_month_idx` ON `budgets` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `budgets_year_month_item_idx` ON `budgets` (`year`,`month`,`budget_item_id`);--> statement-breakpoint
CREATE INDEX `budgets_user_idx` ON `budgets` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_item_year_month_user_idx` ON `budgets` (`budget_item_id`,`year`,`month`,`user_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `budget_item_id` integer REFERENCES budget_items(id);--> statement-breakpoint
CREATE INDEX `transactions_budget_item_idx` ON `transactions` (`budget_item_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_budget_item_idx` ON `transactions` (`date`,`budget_item_id`);--> statement-breakpoint
ALTER TABLE `categories` DROP COLUMN `exclude_from_budget`;