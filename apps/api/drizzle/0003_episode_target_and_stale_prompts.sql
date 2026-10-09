ALTER TABLE `episodes` ADD `target_duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `shots` ADD `video_prompt_stale` integer DEFAULT false NOT NULL;