ALTER TABLE `payments` ADD `response_payload` text;
--> statement-breakpoint
ALTER TABLE `payments` ADD `completed_at` integer;
--> statement-breakpoint
ALTER TABLE `used_payment_transactions` ADD `payment_id` text;
--> statement-breakpoint
CREATE INDEX `used_payment_transactions_payment_id_idx` ON `used_payment_transactions` (`payment_id`);
