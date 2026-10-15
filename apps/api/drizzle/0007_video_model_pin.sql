ALTER TABLE `episodes` ADD `video_model` text;--> statement-breakpoint
-- An episode that already has videos pins the model of its first completed video on its locked service (adr-0017).
UPDATE `episodes` SET `video_model` = (
  SELECT t.`model` FROM `generation_tasks` t JOIN `shots` s ON s.`id` = t.`shot_id`
  WHERE s.`episode_id` = `episodes`.`id` AND t.`type` = 'video' AND t.`status` = 'completed'
    AND t.`service_id` = `episodes`.`video_service_id` AND t.`model` <> ''
  ORDER BY t.`id` LIMIT 1
) WHERE `video_service_id` IS NOT NULL;
