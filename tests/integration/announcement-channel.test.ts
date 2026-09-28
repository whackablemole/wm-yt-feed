import { describe, expect, it, vi } from 'vitest';
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createTestDb } from '../helpers/db.js';
import { handleSetAnnouncementChannel } from '../../src/commands/set-announcement-channel.js';
import { ServerConfigurationRepository } from '../../src/db/repositories/server-config.js';

function fakeInteraction(options: {
  isAdmin?: boolean;
  botCanPost?: boolean;
  targetId?: string;
}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const target = {
    id: options.targetId ?? 'channel-a',
    type: ChannelType.GuildText,
    permissionsFor: () =>
      options.botCanPost === false
        ? new PermissionsBitField()
        : new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
  };

  return {
    inGuild: () => true,
    guildId: 'guild-1',
    guild: { members: { fetchMe: vi.fn().mockResolvedValue({}) } },
    memberPermissions: new PermissionsBitField(
      options.isAdmin === false ? [] : [PermissionFlagsBits.ManageGuild],
    ),
    options: { getChannel: () => target },
    reply,
    // Only the subset of ChatInputCommandInteraction used by the handler is faked here.
  } as unknown as ChatInputCommandInteraction;
}

describe('announcement-channel integration (US2)', () => {
  it('sets, then replaces, the announcement channel', async () => {
    const db = createTestDb();

    await handleSetAnnouncementChannel({ interaction: fakeInteraction({ targetId: 'channel-a' }), db });
    expect(new ServerConfigurationRepository(db).get('guild-1')?.announcementChannelId).toBe('channel-a');

    const replaceInteraction = fakeInteraction({ targetId: 'channel-b' });
    await handleSetAnnouncementChannel({ interaction: replaceInteraction, db });
    expect(new ServerConfigurationRepository(db).get('guild-1')?.announcementChannelId).toBe('channel-b');
    expect(replaceInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('previously') }),
    );
  });

  it('rejects when the bot lacks permission in the target channel', async () => {
    const db = createTestDb();
    const interaction = fakeInteraction({ botCanPost: false });
    await handleSetAnnouncementChannel({ interaction, db });

    expect(new ServerConfigurationRepository(db).get('guild-1')).toBeUndefined();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("don't have permission") }),
    );
  });

  it('blocks non-admin members', async () => {
    const db = createTestDb();
    const interaction = fakeInteraction({ isAdmin: false });
    await handleSetAnnouncementChannel({ interaction, db });

    expect(new ServerConfigurationRepository(db).get('guild-1')).toBeUndefined();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Manage Server') }),
    );
  });
});
