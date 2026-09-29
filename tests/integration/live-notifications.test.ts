import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import { createTestDb } from '../helpers/db.js';
import { MonitoredChannelRepository } from '../../src/db/repositories/monitored-channel.js';
import { ServerConfigurationRepository } from '../../src/db/repositories/server-config.js';

const mockParseURL = vi.fn();
vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({ parseURL: mockParseURL })),
}));

// vi.mock is hoisted above imports by vitest, so this import gets the mocked rss-parser.
const { pollOnce } = await import('../../src/services/poller.js');

function fakeClient() {
  const sends: Record<string, ReturnType<typeof vi.fn>> = {};
  const client = {
    channels: {
      fetch: vi.fn(async (channelId: string) => {
        sends[channelId] ??= vi.fn().mockResolvedValue(undefined);
        return { isTextBased: () => true, isSendable: () => true, send: sends[channelId] };
      }),
    },
    // Only the subset of Client used by pollOnce is faked here.
  } as unknown as Client;
  return { client, sends };
}

function liveHtml(videoId: string, title = 'Live now') {
  return (
    `<html><head><title>${title} - YouTube</title>` +
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

// A fresh Response per call: Response bodies can only be consumed once, and
// checkLiveStatus is invoked on every poll cycle — reusing a single Response
// instance across multiple pollOnce() calls would fail on the second read.
function stubFetchHtml(html: string): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status: 200 }))));
}

const PRE_EXISTING_VIDEO = {
  videoId: 'v0',
  title: 'Pre-existing',
  isoDate: '2025-12-01T00:00:00Z',
  link: 'https://youtube.com/watch?v=v0',
};

