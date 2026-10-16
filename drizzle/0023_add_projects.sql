CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#84cc16' NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`budget` real,
	`funded_separately` integer DEFAULT true NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`fund_category_id` integer,
	`notes` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`fund_category_id`) REFERENCES `budget_subcategories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_uuid_unique` ON `projects` (`uuid`);--> statement-breakpoint
CREATE INDEX `projects_user_idx` ON `projects` (`user_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `project_id` integer REFERENCES projects(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `transactions_user_project_idx` ON `transactions` (`user_id`,`project_id`);