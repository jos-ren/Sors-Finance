ALTER TABLE `portfolio_items` ADD `plaid_account_id` integer REFERENCES plaid_accounts(id);--> statement-breakpoint
CREATE INDEX `portfolio_items_plaid_idx` ON `portfolio_items` (`plaid_account_id`);