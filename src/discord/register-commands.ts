import 'dotenv/config';
import { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { requireEnv } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export function buildYoutubeCommand() {
  return new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Manage monitored YouTube channels and announcements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Start monitoring a YouTube channel')
        .addStringOption((opt) =>
          opt.setName('channel').setDescription('Channel URL, @handle, or ID').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Stop monitoring a YouTube channel')
        .addStringOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel URL, @handle, ID, or display name')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List monitored YouTube channels'))
    .addSubcommand((sub) =>
      sub
        .setName('set-channel')
        .setDescription('Set the channel where new-video announcements are posted')
        .addChannelOption((opt) =>
          opt.setName('target').setDescription('Discord text channel').setRequired(true),
        ),
    );
}

export async function registerCommands(clientId: string, token: string): Promise<void> {
  const rest = new REST().setToken(token);
  const command = buildYoutubeCommand().toJSON();
  await rest.put(Routes.applicationCommands(clientId), { body: [command] });
  logger.info('Registered /youtube slash command');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const clientId = requireEnv('DISCORD_CLIENT_ID');
  const token = requireEnv('DISCORD_TOKEN');
  registerCommands(clientId, token).catch((error: unknown) => {
    logger.error('Failed to register commands', { error });
    process.exitCode = 1;
  });
}
