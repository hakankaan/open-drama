ALTER TABLE `characters` ADD `headshot_path` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `body_path` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `side_path` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `back_path` text;--> statement-breakpoint
-- A character's image so far was a multi-view sheet and stays one; its final prompt described that sheet, and the
-- next image request rewrites it as a description of the person, framed per view in code (adr-0018).
UPDATE `characters` SET `final_prompt_stale` = 1 WHERE `final_prompt` IS NOT NULL AND `deleted_at` IS NULL;
