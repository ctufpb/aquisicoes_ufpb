CREATE TABLE IF NOT EXISTS `device_visits` (
	`visit_key` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`visit_date` text NOT NULL,
	`last_seen` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `device_visits_date_idx` ON `device_visits` (`visit_date`);
