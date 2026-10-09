PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agent_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`episode_id` integer,
	`drama_id` integer NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`progress` text DEFAULT '{}' NOT NULL,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
INSERT INTO `__new_agent_jobs`("id", "kind", "episode_id", "drama_id", "target", "status", "progress", "error", "started_at", "finished_at") SELECT "id", "kind", "episode_id", "drama_id", "target", "status", "progress", "error", "started_at", "finished_at" FROM `agent_jobs`;--> statement-breakpoint
DROP TABLE `agent_jobs`;--> statement-breakpoint
ALTER TABLE `__new_agent_jobs` RENAME TO `agent_jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `agent_jobs_episode_idx` ON `agent_jobs` (`episode_id`);--> statement-breakpoint
CREATE INDEX `agent_jobs_drama_idx` ON `agent_jobs` (`drama_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_jobs_running_episode_uq` ON `agent_jobs` (`kind`,`drama_id`,`episode_id`,`target`) WHERE "agent_jobs"."status" = 'running' AND "agent_jobs"."episode_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `agent_jobs_running_drama_uq` ON `agent_jobs` (`kind`,`drama_id`,`target`) WHERE "agent_jobs"."status" = 'running' AND "agent_jobs"."episode_id" IS NULL;--> statement-breakpoint
ALTER TABLE `dramas` ADD `outline` text DEFAULT '' NOT NULL;