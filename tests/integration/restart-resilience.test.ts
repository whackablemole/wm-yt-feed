import { afterEach, describe, expect, it, vi } from 'vitest';
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

function liveHtml(videoId: string) {
  return (
    '<html><head><title>Live now - YouTube</title>' +
    `<link rel="canonical" href="https://www.youtube.com/watch?v=${videoId}">` +
    '</head><body>"isLiveNow":true</body></html>'
  );
}

function notLiveHtml() {
  return (
    '<html><head><title>Chan - YouTube</title>' +
    '<link rel="canonical" href="https://www.youtube.com/channel/UC1">' +
    '</head><body></body></html>'
  );
}

// A fresh Response per call — see the same note in live-notifications.test.ts.
function stubFetchHtml(html: string): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 }))));
}

function fakeClient() {
  const send = vi.fn().mockResolvedValue(undefined);
  const client = {
    channels: {
      fetch: vi.fn().mockResolvedValue({ isTextBased: () => true, isSendable: () => true, send }),
    },
  } as unknown as Client;
  return { client, send };
}

describe('restart resilience (US4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('does not duplicate a live notification for a broadcast still ongoing across a simulated restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-yt-feed-test-'));
    const dbPath = path.join(dir, 'bot.sqlite');

    try {
      let db = createDb(dbPath);
      runMigrations(db);
      new MonitoredChannelRepository(db).add({
        guildId: 'guild-1',
        youtubeChannelId: 'UC1',
        displayName: 'Chan',
        addedByUserId: 'u1',
      });
      new ServerConfigurationRepository(db).upsert('guild-1', 'announce-1');

      mockParseURL.mockResolvedValue({
        items: [{ videoId: 'v0', title: 'Pre-existing', isoDate: '2025-12-01T00:00:00Z', link: 'https://youtube.com/watch?v=v0' }],
      });
      const { client, send } = fakeClient();

      stubFetchHtml(notLiveHtml());
      await pollOnce({ client, db, staggerMs: 0 }); // seed (live checks deferred this cycle — research.md §3)

      stubFetchHtml(liveHtml('liveVidABCD'));
      await pollOnce({ client, db, staggerMs: 0 }); // broadcast starts, notified once
      expect(send).toHaveBeenCalledTimes(1);

      // Simulate a restart: close the connection and open a fresh one against the same file.
      db.$client.close();
      db = createDb(dbPath);

      // Same broadcast is still live after restart — must not duplicate the notification.
      stubFetchHtml(liveHtml('liveVidABCD'));
      await pollOnce({ client, db, staggerMs: 0 });
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not send a notification for a broadcast that fully started and ended while the bot was down', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-yt-feed-test-'));
    const dbPath = path.join(dir, 'bot.sqlite');

    try {
      let db = createDb(dbPath);
      runMigrations(db);
      new MonitoredChannelRepository(db).add({
        guildId: 'guild-1',
        youtubeChannelId: 'UC1',
        displayName: 'Chan',
        addedByUserId: 'u1',
      });
      new ServerConfigurationRepository(db).upsert('guild-1', 'announce-1');

      mockParseURL.mockResolvedValue({
        items: [{ videoId: 'v0', title: 'Pre-existing', isoDate: '2025-12-01T00:00:00Z', link: 'https://youtube.com/watch?v=v0' }],
      });
      const { client, send } = fakeClient();

      stubFetchHtml(notLiveHtml());
      await pollOnce({ client, db, staggerMs: 0 }); // seed, past the deferred-live-check cycle

      // Bot goes down. A broadcast starts and completely ends while it's down —
      // no poll ever observes it live.
      db.$client.close();
      db = createDb(dbPath);

      // Bot restarts; its first check after restart finds the channel already back
      // to not-live, so nothing is notified for the missed broadcast.
      stubFetchHtml(notLiveHtml());
      await pollOnce({ client, db, staggerMs: 0 });

      expect(send).not.toHaveBeenCalled();
      expect(new MonitoredChannelRepository(db).findByCanonicalId('guild-1', 'UC1')?.activeLiveVideoId).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
