import cron from 'node-cron';
import type { Client } from 'discord.js';
import type { Db } from '../db/client.js';
import { MonitoredChannelRepository } from '../db/repositories/monitored-channel.js';
import { ServerConfigurationRepository } from '../db/repositories/server-config.js';
import { AnnouncedVideoRepository } from '../db/repositories/announced-video.js';
import type { MonitoredChannel } from '../db/schema.js';
import { fetchLatestVideos } from './youtube.js';
import { postAnnouncement } from './announcer.js';
import { logger } from '../lib/logger.js';

const STAGGER_DELAY_MS = 2_000;

export interface PollerDeps {
  client: Client;
  db: Db;
  /** Delay between distinct YouTube channels within a poll cycle; overridable for tests. */
  staggerMs?: number;
}

function groupByYoutubeChannel(channels: MonitoredChannel[]): Map<string, MonitoredChannel[]> {
  const map = new Map<string, MonitoredChannel[]>();
  for (const channel of channels) {
    const group = map.get(channel.youtubeChannelId) ?? [];
    group.push(channel);
    map.set(channel.youtubeChannelId, group);
  }
  return map;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One full poll cycle: check every monitored channel, post any new videos — FR-009, FR-011, FR-016. */
export async function pollOnce({ client, db, staggerMs = STAGGER_DELAY_MS }: PollerDeps): Promise<void> {
  const monitoredChannelRepo = new MonitoredChannelRepository(db);
  const serverConfigRepo = new ServerConfigurationRepository(db);
  const announcedVideoRepo = new AnnouncedVideoRepository(db);

  const byYoutubeChannel = groupByYoutubeChannel(monitoredChannelRepo.listAll());

  for (const [youtubeChannelId, entries] of byYoutubeChannel) {
    let videos;
    try {
      videos = await fetchLatestVideos(youtubeChannelId);
    } catch (error) {
      logger.warn('Failed to fetch feed for channel', { youtubeChannelId, error });
      await delay(staggerMs);
      continue;
    }

    for (const entry of entries) {
      const newVideos = videos.filter((video) => !announcedVideoRepo.isAnnounced(entry.guildId, video.videoId));
      if (newVideos.length === 0) continue;

      const config = serverConfigRepo.get(entry.guildId);
      if (!config?.announcementChannelId) continue;

      const discordChannel = await client.channels.fetch(config.announcementChannelId).catch(() => null);
      if (!discordChannel || !discordChannel.isTextBased()) {
        logger.warn('Announcement channel unavailable', { guildId: entry.guildId });
        continue;
      }

      for (const video of newVideos) {
        try {
          await postAnnouncement(discordChannel, entry.displayName, video);
          announcedVideoRepo.recordAnnounced({
            guildId: entry.guildId,
            monitoredChannelId: entry.id,
            youtubeVideoId: video.videoId,
          });
        } catch (error) {
          logger.error('Failed to post announcement', { guildId: entry.guildId, videoId: video.videoId, error });
        }
      }
    }

    await delay(staggerMs);
  }
}

/** Wires pollOnce into a recurring schedule — default every 5 minutes, see research.md §5. */
export function startPolling(deps: PollerDeps, cronExpression = '*/5 * * * *'): void {
  cron.schedule(cronExpression, () => {
    pollOnce(deps).catch((error: unknown) => logger.error('Poll cycle failed', { error }));
  });
}
