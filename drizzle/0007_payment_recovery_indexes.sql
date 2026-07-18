CREATE UNIQUE INDEX `payments_settlement_tx_hash_unique` ON `payments` (`settlement_tx_hash`);
--> statement-breakpoint
CREATE INDEX `payments_request_payer_status_idx` ON `payments` (`request_hash`, `payer`, `status`);
--> statement-breakpoint
CREATE INDEX `payments_status_expires_idx` ON `payments` (`status`, `expires_at`);
