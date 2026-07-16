CREATE TABLE IF NOT EXISTS `pncp_link_cache` (
	`purchase_key` text PRIMARY KEY NOT NULL,
	`cnpj` text NOT NULL,
	`pncp_year` integer NOT NULL,
	`pncp_sequence` integer NOT NULL,
	`ata_sequence` integer,
	`updated_at` integer NOT NULL
);
