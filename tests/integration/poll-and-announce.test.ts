import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('poll-and-announce integration (US3)', () => {
  beforeEach(() => {
    mockParseURL.mockReset();
  });

  it('seeds a newly monitored channel silently, then announces oldest-first once a new video appears, without re-announcing on later polls', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    configRepo.upsert('guild-1', 'announce-channel');

    const { client, sends } = fakeClient();

    // First poll ever for this channel: the feed already has an existing video.
    // It must be seeded as a baseline, NOT announced (this is the regression test
    // for the incident where a channel's entire back-catalog got posted on add).
    mockParseURL.mockResolvedValue({
      items: [{ videoId: 'v0', title: 'Pre-existing', isoDate: '2025-12-01T00:00:00Z', link: 'https://youtube.com/watch?v=v0' }],
    });
    await pollOnce({ client, db, staggerMs: 0 });
    expect(sends['announce-channel']).toBeUndefined();

    // A later poll finds two genuinely new videos published after monitoring began.
    mockParseURL.mockResolvedValue({
      items: [
        { videoId: 'v0', title: 'Pre-existing', isoDate: '2025-12-01T00:00:00Z', link: 'https://youtube.com/watch?v=v0' },
        { videoId: 'v2', title: 'Second', isoDate: '2026-01-02T00:00:00Z', link: 'https://youtube.com/watch?v=v2' },
        { videoId: 'v1', title: 'First', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v1' },
      ],
    });
    await pollOnce({ client, db, staggerMs: 0 });

    const calls = sends['announce-channel']?.mock.calls ?? [];
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]).toContain('First');
    expect(calls[1]?.[0]).toContain('Second');

    // A repeat poll with the same feed must not re-announce anything.
    await pollOnce({ client, db, staggerMs: 0 });
    expect(sends['announce-channel']?.mock.calls).toHaveLength(2);
  });

  it('announces independently to two servers monitoring the same channel', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    channelRepo.add({ guildId: 'guild-2', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u2' });
    configRepo.upsert('guild-1', 'announce-1');
    configRepo.upsert('guild-2', 'announce-2');

    const { client, sends } = fakeClient();

    // Seed both servers first (their first-ever poll) with a pre-existing video —
    // real channels always have at least one video, so this matches reality.
    mockParseURL.mockResolvedValue({
      items: [{ videoId: 'v0', title: 'Pre-existing', isoDate: '2025-12-01T00:00:00Z', link: 'https://youtube.com/watch?v=v0' }],
    });
    await pollOnce({ client, db, staggerMs: 0 });

    // Now a genuinely new video appears for both.
    mockParseURL.mockResolvedValue({
      items: [
        { videoId: 'v0', title: 'Pre-existing', isoDate: '2025-12-01T00:00:00Z', link: 'https://youtube.com/watch?v=v0' },
        { videoId: 'v1', title: 'Only', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v1' },
      ],
    });
    await pollOnce({ client, db, staggerMs: 0 });

    expect(sends['announce-1']?.mock.calls).toHaveLength(1);
    expect(sends['announce-2']?.mock.calls).toHaveLength(1);
  });

  it('does not announce anything on the very first poll even with an empty history and existing videos in the feed', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    configRepo.upsert('guild-1', 'announce-channel');

    mockParseURL.mockResolvedValue({
      items: Array.from({ length: 15 }, (_, i) => ({
        videoId: `backlog-${i}`,
        title: `Backlog video ${i}`,
        isoDate: '2020-01-01T00:00:00Z',
        link: `https://youtube.com/watch?v=backlog-${i}`,
      })),
    });

    const { client, sends } = fakeClient();
    await pollOnce({ client, db, staggerMs: 0 });

    expect(sends['announce-channel']).toBeUndefined();
  });

  it('does not post anywhere when no announcement channel is configured', async () => {
    const db = createTestDb();
    new MonitoredChannelRepository(db).add({
      guildId: 'guild-1',
      youtubeChannelId: 'UC1',
      displayName: 'Chan',
      addedByUserId: 'u1',
    });

    mockParseURL.mockResolvedValue({
      items: [{ videoId: 'v1', title: 'Only', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v1' }],
    });

    const { client } = fakeClient();
    await expect(pollOnce({ client, db, staggerMs: 0 })).resolves.not.toThrow();
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });
});
