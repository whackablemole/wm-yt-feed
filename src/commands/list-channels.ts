import { hasManageServerPermission } from '../discord/permissions.js';
import { MonitoredChannelRepository } from '../db/repositories/monitored-channel.js';
import type { CommandContext } from './types.js';

/** FR-003, FR-013 */
export async function handleListChannels({ interaction, db }: CommandContext): Promise<void> {
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

  const repo = new MonitoredChannelRepository(db);
  const channels = repo.list(interaction.guildId);
  if (channels.length === 0) {
    await interaction.reply({
      content: 'No YouTube channels are currently monitored in this server.',
      ephemeral: true,
    });
    return;
  }

  const lines = channels.map(
    (channel) => `• **${channel.displayName}** (added <t:${Math.floor(channel.addedAt.getTime() / 1000)}:R>)`,
  );
  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
