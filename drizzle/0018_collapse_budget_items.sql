--> HAND-EDITED: rename budget_items to budget_items_legacy instead of dropping
--> it — the TS data migration (budget_hierarchy_v2_collapse_items) reads it to
--> fold item keywords/type/target/order into budget_subcategories and relink
--> transactions/budgets before dropping it for real.
ALTER TABLE `budget_items` RENAME TO `budget_items_legacy`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`budget_item_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`amount` real NOT NULL,
	`user_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`budget_item_id`) REFERENCES `budget_subcategories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_budgets`("id", "budget_item_id", "year", "month", "amount", "user_id", "created_at", "updated_at") SELECT "id", "budget_item_id", "year", "month", "amount", "user_id", "created_at", "updated_at" FROM `budgets`;--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `budgets_year_month_idx` ON `budgets` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `budgets_year_month_item_idx` ON `budgets` (`year`,`month`,`budget_item_id`);--> statement-breakpoint
CREATE INDEX `budgets_user_idx` ON `budgets` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_item_year_month_user_idx` ON `budgets` (`budget_item_id`,`year`,`month`,`user_id`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`date` integer NOT NULL,
	`description` text NOT NULL,
	`match_field` text NOT NULL,
	`amount_out` real DEFAULT 0 NOT NULL,
	`amount_in` real DEFAULT 0 NOT NULL,
	`net_amount` real DEFAULT 0 NOT NULL,
	`source` text NOT NULL,
	`source_method` text,
	`source_account_name` text,
	`note` text,
	`category_id` integer,
	`budget_item_id` integer,
	`category_locked` integer DEFAULT false NOT NULL,
	`import_id` integer,
	`user_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`budget_item_id`) REFERENCES `budget_subcategories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "uuid", "date", "description", "match_field", "amount_out", "amount_in", "net_amount", "source", "source_method", "source_account_name", "note", "category_id", "budget_item_id", "category_locked", "import_id", "user_id", "created_at", "updated_at") SELECT "id", "uuid", "date", "description", "match_field", "amount_out", "amount_in", "net_amount", "source", "source_method", "source_account_name", "note", "category_id", "budget_item_id", "category_locked", "import_id", "user_id", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_uuid_unique` ON `transactions` (`uuid`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_budget_item_idx` ON `transactions` (`budget_item_id`);--> statement-breakpoint
CREATE INDEX `transactions_source_idx` ON `transactions` (`source`);--> statement-breakpoint
CREATE INDEX `transactions_import_idx` ON `transactions` (`import_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_category_idx` ON `transactions` (`date`,`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_budget_item_idx` ON `transactions` (`date`,`budget_item_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_id`);--> statement-breakpoint
ALTER TABLE `budget_subcategories` ADD `keywords` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_subcategories` ADD `item_type` text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_subcategories` ADD `target_amount` real;--> statement-breakpoint
ALTER TABLE `budget_subcategories` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `budget_subcategories_active_idx` ON `budget_subcategories` (`is_active`);