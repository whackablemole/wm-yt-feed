import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../helpers/db.js';
import { ServerConfigurationRepository } from '../../../../src/db/repositories/server-config.js';

describe('ServerConfigurationRepository', () => {
  let repo: ServerConfigurationRepository;

  beforeEach(() => {
    repo = new ServerConfigurationRepository(createTestDb());
  });

  it('returns undefined when no configuration exists yet', () => {
    expect(repo.get('guild-1')).toBeUndefined();
  });

  it('upserts and replaces the announcement channel rather than adding a second one', () => {
    repo.upsert('guild-1', 'channel-a');
    expect(repo.get('guild-1')?.announcementChannelId).toBe('channel-a');

    repo.upsert('guild-1', 'channel-b');
    expect(repo.get('guild-1')?.announcementChannelId).toBe('channel-b');
  });
});
