ALTER TABLE `transactions` ADD `plaid_transaction_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `original_description` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `merchant_name` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `transacted_at` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `details` text;--> statement-breakpoint
CREATE INDEX `transactions_user_plaid_idx` ON `transactions` (`user_id`,`plaid_transaction_id`);