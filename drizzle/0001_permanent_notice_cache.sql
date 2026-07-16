CREATE TABLE IF NOT EXISTS `notice_cache` (
	`purchase_key` text PRIMARY KEY NOT NULL,
	`notice_url` text NOT NULL,
	`cnpj` text NOT NULL,
	`pncp_year` integer NOT NULL,
	`pncp_sequence` integer NOT NULL,
	`updated_at` integer NOT NULL
);
