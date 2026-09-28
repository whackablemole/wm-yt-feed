import { and, eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { monitoredChannels, type MonitoredChannel } from '../schema.js';

export interface AddMonitoredChannelInput {
  guildId: string;
  youtubeChannelId: string;
  displayName: string;
  addedByUserId: string;
}

export class MonitoredChannelRepository {
  constructor(private readonly db: Db) {}

  findByCanonicalId(guildId: string, youtubeChannelId: string): MonitoredChannel | undefined {
    return this.db
      .select()
      .from(monitoredChannels)
      .where(
        and(eq(monitoredChannels.guildId, guildId), eq(monitoredChannels.youtubeChannelId, youtubeChannelId)),
      )
      .get();
  }

  add(input: AddMonitoredChannelInput): MonitoredChannel {
    return this.db
      .insert(monitoredChannels)
      .values({ ...input, addedAt: new Date() })
      .returning()
      .get();
  }

  list(guildId: string): MonitoredChannel[] {
    return this.db.select().from(monitoredChannels).where(eq(monitoredChannels.guildId, guildId)).all();
  }

  listAll(): MonitoredChannel[] {
    return this.db.select().from(monitoredChannels).all();
  }

  remove(guildId: string, youtubeChannelId: string): boolean {
    const result = this.db
      .delete(monitoredChannels)
      .where(
        and(eq(monitoredChannels.guildId, guildId), eq(monitoredChannels.youtubeChannelId, youtubeChannelId)),
      )
      .run();
    return result.changes > 0;
  }
}
