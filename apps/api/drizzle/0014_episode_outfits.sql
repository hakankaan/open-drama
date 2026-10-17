ALTER TABLE `episode_characters` ADD `outfit` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `episode_characters` ADD `outfit_path` text;--> statement-breakpoint
ALTER TABLE `shots` ADD `keyframe_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shots` ADD `keyframe_drawn_revision` integer DEFAULT 0 NOT NULL;