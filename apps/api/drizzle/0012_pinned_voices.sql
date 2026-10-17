ALTER TABLE `dramas` ADD `pinned_voices` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `voice` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `voice_sample_path` text;--> statement-breakpoint
ALTER TABLE `shots` ADD `speaker_id` integer REFERENCES characters(id);--> statement-breakpoint
ALTER TABLE `shots` ADD `line` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shots` ADD `line_audio_path` text;--> statement-breakpoint
ALTER TABLE `shots` ADD `line_audio_seconds` real;