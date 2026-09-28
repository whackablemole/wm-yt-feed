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
  logger.info('Poll cycle starting', { youtubeChannelsChecked: byYoutubeChannel.size });
  let announcedCount = 0;

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
      // First time this channel has ever been polled: seed the baseline with its
      // existing videos WITHOUT announcing them, so monitoring starts from "now"
      // rather than flooding the announcement channel with the entire back-catalog.
      if (!announcedVideoRepo.hasAnyRecorded(entry.guildId, entry.id)) {
        for (const video of videos) {
          announcedVideoRepo.recordAnnounced({
            guildId: entry.guildId,
            monitoredChannelId: entry.id,
            youtubeVideoId: video.videoId,
          });
        }
        logger.info('Seeded baseline for newly monitored channel (no backlog announced)', {
          guildId: entry.guildId,
          monitoredChannelId: entry.id,
          seededCount: videos.length,
        });
        continue;
      }

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
          announcedCount += 1;
        } catch (error) {
          logger.error('Failed to post announcement', { guildId: entry.guildId, videoId: video.videoId, error });
        }
      }
    }

    await delay(staggerMs);
  }

  logger.info('Poll cycle finished', { announcedCount });
}

// node-cron's default missedExecutionTolerance is 1000ms — under normal container
// scheduling jitter (and especially a host machine/Docker Desktop VM briefly pausing
// while idle) a tick can easily fire a bit late and get silently marked "missed"
// rather than run. 60s is still well under the 5-minute interval (no overlap risk)
// but tolerant enough that brief pauses don't cause a skipped poll.
const MISSED_EXECUTION_TOLERANCE_MS = 60_000;

/** Wires pollOnce into a recurring schedule — default every 5 minutes, see research.md §5. */
export function startPolling(deps: PollerDeps, cronExpression = '*/5 * * * *'): void {
  // Guards against the immediate startup run and the first cron tick landing close
  // together and executing concurrently (they aren't tracked by the same node-cron
  // instance, so node-cron's own overlap prevention doesn't cover this).
  let isRunning = false;
  const runGuarded = () => {
    if (isRunning) {
      logger.info('Skipping poll cycle: previous cycle still in progress');
      return;
    }
    isRunning = true;
    pollOnce(deps)
      .catch((error: unknown) => logger.error('Poll cycle failed', { error }))
      .finally(() => {
        isRunning = false;
      });
  };

  // Run once immediately so a fresh start/restart doesn't wait for the first cron
  // tick before checking for new videos.
  runGuarded();

  cron.schedule(cronExpression, runGuarded, { missedExecutionTolerance: MISSED_EXECUTION_TOLERANCE_MS });
}
