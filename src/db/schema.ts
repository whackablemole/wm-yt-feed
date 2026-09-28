import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const monitoredChannels = sqliteTable(
  'monitored_channels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    youtubeChannelId: text('youtube_channel_id').notNull(),
    displayName: text('display_name').notNull(),
    addedByUserId: text('added_by_user_id').notNull(),
    addedAt: integer('added_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [uniqueIndex('monitored_channels_guild_channel_unique').on(table.guildId, table.youtubeChannelId)],
);

export const serverConfigurations = sqliteTable('server_configurations', {
  guildId: text('guild_id').primaryKey(),
  announcementChannelId: text('announcement_channel_id'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const announcedVideos = sqliteTable(
  'announced_videos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    monitoredChannelId: integer('monitored_channel_id')
      .notNull()
      .references(() => monitoredChannels.id),
    youtubeVideoId: text('youtube_video_id').notNull(),
    announcedAt: integer('announced_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [uniqueIndex('announced_videos_guild_video_unique').on(table.guildId, table.youtubeVideoId)],
);

export type MonitoredChannel = typeof monitoredChannels.$inferSelect;
export type NewMonitoredChannel = typeof monitoredChannels.$inferInsert;
export type ServerConfiguration = typeof serverConfigurations.$inferSelect;
export type AnnouncedVideo = typeof announcedVideos.$inferSelect;
export type NewAnnouncedVideo = typeof announcedVideos.$inferInsert;
