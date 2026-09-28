import { hasManageServerPermission } from '../discord/permissions.js';
import { MonitoredChannelRepository } from '../db/repositories/monitored-channel.js';
import { resolveChannelReference } from '../services/youtube.js';
import type { CommandContext } from './types.js';

/** FR-002, FR-013 */
export async function handleRemoveChannel({ interaction, db }: CommandContext): Promise<void> {
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

  const byDisplayName = repo
    .list(interaction.guildId)
    .find((channel) => channel.displayName.toLowerCase() === reference.trim().toLowerCase());

  let youtubeChannelId = byDisplayName?.youtubeChannelId;
  if (!youtubeChannelId) {
    try {
      youtubeChannelId = (await resolveChannelReference(reference)).channelId;
    } catch {
      await interaction.editReply(`"${reference}" isn't currently monitored in this server.`);
      return;
    }
  }

  const removed = repo.remove(interaction.guildId, youtubeChannelId);
  if (!removed) {
    await interaction.editReply(`"${reference}" isn't currently monitored in this server.`);
    return;
  }
  await interaction.editReply('Stopped monitoring that channel.');
}
