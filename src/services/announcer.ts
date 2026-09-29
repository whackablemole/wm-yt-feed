import type { TextBasedChannel } from 'discord.js';
import type { FeedVideo, LiveBroadcast } from './youtube.js';

/** Posts a title+link announcement message — see FR-010. */
export async function postAnnouncement(
  channel: TextBasedChannel,
  channelDisplayName: string,
  video: FeedVideo,
): Promise<void> {
  if (!channel.isSendable()) {
    throw new Error('Configured announcement channel is not sendable');
  }
  await channel.send(`📺 **${channelDisplayName}** just posted a new video: **${video.title}**\n${video.url}`);
}

/** Posts a "live now" notification, visually distinct from a new-video announcement — see FR-003, contracts/live-notification.md. */
export async function postLiveNotification(
  channel: TextBasedChannel,
  channelDisplayName: string,
  liveVideo: LiveBroadcast,
): Promise<void> {
  if (!channel.isSendable()) {
    throw new Error('Configured announcement channel is not sendable');
  }
  await channel.send(`🔴 **${channelDisplayName}** is **LIVE now**: **${liveVideo.title}**\n${liveVideo.url}`);
}
