CREATE TABLE `announced_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`monitored_channel_id` integer NOT NULL,
	`youtube_video_id` text NOT NULL,
	`announced_at` integer NOT NULL,
	FOREIGN KEY (`monitored_channel_id`) REFERENCES `monitored_channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `announced_videos_guild_video_unique` ON `announced_videos` (`guild_id`,`youtube_video_id`);--> statement-breakpoint
CREATE TABLE `monitored_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`youtube_channel_id` text NOT NULL,
	`display_name` text NOT NULL,
	`added_by_user_id` text NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitored_channels_guild_channel_unique` ON `monitored_channels` (`guild_id`,`youtube_channel_id`);--> statement-breakpoint
CREATE TABLE `server_configurations` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`announcement_channel_id` text,
	`updated_at` integer NOT NULL
);
