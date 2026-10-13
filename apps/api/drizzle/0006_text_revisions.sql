ALTER TABLE `dramas` ADD `outline_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `beats_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `episodes` ADD `recap_text_revision` integer DEFAULT 0 NOT NULL;