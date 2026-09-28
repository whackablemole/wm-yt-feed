import { describe, expect, it, vi } from 'vitest';
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { handleSetAnnouncementChannel } from '../../../src/commands/set-announcement-channel.js';
import { createTestDb } from '../../helpers/db.js';
import { ServerConfigurationRepository } from '../../../src/db/repositories/server-config.js';

interface FakeInteractionOptions {
  memberPermissions: PermissionsBitField;
  botCanPost?: boolean;
}

// Fabricating a full discord.js ChatInputCommandInteraction is impractical for a unit test;
// this fake implements only the subset the handler actually calls.
function fakeInteraction({ memberPermissions, botCanPost = true }: FakeInteractionOptions) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const target = {
    id: 'channel-target',
    type: ChannelType.GuildText,
    permissionsFor: () =>
      botCanPost
        ? new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
        : new PermissionsBitField(),
  };

  return {
    inGuild: () => true,
    guildId: 'guild-1',
    guild: { members: { fetchMe: vi.fn().mockResolvedValue({}) } },
    memberPermissions,
    options: { getChannel: () => target },
    reply,
  } as unknown as ChatInputCommandInteraction;
}

describe('handleSetAnnouncementChannel', () => {
  it('saves the announcement channel when the bot can post there', async () => {
    const db = createTestDb();
    const interaction = fakeInteraction({ memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) });

    await handleSetAnnouncementChannel({ interaction, db });

    expect(new ServerConfigurationRepository(db).get('guild-1')?.announcementChannelId).toBe('channel-target');
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('will now be posted') }),
    );
  });

  it('rejects when the bot lacks permission in the target channel', async () => {
    const db = createTestDb();
    const interaction = fakeInteraction({
      memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild),
      botCanPost: false,
    });

    await handleSetAnnouncementChannel({ interaction, db });

    expect(new ServerConfigurationRepository(db).get('guild-1')).toBeUndefined();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("don't have permission") }),
    );
  });

  it('rejects when the invoking member lacks Manage Server permission', async () => {
    const db = createTestDb();
    const interaction = fakeInteraction({ memberPermissions: new PermissionsBitField() });

    await handleSetAnnouncementChannel({ interaction, db });

    expect(new ServerConfigurationRepository(db).get('guild-1')).toBeUndefined();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Manage Server') }),
    );
  });
});
