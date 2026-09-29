import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../helpers/db.js';
import { MonitoredChannelRepository } from '../../../../src/db/repositories/monitored-channel.js';
import { AnnouncedVideoRepository } from '../../../../src/db/repositories/announced-video.js';
import type { Db } from '../../../../src/db/client.js';

describe('MonitoredChannelRepository', () => {
  let db: Db;
  let repo: MonitoredChannelRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new MonitoredChannelRepository(db);
  });

  it('adds and lists a channel for a guild', () => {
    repo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan 1', addedByUserId: 'user-1' });
    expect(repo.list('guild-1')).toHaveLength(1);
  });

  it('prevents duplicate channels within the same guild', () => {
    repo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan 1', addedByUserId: 'user-1' });
    expect(() =>
      repo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan 1 dup', addedByUserId: 'user-1' }),
    ).toThrow();
  });

  it('allows the same channel to be monitored independently in a different guild', () => {
    repo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan 1', addedByUserId: 'user-1' });
    repo.add({ guildId: 'guild-2', youtubeChannelId: 'UC1', displayName: 'Chan 1', addedByUserId: 'user-2' });
    expect(repo.list('guild-1')).toHaveLength(1);
    expect(repo.list('guild-2')).toHaveLength(1);
  });

  it('removes a channel', () => {
    repo.add({ guildId: 'guild-1', youtubeChannelId: 'UC1', displayName: 'Chan 1', addedByUserId: 'user-1' });
    expect(repo.remove('guild-1', 'UC1')).toBe(true);
    expect(repo.list('guild-1')).toHaveLength(0);
  });

  it('returns false when removing a channel that is not monitored', () => {
    expect(repo.remove('guild-1', 'UC-nope')).toBe(false);
  });

  it('removes a channel that already has announced-video history, without a foreign key error', () => {
    const channel = repo.add({
      guildId: 'guild-1',
      youtubeChannelId: 'UC1',
      displayName: 'Chan 1',
      addedByUserId: 'user-1',
    });
    new AnnouncedVideoRepository(db).recordAnnounced({
      guildId: 'guild-1',
      monitoredChannelId: channel.id,
      youtubeVideoId: 'video-1',
    });

    expect(repo.remove('guild-1', 'UC1')).toBe(true);
    expect(repo.list('guild-1')).toHaveLength(0);
  });

  it('sets and clears activeLiveVideoId, persisting across repository instances against the same DB', () => {
    const channel = repo.add({
      guildId: 'guild-1',
      youtubeChannelId: 'UC1',
      displayName: 'Chan 1',
      addedByUserId: 'user-1',
    });
    expect(channel.activeLiveVideoId).toBeNull();

    repo.setActiveLiveVideoId(channel.id, 'live-video-1');
    expect(new MonitoredChannelRepository(db).list('guild-1')[0]?.activeLiveVideoId).toBe('live-video-1');

    repo.setActiveLiveVideoId(channel.id, null);
    expect(new MonitoredChannelRepository(db).list('guild-1')[0]?.activeLiveVideoId).toBeNull();
  });
});
