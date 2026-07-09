CREATE TABLE `agents` (
	`wallet` text PRIMARY KEY NOT NULL,
	`total_scans` integer DEFAULT 0,
	`reckless_trades` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_address` text NOT NULL,
	`threat_score` integer NOT NULL,
	`recommendation` text NOT NULL,
	`scan_hash` text NOT NULL,
	`tx_hash` text,
	`agent_wallet` text,
	`tier` text DEFAULT 'firewall',
	`report_data` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scans_scan_hash_unique` ON `scans` (`scan_hash`);
