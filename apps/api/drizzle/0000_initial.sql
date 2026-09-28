CREATE TABLE `dramas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`genre` text DEFAULT '' NOT NULL,
	`style` text NOT NULL,
	`aspect_ratio` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`thumbnail` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`drama_id` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`script_content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`resolution` text DEFAULT '720p' NOT NULL,
	`image_service_id` integer,
	`video_service_id` integer,
	`film_path` text,
	`film_duration_seconds` real,
	`duration_seconds` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`drama_id`) REFERENCES `dramas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `episodes_drama_idx` ON `episodes` (`drama_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_drama_number_live_uq` ON `episodes` (`drama_id`,`episode_number`) WHERE "episodes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`drama_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`appearance` text DEFAULT '' NOT NULL,
	`styling` text DEFAULT '' NOT NULL,
	`final_prompt` text,
	`final_prompt_stale` integer DEFAULT false NOT NULL,
	`image_path` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`drama_id`) REFERENCES `dramas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `characters_drama_idx` ON `characters` (`drama_id`);--> statement-breakpoint
CREATE TABLE `episode_characters` (
	`episode_id` integer NOT NULL,
	`character_id` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`episode_id`, `character_id`),
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `episode_props` (
	`episode_id` integer NOT NULL,
	`prop_id` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`episode_id`, `prop_id`),
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prop_id`) REFERENCES `props`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `episode_scenes` (
	`episode_id` integer NOT NULL,
	`scene_id` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`episode_id`, `scene_id`),
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `props` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`drama_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`final_prompt` text,
	`final_prompt_stale` integer DEFAULT false NOT NULL,
	`image_path` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`drama_id`) REFERENCES `dramas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `props_drama_idx` ON `props` (`drama_id`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`drama_id` integer NOT NULL,
	`location` text NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`lighting` text DEFAULT '' NOT NULL,
	`final_prompt` text,
	`final_prompt_stale` integer DEFAULT false NOT NULL,
	`image_path` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`drama_id`) REFERENCES `dramas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scenes_drama_idx` ON `scenes` (`drama_id`);--> statement-breakpoint
CREATE TABLE `shot_characters` (
	`shot_id` integer NOT NULL,
	`character_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`shot_id`, `character_id`),
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shot_props` (
	`shot_id` integer NOT NULL,
	`prop_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`shot_id`, `prop_id`),
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prop_id`) REFERENCES `props`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` integer NOT NULL,
	`shot_number` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`shot_type` text DEFAULT '' NOT NULL,
	`angle` text DEFAULT '' NOT NULL,
	`movement` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`atmosphere` text DEFAULT '' NOT NULL,
	`image_prompt` text DEFAULT '' NOT NULL,
	`video_prompt` text DEFAULT '' NOT NULL,
	`bgm_prompt` text DEFAULT '' NOT NULL,
	`sound_effect` text DEFAULT '' NOT NULL,
	`duration_seconds` real DEFAULT 10 NOT NULL,
	`scene_id` integer,
	`reference_media` text DEFAULT '{}' NOT NULL,
	`video_path` text,
	`video_duration_seconds` real,
	`parked_by_job_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shots_episode_idx` ON `shots` (`episode_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shots_episode_number_live_uq` ON `shots` (`episode_id`,`shot_number`) WHERE "shots"."parked_by_job_id" IS NULL;--> statement-breakpoint
CREATE TABLE `generation_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`drama_id` integer,
	`shot_id` integer,
	`character_id` integer,
	`scene_id` integer,
	`prop_id` integer,
	`service_id` integer,
	`provider` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`params` text DEFAULT '{}' NOT NULL,
	`provider_task_id` text,
	`result_url` text,
	`local_path` text,
	`duration_seconds` real,
	`status` text DEFAULT 'processing' NOT NULL,
	`error` text,
	`error_class` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `generation_tasks_type_idx` ON `generation_tasks` (`type`);--> statement-breakpoint
CREATE INDEX `generation_tasks_drama_idx` ON `generation_tasks` (`drama_id`);--> statement-breakpoint
CREATE INDEX `generation_tasks_shot_idx` ON `generation_tasks` (`shot_id`);--> statement-breakpoint
CREATE INDEX `generation_tasks_status_idx` ON `generation_tasks` (`status`);--> statement-breakpoint
CREATE TABLE `films` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` integer NOT NULL,
	`drama_id` integer NOT NULL,
	`clip_paths` text DEFAULT '[]' NOT NULL,
	`encoder` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`film_path` text,
	`duration_seconds` real,
	`poster_path` text,
	`error` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `films_episode_idx` ON `films` (`episode_id`);--> statement-breakpoint
CREATE TABLE `agent_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`episode_id` integer NOT NULL,
	`drama_id` integer NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`progress` text DEFAULT '{}' NOT NULL,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `agent_jobs_episode_idx` ON `agent_jobs` (`episode_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_jobs_running_uq` ON `agent_jobs` (`kind`,`episode_id`,`target`) WHERE "agent_jobs"."status" = 'running';--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_type` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`models` text DEFAULT '[]' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `style_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`prompt` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`seed_prompt` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `style_presets_value_unique` ON `style_presets` (`value`);