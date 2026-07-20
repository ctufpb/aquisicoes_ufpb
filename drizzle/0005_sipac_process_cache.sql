CREATE TABLE IF NOT EXISTS `sipac_process_cache` (
	`process_number` text PRIMARY KEY NOT NULL,
	`process_id` integer NOT NULL,
	`updated_at` integer NOT NULL
);
