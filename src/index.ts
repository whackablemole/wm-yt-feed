import 'dotenv/config';
import { Events } from 'discord.js';
import { createDiscordClient } from './discord/client.js';
import { createDb, runMigrations } from './db/client.js';
import { logger } from './lib/logger.js';
import { requireEnv } from './lib/env.js';
import { startPolling } from './services/poller.js';
import { handleAddChannel } from './commands/add-channel.js';
import { handleRemoveChannel } from './commands/remove-channel.js';
import { handleListChannels } from './commands/list-channels.js';
import { handleSetAnnouncementChannel } from './commands/set-announcement-channel.js';

const token = requireEnv('DISCORD_TOKEN');

const db = createDb();
runMigrations(db);

const client = createDiscordClient();

client.once(Events.ClientReady, (readyClient) => {
  logger.info('Bot ready', { tag: readyClient.user.tag });
  startPolling({ client: readyClient, db });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'youtube') return;

  const subcommand = interaction.options.getSubcommand();
  try {
    switch (subcommand) {
      case 'add':
        await handleAddChannel({ interaction, db });
        break;
      case 'remove':
        await handleRemoveChannel({ interaction, db });
        break;
      case 'list':
        await handleListChannels({ interaction, db });
        break;
      case 'set-channel':
        await handleSetAnnouncementChannel({ interaction, db });
        break;
      default:
        break;
    }
  } catch (error) {
    logger.error('Command handler failed', { subcommand, error });
    const payload = { content: 'Something went wrong handling that command.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => undefined);
    } else {
      await interaction.reply(payload).catch(() => undefined);
    }
  }
});

client.login(token);
