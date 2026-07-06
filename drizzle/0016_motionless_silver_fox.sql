CREATE TABLE `system_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `system_logs_created_idx` ON `system_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `system_logs_user_idx` ON `system_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `system_logs_level_idx` ON `system_logs` (`level`);