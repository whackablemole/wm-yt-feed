import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../../helpers/db.js';
import { MonitoredChannelRepository } from '../../../../src/db/repositories/monitored-channel.js';
import { AnnouncedVideoRepository } from '../../../../src/db/repositories/announced-video.js';

describe('AnnouncedVideoRepository', () => {
  it('reports a video as not announced until it is recorded', () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const repo = new AnnouncedVideoRepository(db);
    const channel = channelRepo.add({
      guildId: 'guild-1',
      youtubeChannelId: 'UC1',
      displayName: 'Chan',
      addedByUserId: 'u1',
    });

    expect(repo.isAnnounced('guild-1', 'video-1')).toBe(false);
    repo.recordAnnounced({ guildId: 'guild-1', monitoredChannelId: channel.id, youtubeVideoId: 'video-1' });
    expect(repo.isAnnounced('guild-1', 'video-1')).toBe(true);
  });

  it('scopes announced state independently per guild', () => {
    const db = createTestDb();
    const channelRepo = new MonitoredChannelRepository(db);
    const repo = new AnnouncedVideoRepository(db);
    const channel = channelRepo.add({
      guildId: 'guild-1',
      youtubeChannelId: 'UC1',
      displayName: 'Chan',
      addedByUserId: 'u1',
    });

    repo.recordAnnounced({ guildId: 'guild-1', monitoredChannelId: channel.id, youtubeVideoId: 'video-1' });
    expect(repo.isAnnounced('guild-2', 'video-1')).toBe(false);
  });

  describe('hasAnyRecorded', () => {
    it('is false until any video has been recorded for that guild+channel', () => {
      const db = createTestDb();
      const channelRepo = new MonitoredChannelRepository(db);
      const repo = new AnnouncedVideoRepository(db);
      const channel = channelRepo.add({
        guildId: 'guild-1',
        youtubeChannelId: 'UC1',
        displayName: 'Chan',
        addedByUserId: 'u1',
      });

      expect(repo.hasAnyRecorded('guild-1', channel.id)).toBe(false);
      repo.recordAnnounced({ guildId: 'guild-1', monitoredChannelId: channel.id, youtubeVideoId: 'video-1' });
      expect(repo.hasAnyRecorded('guild-1', channel.id)).toBe(true);
    });
  });
});
