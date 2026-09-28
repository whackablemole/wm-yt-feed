import { and, eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { announcedVideos } from '../schema.js';

export interface RecordAnnouncedInput {
  guildId: string;
  monitoredChannelId: number;
  youtubeVideoId: string;
}

export class AnnouncedVideoRepository {
  constructor(private readonly db: Db) {}

  isAnnounced(guildId: string, youtubeVideoId: string): boolean {
    const row = this.db
      .select({ id: announcedVideos.id })
      .from(announcedVideos)
      .where(and(eq(announcedVideos.guildId, guildId), eq(announcedVideos.youtubeVideoId, youtubeVideoId)))
      .get();
    return row !== undefined;
  }

  recordAnnounced(input: RecordAnnouncedInput): void {
    this.db.insert(announcedVideos).values({ ...input, announcedAt: new Date() }).run();
  }
}
