import type { TextBasedChannel } from 'discord.js';
import type { FeedVideo } from './youtube.js';

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
