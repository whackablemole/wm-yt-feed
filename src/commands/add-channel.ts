import { hasManageServerPermission } from '../discord/permissions.js';
import { MonitoredChannelRepository } from '../db/repositories/monitored-channel.js';
import { ChannelResolutionError, resolveChannelReference } from '../services/youtube.js';
import { logger } from '../lib/logger.js';
import type { CommandContext } from './types.js';

/** FR-001, FR-004, FR-005, FR-013 */
export async function handleAddChannel({ interaction, db }: CommandContext): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  if (!hasManageServerPermission(interaction.memberPermissions)) {
    await interaction.reply({
      content: 'You need the "Manage Server" permission to do that.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const reference = interaction.options.getString('channel', true);
  const repo = new MonitoredChannelRepository(db);

  let resolved;
  try {
    resolved = await resolveChannelReference(reference);
  } catch (error) {
    if (error instanceof ChannelResolutionError) {
      await interaction.editReply(
        `Couldn't find a YouTube channel matching "${reference}". Check the URL/handle/ID and try again.`,
      );
      return;
    }
    logger.error('Unexpected error resolving channel', { reference, error });
    await interaction.editReply('Something went wrong resolving that channel. Please try again later.');
    return;
  }

  const existing = repo.findByCanonicalId(interaction.guildId, resolved.channelId);
  if (existing) {
    await interaction.editReply(`**${existing.displayName}** is already being monitored in this server.`);
    return;
  }

  repo.add({
    guildId: interaction.guildId,
    youtubeChannelId: resolved.channelId,
    displayName: resolved.displayName,
    addedByUserId: interaction.user.id,
  });
  await interaction.editReply(`Now monitoring **${resolved.displayName}** for new videos.`);
}
