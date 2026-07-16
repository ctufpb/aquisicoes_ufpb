CREATE TABLE IF NOT EXISTS `api_cache` (
  `cache_key` text PRIMARY KEY NOT NULL,
  `body` text NOT NULL,
  `content_type` text DEFAULT 'application/json; charset=utf-8' NOT NULL,
  `expires_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `api_cache_expires_at_idx` ON `api_cache` (`expires_at`);
