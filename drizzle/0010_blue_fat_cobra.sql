ALTER TABLE `imports` ADD `batch_id` text;--> statement-breakpoint
CREATE INDEX `imports_batch_idx` ON `imports` (`batch_id`);