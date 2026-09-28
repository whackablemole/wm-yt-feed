import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { serverConfigurations, type ServerConfiguration } from '../schema.js';

export class ServerConfigurationRepository {
  constructor(private readonly db: Db) {}

  get(guildId: string): ServerConfiguration | undefined {
    return this.db
      .select()
      .from(serverConfigurations)
      .where(eq(serverConfigurations.guildId, guildId))
      .get();
  }

  /** Replaces (never adds a second) announcement channel for the guild — see FR-007. */
  upsert(guildId: string, announcementChannelId: string): ServerConfiguration {
    return this.db
      .insert(serverConfigurations)
      .values({ guildId, announcementChannelId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: serverConfigurations.guildId,
        set: { announcementChannelId, updatedAt: new Date() },
      })
      .returning()
      .get();
  }
}
