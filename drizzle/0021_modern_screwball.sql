DROP TABLE `import_drafts`;--> statement-breakpoint
ALTER TABLE `transactions` ADD `review_status` text DEFAULT 'reviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `conflict_categories` text;--> statement-breakpoint
CREATE INDEX `transactions_review_status_idx` ON `transactions` (`review_status`);