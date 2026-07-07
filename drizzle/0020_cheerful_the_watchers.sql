CREATE TABLE `planned_income` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`amount` real NOT NULL,
	`user_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `planned_income_year_month_idx` ON `planned_income` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `planned_income_user_idx` ON `planned_income` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `planned_income_year_month_user_idx` ON `planned_income` (`year`,`month`,`user_id`);