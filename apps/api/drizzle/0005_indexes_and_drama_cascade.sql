CREATE INDEX `episode_characters_character_idx` ON `episode_characters` (`character_id`);--> statement-breakpoint
CREATE INDEX `episode_props_prop_idx` ON `episode_props` (`prop_id`);--> statement-breakpoint
CREATE INDEX `episode_scenes_scene_idx` ON `episode_scenes` (`scene_id`);--> statement-breakpoint
CREATE INDEX `shot_characters_character_idx` ON `shot_characters` (`character_id`);--> statement-breakpoint
CREATE INDEX `shot_props_prop_idx` ON `shot_props` (`prop_id`);--> statement-breakpoint
CREATE INDEX `shots_scene_idx` ON `shots` (`scene_id`);--> statement-breakpoint
CREATE INDEX `generation_tasks_character_idx` ON `generation_tasks` (`character_id`);--> statement-breakpoint
CREATE INDEX `generation_tasks_scene_idx` ON `generation_tasks` (`scene_id`);--> statement-breakpoint
CREATE INDEX `generation_tasks_prop_idx` ON `generation_tasks` (`prop_id`);--> statement-breakpoint
-- The episodes of a drama deleted before deletes cascaded get the drama's timestamp, as a delete does now.
UPDATE `episodes` SET `deleted_at` = (SELECT `deleted_at` FROM `dramas` WHERE `dramas`.`id` = `episodes`.`drama_id`) WHERE `deleted_at` IS NULL AND `drama_id` IN (SELECT `id` FROM `dramas` WHERE `deleted_at` IS NOT NULL);--> statement-breakpoint
-- The characters of a drama deleted before deletes cascaded get the drama's timestamp, as a delete does now.
UPDATE `characters` SET `deleted_at` = (SELECT `deleted_at` FROM `dramas` WHERE `dramas`.`id` = `characters`.`drama_id`) WHERE `deleted_at` IS NULL AND `drama_id` IN (SELECT `id` FROM `dramas` WHERE `deleted_at` IS NOT NULL);--> statement-breakpoint
-- The scenes of a drama deleted before deletes cascaded get the drama's timestamp, as a delete does now.
UPDATE `scenes` SET `deleted_at` = (SELECT `deleted_at` FROM `dramas` WHERE `dramas`.`id` = `scenes`.`drama_id`) WHERE `deleted_at` IS NULL AND `drama_id` IN (SELECT `id` FROM `dramas` WHERE `deleted_at` IS NOT NULL);--> statement-breakpoint
-- The props of a drama deleted before deletes cascaded get the drama's timestamp, as a delete does now.
UPDATE `props` SET `deleted_at` = (SELECT `deleted_at` FROM `dramas` WHERE `dramas`.`id` = `props`.`drama_id`) WHERE `deleted_at` IS NULL AND `drama_id` IN (SELECT `id` FROM `dramas` WHERE `deleted_at` IS NOT NULL);