describe('live-notifications integration (US1/US2)', () => {
  beforeEach(() => {
    mockParseURL.mockReset();
    mockParseURL.mockResolvedValue({ items: [PRE_EXISTING_VIDEO] });
    // Default: not live. Individual tests call stubFetchHtml(liveHtml(...)) to
    // override for the cycle(s) where a channel should be seen as live.
    stubFetchHtml(notLiveHtml());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies exactly once when a monitored channel transitions from not-live to live, naming the channel and linking the stream', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    configRepo.upsert('guild-1', 'announce-channel');
    const { client, sends } = fakeClient();

    // First poll ever: seeds the baseline; live checks are deferred until the next
    // cycle for a still-seeding entry (research.md §3), so no notification yet.
    await pollOnce({ client, db, staggerMs: 0 });
    expect(sends['announce-channel']).toBeUndefined();

    // Second poll: the channel is now live.
    stubFetchHtml(liveHtml('liveVidABCD', 'Streaming now'));
    await pollOnce({ client, db, staggerMs: 0 });

    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);
    const message = sends['announce-channel']!.mock.calls[0]?.[0] as string;
    expect(message).toContain('Chan');
    expect(message).toContain('https://www.youtube.com/watch?v=liveVidABCD');
    expect(message).toMatch(/live/i);
  });

  it('does not notify a server with no announcement channel configured, but still records live state to avoid a later duplicate', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const entry = channelRepo.add({
      guildId: 'guild-1',
      youtubeChannelId: 'UC1',
      displayName: 'Chan',
      addedByUserId: 'u1',
    });
    // No configRepo.upsert(...) — this server has no announcement channel.
    const { client, sends } = fakeClient();

    await pollOnce({ client, db, staggerMs: 0 }); // seed
    stubFetchHtml(liveHtml('liveVidABCD'));
    await pollOnce({ client, db, staggerMs: 0 });

    expect(Object.keys(sends)).toHaveLength(0);
    const updated = channelRepo.findByCanonicalId('guild-1', 'UC1');
    expect(updated?.activeLiveVideoId).toBe('liveVidABCD');
    expect(updated?.id).toBe(entry.id);
  });

  it('notifies two servers monitoring the same channel independently', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    channelRepo.add({ guildId: 'guild-2', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u2' });
    configRepo.upsert('guild-1', 'announce-1');
    configRepo.upsert('guild-2', 'announce-2');
    const { client, sends } = fakeClient();

    await pollOnce({ client, db, staggerMs: 0 }); // seed both
    stubFetchHtml(liveHtml('liveVidABCD'));
    await pollOnce({ client, db, staggerMs: 0 });

    expect(sends['announce-1']).toHaveBeenCalledTimes(1);
    expect(sends['announce-2']).toHaveBeenCalledTimes(1);
  });

  it('suppresses the regular new-video announcement for a broadcast that already got a live notification (FR-008)', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    configRepo.upsert('guild-1', 'announce-channel');
    const { client, sends } = fakeClient();

    await pollOnce({ client, db, staggerMs: 0 }); // seed

    // The channel goes live.
    stubFetchHtml(liveHtml('liveVidABCD'));
    await pollOnce({ client, db, staggerMs: 0 });
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);

    // The broadcast ends and its recording now appears in the channel's normal
    // Atom feed as a VOD, alongside the pre-existing video.
    mockParseURL.mockResolvedValue({
      items: [
        PRE_EXISTING_VIDEO,
        { videoId: 'liveVidABCD', title: 'Streaming now (VOD)', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=liveVidABCD' },
      ],
    });
    stubFetchHtml(notLiveHtml());
    await pollOnce({ client, db, staggerMs: 0 });

    // Still exactly one message total for this broadcast — no second, regular
    // "new video" announcement for the same video ID.
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);
  });

  it('does not repeat a notification while the same broadcast continues, but sends a new one for a genuinely separate later broadcast (US2)', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    configRepo.upsert('guild-1', 'announce-channel');
    const { client, sends } = fakeClient();

    await pollOnce({ client, db, staggerMs: 0 }); // seed

    stubFetchHtml(liveHtml('liveVidABCD'));
    await pollOnce({ client, db, staggerMs: 0 }); // broadcast A starts
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);

    await pollOnce({ client, db, staggerMs: 0 }); // still broadcast A
    await pollOnce({ client, db, staggerMs: 0 }); // still broadcast A
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);

    stubFetchHtml(notLiveHtml());
    await pollOnce({ client, db, staggerMs: 0 }); // broadcast A ends
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);

    stubFetchHtml(liveHtml('liveVidWXYZ'));
    await pollOnce({ client, db, staggerMs: 0 }); // broadcast B starts

    expect(sends['announce-channel']).toHaveBeenCalledTimes(2);
    const secondMessage = sends['announce-channel']!.mock.calls[1]?.[0] as string;
    expect(secondMessage).toContain('liveVidWXYZ');
  });

  it('leaves live state untouched (rather than clearing it) when a live-status check fails mid-broadcast, so a later successful check does not re-notify (US2)', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    configRepo.upsert('guild-1', 'announce-channel');
    const { client, sends } = fakeClient();

    await pollOnce({ client, db, staggerMs: 0 }); // seed

    stubFetchHtml(liveHtml('liveVidABCD'));
    await pollOnce({ client, db, staggerMs: 0 }); // broadcast starts, notified
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);
    expect(channelRepo.findByCanonicalId('guild-1', 'UC1')?.activeLiveVideoId).toBe('liveVidABCD');

    // A transient network failure mid-broadcast — must not be treated as "confirmed
    // not live" (which would clear activeLiveVideoId and risk a false re-notification
    // on the next successful check).
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await pollOnce({ client, db, staggerMs: 0 });
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);
    expect(channelRepo.findByCanonicalId('guild-1', 'UC1')?.activeLiveVideoId).toBe('liveVidABCD');

    // The check succeeds again, same broadcast still live — no duplicate notification.
    stubFetchHtml(liveHtml('liveVidABCD'));
    await pollOnce({ client, db, staggerMs: 0 });
    expect(sends['announce-channel']).toHaveBeenCalledTimes(1);
  });
});
