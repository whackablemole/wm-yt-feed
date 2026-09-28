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

  it('announces all new videos oldest-first, then skips duplicates on the next poll', async () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const configRepo = new ServerConfigurationRepository(db);
    channelRepo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan', addedByUserId: 'u1' });
    configRepo.upsert('guild-1', 'announce-channel');

    mockParseURL.mockResolvedValue({
      items: [
        { videoId: 'v2', title: 'Second', isoDate: '2026-01-02T00:00:00Z', link: 'https://youtube.com/watch?v=v2' },
        { videoId: 'v1', title: 'First', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v1' },
      ],
    });

    const { client, sends } = fakeClient();
    await pollOnce({ client, db, staggerMs: 0 });

    const firstPollCalls = sends['announce-channel']?.mock.calls ?? [];
    expect(firstPollCalls).toHaveLength(2);
    expect(firstPollCalls[0]?.[0]).toContain('First');
    expect(firstPollCalls[1]?.[0]).toContain('Second');

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

    mockParseURL.mockResolvedValue({
      items: [{ videoId: 'v1', title: 'Only', isoDate: '2026-01-01T00:00:00Z', link: 'https://youtube.com/watch?v=v1' }],
    });

    const { client, sends } = fakeClient();
    await pollOnce({ client, db, staggerMs: 0 });

    expect(sends['announce-1']?.mock.calls).toHaveLength(1);
    expect(sends['announce-2']?.mock.calls).toHaveLength(1);
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
