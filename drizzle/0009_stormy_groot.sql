CREATE TABLE `import_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`import_source` text NOT NULL,
	`current_step` text NOT NULL,
	`transaction_count` integer DEFAULT 0 NOT NULL,
	`draft_data` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_drafts_uuid_unique` ON `import_drafts` (`uuid`);--> statement-breakpoint
CREATE INDEX `import_drafts_user_idx` ON `import_drafts` (`user_id`);