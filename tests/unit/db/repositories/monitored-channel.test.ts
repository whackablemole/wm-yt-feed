import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../helpers/db.js';
import { MonitoredChannelRepository } from '../../../../src/db/repositories/monitored-channel.js';

describe('MonitoredChannelRepository', () => {
  let repo: MonitoredChannelRepository;

  beforeEach(() => {
    repo = new MonitoredChannelRepository(createTestDb());
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
});
