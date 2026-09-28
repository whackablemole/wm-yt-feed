import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { hasManageServerPermission } from '../discord/permissions.js';
import { ServerConfigurationRepository } from '../db/repositories/server-config.js';
import type { CommandContext } from './types.js';

/** FR-006, FR-007, FR-008, FR-013 */
export async function handleSetAnnouncementChannel({ interaction, db }: CommandContext): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId || !interaction.guild) {
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

  const target = interaction.options.getChannel('target', true, [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
  ]);

  const botMember = await interaction.guild.members.fetchMe();
  const permissions = target.permissionsFor(botMember);
  const canPost = permissions?.has(PermissionFlagsBits.ViewChannel) && permissions.has(PermissionFlagsBits.SendMessages);
  if (!canPost) {
    await interaction.reply({
      content: `I don't have permission to send messages in <#${target.id}>. Grant "View Channel" and "Send Messages" there and try again.`,
      ephemeral: true,
    });
    return;
  }

  const repo = new ServerConfigurationRepository(db);
  const previous = repo.get(interaction.guildId);
  repo.upsert(interaction.guildId, target.id);

  const message = previous?.announcementChannelId
    ? `Announcements will now be posted in <#${target.id}> (previously <#${previous.announcementChannelId}>).`
    : `Announcements will now be posted in <#${target.id}>.`;
  await interaction.reply({ content: message, ephemeral: true });
}
