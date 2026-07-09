CREATE TABLE `used_payment_transactions` (
	`tx_hash` text PRIMARY KEY NOT NULL,
	`network` text NOT NULL,
	`chain_id` integer NOT NULL,
	`token_address` text NOT NULL,
	`treasury_address` text NOT NULL,
	`payer` text NOT NULL,
	`amount` text NOT NULL,
	`tier` text NOT NULL,
	`created_at` integer NOT NULL
);
