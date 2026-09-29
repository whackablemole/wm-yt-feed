PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_announced_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`monitored_channel_id` integer NOT NULL,
	`youtube_video_id` text NOT NULL,
	`announced_at` integer NOT NULL,
	FOREIGN KEY (`monitored_channel_id`) REFERENCES `monitored_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_announced_videos`("id", "guild_id", "monitored_channel_id", "youtube_video_id", "announced_at") SELECT "id", "guild_id", "monitored_channel_id", "youtube_video_id", "announced_at" FROM `announced_videos`;--> statement-breakpoint
DROP TABLE `announced_videos`;--> statement-breakpoint
ALTER TABLE `__new_announced_videos` RENAME TO `announced_videos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `announced_videos_guild_video_unique` ON `announced_videos` (`guild_id`,`youtube_video_id`);