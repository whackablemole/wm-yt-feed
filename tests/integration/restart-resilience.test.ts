import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Client } from 'discord.js';
import { createDb, runMigrations } from '../../src/db/client.js';
import { MonitoredChannelRepository } from '../../src/db/repositories/monitored-channel.js';
import { ServerConfigurationRepository } from '../../src/db/repositories/server-config.js';
import { AnnouncedVideoRepository } from '../../src/db/repositories/announced-video.js';

const mockParseURL = vi.fn();
vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({ parseURL: mockParseURL })),
}));

// vi.mock is hoisted above imports by vitest, so this import gets the mocked rss-parser.
const { pollOnce } = await import('../../src/services/poller.js');

describe('restart resilience (US4)', () => {
  it('retains watch list, announcement channel, and announced-video history across a simulated restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-yt-feed-test-'));
    const dbPath = path.join(dir, 'bot.sqlite');

    try {
      let db = createDb(dbPath);
      runMigrations(db);

      const channel = new MonitoredChannelRepository(db).add({
        guildId: 'guild-1',
        youtubeChannelId: 'UC1',
        displayName: 'Chan',
        addedByUserId: 'u1',
      });
      new ServerConfigurationRepository(db).upsert('guild-1', 'announce-1');
      new AnnouncedVideoRepository(db).recordAnnounced({
        guildId: 'guild-1',
        monitoredChannelId: channel.id,
        youtubeVideoId: 'v1',
      });

      // Simulate a restart: close the connection and open a fresh one against the same file.
      db.$client.close();
      db = createDb(dbPath);

      expect(new MonitoredChannelRepository(db).list('guild-1')).toHaveLength(1);
      expect(new ServerConfigurationRepository(db).get('guild-1')?.announcementChannelId).toBe('announce-1');
      expect(new AnnouncedVideoRepository(db).isAnnounced('guild-1', 'v1')).toBe(true);

      mockParseURL.mockResolvedValue({
        items: [{ videoId: 'v1', title: 'First', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v1' }],
      });
      const send = vi.fn().mockResolvedValue(undefined);
      const client = {
        channels: {
          fetch: vi.fn().mockResolvedValue({ isTextBased: () => true, isSendable: () => true, send }),
        },
      } as unknown as Client;

      await pollOnce({ client, db, staggerMs: 0 });
      expect(send).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
