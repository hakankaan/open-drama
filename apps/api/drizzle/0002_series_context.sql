ALTER TABLE `dramas` ADD `serial` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `script_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `recap` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `recap_revision` integer DEFAULT 0 NOT NULL;